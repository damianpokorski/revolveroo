import { createHash } from "node:crypto";
import { type FSWatcher, watch } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { env } from "@revolver/env/server";
import { Document, isMap, isScalar, parseDocument, type YAMLMap } from "yaml";
import type { ZodType } from "zod";
import { notifyDataChanged } from "../events";
import {
	DEFAULT_CONFIG,
	DEFAULT_DISPLAYS,
	DEFAULT_TABS,
	DEFAULT_WINDOWS,
} from "./defaultData";
import { migrateRawData } from "./migrate";
import {
	ConfigSchema,
	DisplayEntrySchema,
	TabEntrySchema,
	TimeWindowEntrySchema,
} from "./schema";
import { slugify, uniqueSlug } from "./slug";
import type { Config, Display, Tab, TimeWindow } from "./types";

const DEBOUNCE_MS = 250;

type Section = "config" | "tabs" | "windows" | "displays";

// Serializes every mutation to the store — both API-triggered writes and
// watcher-triggered reloads — since they all touch the same in-memory Document
// and the same file on disk. Sufficient for a single-process deployment (Bun is
// single-process); a multi-replica deployment would additionally need cross-process
// file locking, which this app doesn't support.
class Mutex {
	private tail: Promise<unknown> = Promise.resolve();

	run<T>(fn: () => Promise<T>): Promise<T> {
		const result = this.tail.then(fn, fn);
		this.tail = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}
}

function sha1(text: string): string {
	return createHash("sha1").update(text).digest("hex");
}

function keyOf(pair: { key: unknown }): string {
	return isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
}

function stripId<T extends { id: string }>(value: T): Omit<T, "id"> {
	const { id: _id, ...rest } = value;
	return rest;
}

export class YamlStore {
	private readonly mutex = new Mutex();
	private doc: Document = new Document({});
	private config: Config = { ...DEFAULT_CONFIG };
	private tabs = new Map<string, Tab>();
	private windows = new Map<string, TimeWindow>();
	private displays = new Map<string, Display>();
	private lastWrittenHash = "";
	private watcher: FSWatcher | undefined;
	private debounceTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(private readonly filePath: string) {}

	async load(): Promise<void> {
		await this.mutex.run(async () => {
			await mkdir(dirname(this.filePath), { recursive: true });

			if (!(await this.fileExists())) {
				this.config = { ...DEFAULT_CONFIG };
				this.tabs = new Map(DEFAULT_TABS.map((tab) => [tab.id, tab]));
				this.windows = new Map(DEFAULT_WINDOWS.map((w) => [w.id, w]));
				this.displays = new Map(DEFAULT_DISPLAYS.map((d) => [d.id, d]));
				this.doc = new Document({
					config: DEFAULT_CONFIG,
					displays: Object.fromEntries(
						DEFAULT_DISPLAYS.map((d) => [d.id, stripId(d)]),
					),
					windows: Object.fromEntries(
						DEFAULT_WINDOWS.map((w) => [w.id, stripId(w)]),
					),
					tabs: Object.fromEntries(
						DEFAULT_TABS.map((tab) => [tab.id, stripId(tab)]),
					),
				});
				await this.persist();
				console.log(`Created default data file at ${this.filePath}`);
				return;
			}

			const text = await readFile(this.filePath, "utf8");
			const parsedDoc = parseDocument(text, { strict: false });
			if (parsedDoc.errors.length > 0) {
				throw new Error(
					`Failed to parse ${this.filePath}: ${parsedDoc.errors[0]?.message}`,
				);
			}
			this.doc = parsedDoc;
			this.config = { ...DEFAULT_CONFIG };
			this.tabs = new Map();
			this.windows = new Map();
			this.displays = new Map();
			this.applyRawData(parsedDoc.toJS());
			if (this.migrateIfNeeded()) await this.persist();
		});
	}

	startWatching(): void {
		if (this.watcher) return;
		const dir = dirname(this.filePath);
		const base = basename(this.filePath);
		this.watcher = watch(dir, (_event, filename) => {
			if (filename !== base) return;
			if (this.debounceTimer) clearTimeout(this.debounceTimer);
			this.debounceTimer = setTimeout(() => {
				this.handleExternalChange().catch((err) =>
					console.error("Error handling external data file change:", err),
				);
			}, DEBOUNCE_MS);
		});
	}

	stopWatching(): void {
		this.watcher?.close();
		this.watcher = undefined;
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
	}

	getConfig(): Config {
		return this.config;
	}

	listTabs(): Tab[] {
		return [...this.tabs.values()];
	}

	getTab(id: string): Tab | undefined {
		return this.tabs.get(id);
	}

	listWindows(): TimeWindow[] {
		return [...this.windows.values()];
	}

	getWindow(id: string): TimeWindow | undefined {
		return this.windows.get(id);
	}

