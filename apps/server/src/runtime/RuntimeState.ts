import type { TabsRepository } from "../db/TabsRepository";
import { dataEvents } from "../events";

// Transient, in-memory only — never persisted to the YAML store (spec section 9:
// "runtime liveness is not stored"). Two kinds of state, both process-lifetime:
//  - tab health, filled by a periodic URL probe loop (startHealthProbeLoop)
//  - display heartbeat, filled by kiosk clients POSTing their current tab/frame state
//
// Heartbeat changes emit a "heartbeat" SSE event on the *existing* dataEvents
// emitter (see controllers/events.ts) rather than a second SSE system — see the
// plan's "per-display SSE simplified" note. This is a distinct event name from
// "change": the kiosk's own SSE listener only reacts to "change" and must never
// pick up "heartbeat", or it would reset to tab 0 on every ~15s heartbeat.

export type TabHealthStatus = "ok" | "slow" | "fail";
export type FrameState = "ok" | "error" | "timeout";

export interface TabHealth {
	status: TabHealthStatus;
	latencyMs: number | null;
	httpStatus: number | null;
	lastGoodAt: string | null;
	lastCheckedAt: string;
}

export interface DisplayRuntime {
	currentTabId: string | null;
	frameState: FrameState;
	progressPercent: number | null;
	lastHeartbeatAt: string;
	onlineSince: string;
}

const SLOW_THRESHOLD_MS = 3000;
const PROBE_TIMEOUT_MS = 5000;
const DEFAULT_HEARTBEAT_DEBOUNCE_MS = 2000;

export class RuntimeState {
	private tabHealth = new Map<string, TabHealth>();
	private displayRuntime = new Map<string, DisplayRuntime>();
	private lastHeartbeatEmit = new Map<string, number>();
	private probeTimer: ReturnType<typeof setInterval> | undefined;

	constructor(
		private readonly heartbeatDebounceMs = DEFAULT_HEARTBEAT_DEBOUNCE_MS,
	) {}

	getTabHealthMap(): Record<string, TabHealth> {
		return Object.fromEntries(this.tabHealth);
	}

	getDisplayRuntimeMap(): Record<string, DisplayRuntime> {
		return Object.fromEntries(this.displayRuntime);
	}

	recordHeartbeat(
		displayId: string,
		data: {
			currentTabId: string | null;
			frameState: FrameState;
			progressPercent?: number | null;
		},
	): void {
		const now = new Date().toISOString();
		const previous = this.displayRuntime.get(displayId);
		const changed =
			!previous ||
			previous.currentTabId !== data.currentTabId ||
			previous.frameState !== data.frameState;
		this.displayRuntime.set(displayId, {
			currentTabId: data.currentTabId,
			frameState: data.frameState,
			progressPercent: data.progressPercent ?? null,
			lastHeartbeatAt: now,
			onlineSince: previous?.onlineSince ?? now,
		});
		if (!changed) return;
		const lastEmit = this.lastHeartbeatEmit.get(displayId) ?? 0;
		if (Date.now() - lastEmit < this.heartbeatDebounceMs) return;
		this.lastHeartbeatEmit.set(displayId, Date.now());
		dataEvents.emit("heartbeat", { displayId });
	}

	startHealthProbeLoop(tabsRepo: TabsRepository, intervalMs = 60_000): void {
		if (this.probeTimer) return;
		const tick = () => {
			this.probeAllTabs(tabsRepo).catch((err) =>
				console.error("Tab health probe loop failed:", err),
			);
		};
		tick();
		this.probeTimer = setInterval(tick, intervalMs);
	}

	stopHealthProbeLoop(): void {
		if (this.probeTimer) clearInterval(this.probeTimer);
		this.probeTimer = undefined;
	}

	private async probeAllTabs(tabsRepo: TabsRepository): Promise<void> {
		const tabs = await tabsRepo.findAll();
		await Promise.all(tabs.map((tab) => this.probeTab(tab.id, tab.url)));
	}

	private async probeTab(tabId: string, url: string): Promise<void> {
		const now = new Date().toISOString();
		const previous = this.tabHealth.get(tabId);
		const start = performance.now();
		try {
			let response = await fetch(url, {
				method: "HEAD",
				signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
			});
			if (response.status === 405) {
				response = await fetch(url, {
					method: "GET",
					signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
				});
			}
			const latencyMs = Math.round(performance.now() - start);
			const ok = response.ok;
			this.tabHealth.set(tabId, {
				status: !ok ? "fail" : latencyMs > SLOW_THRESHOLD_MS ? "slow" : "ok",
				latencyMs,
				httpStatus: response.status,
				lastGoodAt: ok ? now : (previous?.lastGoodAt ?? null),
				lastCheckedAt: now,
			});
		} catch {
			const latencyMs = Math.round(performance.now() - start);
			this.tabHealth.set(tabId, {
				status: "fail",
				latencyMs,
				httpStatus: null,
				lastGoodAt: previous?.lastGoodAt ?? null,
				lastCheckedAt: now,
			});
		}
	}
}

export const runtimeState = new RuntimeState();
