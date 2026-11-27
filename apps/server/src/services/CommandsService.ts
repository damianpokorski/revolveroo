import type { TabsRepository } from "../db/TabsRepository";
import { NotFoundError } from "../errors";
import { dataEvents } from "../events";

export type CommandTargets = "all" | string[];

export interface ShowTabBody {
	tabId: string;
	targets: CommandTargets;
	mode?: "duration" | "lock";
	durationMs?: number;
}

const DEFAULT_DURATION_MS = 60_000;

export class CommandsService {
	constructor(private readonly tabsRepo: TabsRepository) {}

	// Fire-and-forget: broadcasts over the existing SSE stream, nothing is
	// tracked server-side. A kiosk resolves `until` against its own clock on
	// receipt, so no server-side expiry timer is needed either.
	async showTab(body: ShowTabBody): Promise<void> {
		const tab = await this.tabsRepo.findById(body.tabId);
		if (!tab) throw new NotFoundError("Tab not found");

		const mode = body.mode ?? "duration";
		const until =
			mode === "lock"
				? null
				: new Date(
						Date.now() + (body.durationMs ?? DEFAULT_DURATION_MS),
					).toISOString();

		dataEvents.emit("show-tab", {
			tabId: body.tabId,
			targets: body.targets,
			until,
		});
	}

	resume(targets: CommandTargets): void {
		dataEvents.emit("resume", { targets });
	}
}