	listDisplays(): Display[] {
		return [...this.displays.values()];
	}

	getDisplay(id: string): Display | undefined {
		return this.displays.get(id);
	}

	async updateConfig(patch: Partial<Config>): Promise<Config> {
		return this.mutex.run(async () => {
			const updated: Config = { ...this.config, ...patch };
			const configNode = this.getOrCreateSection("config");
			for (const [key, value] of Object.entries(updated)) {
				configNode.set(key, this.doc.createNode(value));
			}
			this.config = updated;
			await this.persist();
			return updated;
		});
	}

	async createTab(data: Omit<Tab, "id">): Promise<Tab> {
		return this.mutex.run(async () => {
			const id = uniqueSlug(slugify(data.title), this.tabs.keys());
			const tab: Tab = { id, ...data };
			const tabsNode = this.getOrCreateSection("tabs");
			tabsNode.set(id, this.doc.createNode(stripId(tab)));
			this.tabs.set(id, tab);
			await this.persist();
			return tab;
		});
	}

	async updateTab(
		id: string,
		patch: Partial<Omit<Tab, "id">>,
	): Promise<Tab | undefined> {
		return this.mutex.run(async () => {
			const existing = this.tabs.get(id);
			if (!existing) return undefined;
			const updated: Tab = { ...existing, ...patch, id };
			const tabsNode = this.getOrCreateSection("tabs");
			tabsNode.set(id, this.doc.createNode(stripId(updated)));
			this.tabs.set(id, updated);
			await this.persist();
			return updated;
		});
	}

	async deleteTab(id: string): Promise<Tab | undefined> {
		return this.mutex.run(async () => {
			const existing = this.tabs.get(id);
			if (!existing) return undefined;
			const tabsNode = this.getOrCreateSection("tabs");
			tabsNode.delete(id);
			this.tabs.delete(id);
			await this.persist();
			return existing;
		});
	}

	async reorderTabs(orderedIds: string[]): Promise<Tab[]> {
		return this.mutex.run(async () => {
			const tabsNode = this.getOrCreateSection("tabs");
			const pairsByKey = new Map(
				tabsNode.items.map((pair) => [keyOf(pair), pair]),
			);
			tabsNode.items = orderedIds.map((id) => {
				const pair = pairsByKey.get(id);
				if (!pair) throw new Error(`reorderTabs: unknown tab id "${id}"`);
				return pair;
			});
			const reordered = new Map<string, Tab>();
			for (const id of orderedIds) {
				const tab = this.tabs.get(id);
				if (tab) reordered.set(id, tab);
			}
			this.tabs = reordered;
			await this.persist();
			return [...this.tabs.values()];
		});
	}

	async createWindow(data: Omit<TimeWindow, "id">): Promise<TimeWindow> {
		return this.mutex.run(async () => {
			const id = uniqueSlug(slugify(data.name), this.windows.keys());
			const window: TimeWindow = { id, ...data };
			const windowsNode = this.getOrCreateSection("windows");
			windowsNode.set(id, this.doc.createNode(stripId(window)));
			this.windows.set(id, window);
			await this.persist();
			return window;
		});
	}

	async updateWindow(
		id: string,
		patch: Partial<Omit<TimeWindow, "id">>,
	): Promise<TimeWindow | undefined> {
		return this.mutex.run(async () => {
			const existing = this.windows.get(id);
			if (!existing) return undefined;
			const updated: TimeWindow = { ...existing, ...patch, id };
			const windowsNode = this.getOrCreateSection("windows");
			windowsNode.set(id, this.doc.createNode(stripId(updated)));
			this.windows.set(id, updated);
			await this.persist();
			return updated;
		});
	}

	async deleteWindow(id: string): Promise<TimeWindow | undefined> {
		return this.mutex.run(async () => {
			const existing = this.windows.get(id);
			if (!existing) return undefined;
			const windowsNode = this.getOrCreateSection("windows");
			windowsNode.delete(id);
			this.windows.delete(id);
			await this.persist();
			return existing;
		});
	}

	async createDisplay(data: Omit<Display, "id">): Promise<Display> {
		return this.mutex.run(async () => {
			const id = uniqueSlug(slugify(data.name), this.displays.keys());
			const display: Display = { id, ...data };
			const displaysNode = this.getOrCreateSection("displays");
			displaysNode.set(id, this.doc.createNode(stripId(display)));
			this.displays.set(id, display);
			await this.persist();
			return display;
		});
	}

	async updateDisplay(
		id: string,
		patch: Partial<Omit<Display, "id">>,
	): Promise<Display | undefined> {
		return this.mutex.run(async () => {
			const existing = this.displays.get(id);
			if (!existing) return undefined;
			const updated: Display = { ...existing, ...patch, id };
			const displaysNode = this.getOrCreateSection("displays");
			displaysNode.set(id, this.doc.createNode(stripId(updated)));
			this.displays.set(id, updated);
			await this.persist();
			return updated;
		});
	}

