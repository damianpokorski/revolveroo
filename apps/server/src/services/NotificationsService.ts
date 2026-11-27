import { BadRequestError } from "../errors";
import { dataEvents } from "../events";

export type CommandTargets = "all" | string[];
export type NotificationDismiss = "manual" | { timeoutMs: number };

export interface NotifyBody {
	title?: string;
	message: string;
	dismiss?: NotificationDismiss;
	targets: CommandTargets;
}

const DEFAULT_TIMEOUT_MS = 8000;

export class NotificationsService {
	// Fire-and-forget, same as CommandsService — nothing is tracked
	// server-side, so a disconnected kiosk simply never sees this one.
	notify(body: NotifyBody): { id: string } {
		if (!body.message.trim())
			throw new BadRequestError("message must not be empty");

		const id = crypto.randomUUID();
		const title = body.title?.trim() || undefined;
		const dismiss: NotificationDismiss = body.dismiss ?? {
			timeoutMs: DEFAULT_TIMEOUT_MS,
		};
		dataEvents.emit("notification", {
			id,
			title,
			message: body.message,
			dismiss,
			targets: body.targets,
		});
		return { id };
	}
}