	async deleteDisplay(id: string): Promise<Display | undefined> {
		return this.mutex.run(async () => {
			const existing = this.displays.get(id);
			if (!existing) return undefined;
			const displaysNode = this.getOrCreateSection("displays");
			displaysNode.delete(id);
			this.displays.delete(id);
			await this.persist();
			return existing;
		});
	}

	private async fileExists(): Promise<boolean> {
		try {
			await readFile(this.filePath);
			return true;
		} catch {
			return false;
		}
	}

	private getOrCreateSection(key: Section): YAMLMap {
		const node = this.doc.get(key, true);
		if (isMap(node)) return node;
		const created = this.doc.createNode({});
		this.doc.set(key, created);
		return created as YAMLMap;
	}

	private async persist(): Promise<void> {
		const text = this.doc.toString();
		const tmpPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
		await writeFile(tmpPath, text, "utf8");
		await rename(tmpPath, this.filePath);
		this.lastWrittenHash = sha1(text);
	}

	private async handleExternalChange(): Promise<void> {
		await this.mutex.run(async () => {
			let text: string;
			try {
				text = await readFile(this.filePath, "utf8");
			} catch {
				return;
			}
			const hash = sha1(text);
			if (hash === this.lastWrittenHash) return;

			const parsedDoc = parseDocument(text, { strict: false });
			if (parsedDoc.errors.length > 0) {
				console.error(
					`Failed to parse ${this.filePath} after an external edit, keeping previous state:`,
					parsedDoc.errors[0],
				);
				return;
			}
			this.doc = parsedDoc;
			this.applyRawData(parsedDoc.toJS());
			const migrated = this.migrateIfNeeded();
			if (migrated) {
				await this.persist();
			} else {
				this.lastWrittenHash = hash;
			}
			notifyDataChanged();
		});
	}

	/**
	 * Detects and applies the pre-Display/TimeWindow YAML shape (see
	 * store/migrate.ts). Replaces `this.doc` wholesale rather than patching the
	 * comment-preserving Document node-by-node, since this is a one-time structural
	 * rename/restructure, not an ordinary field edit — hand-added YAML comments are
	 * lost on the one migrating load only, not on any subsequent edit. Returns
	 * whether a migration actually ran, so the caller knows whether to persist.
	 */
	private migrateIfNeeded(): boolean {
		const { data, changed } = migrateRawData(this.doc.toJS() ?? {});
		if (!changed) return false;
		this.doc = new Document(data);
		this.applyRawData(data);
		console.log(
			`Migrated ${this.filePath} to the Display/TimeWindow data model`,
		);
		return true;
	}

	private applyRawData(raw: unknown): void {
		const obj =
			raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
		this.tabs = this.parseEntries(obj.tabs, TabEntrySchema, this.tabs, "tab");
		this.windows = this.parseEntries(
			obj.windows,
			TimeWindowEntrySchema,
			this.windows,
			"time window",
		);
		this.displays = this.parseEntries(
			obj.displays,
			DisplayEntrySchema,
			this.displays,
			"display",
		);
		this.config = this.parseConfig(obj.config);
	}

	private parseEntries<T extends { id: string }>(
		raw: unknown,
		schema: ZodType<Omit<T, "id">>,
		previous: Map<string, T>,
		label: string,
	): Map<string, T> {
		if (raw === undefined) return new Map(previous);
		if (raw === null || typeof raw !== "object") {
			console.error(
				`"${label}s" section is not a mapping in ${this.filePath}, keeping previous data`,
			);
			return new Map(previous);
		}
		const next = new Map<string, T>();
		for (const [id, value] of Object.entries(raw)) {
			const parsed = schema.safeParse(value);
			if (parsed.success) {
				next.set(id, { id, ...parsed.data } as T);
				continue;
			}
			console.error(
				`Invalid ${label} "${id}" in ${this.filePath}:`,
				parsed.error.issues,
			);
			const fallback = previous.get(id);
			if (fallback) next.set(id, fallback);
		}
		return next;
	}

	private parseConfig(raw: unknown): Config {
		const obj =
			raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
		const next = { ...this.config };
		for (const key of Object.keys(ConfigSchema.shape) as (keyof Config)[]) {
			const fieldSchema = ConfigSchema.shape[key];
			const result = fieldSchema.safeParse(obj[key]);
			if (result.success) {
				// biome-ignore lint/suspicious/noExplicitAny: assigning a per-field validated value back onto its own key
				(next as any)[key] = result.data;
			} else {
				console.error(
					`Invalid config.${key} in ${this.filePath}:`,
					result.error.issues,
				);
			}
		}
		return next;
	}
}

export const store = new YamlStore(env.DATA_FILE);
