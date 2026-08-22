import { Elysia, sse } from "elysia";
import { dataEvents } from "../events";

const HEARTBEAT_MS = 30_000;

function waitForChangeOrAbort(signal: AbortSignal): Promise<boolean> {
	return new Promise((resolve) => {
		const cleanup = () => {
			dataEvents.off("change", onChange);
			signal.removeEventListener("abort", onAbort);
		};
		const onChange = () => {
			cleanup();
			resolve(true);
		};
		const onAbort = () => {
			cleanup();
			resolve(false);
		};
		dataEvents.once("change", onChange);
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

export const eventsController = new Elysia().get(
	"/events",
	async function* ({ request }) {
		while (!request.signal.aborted) {
			const heartbeat = new Promise<false>((resolve) =>
				setTimeout(() => resolve(false), HEARTBEAT_MS),
			);
			const changed = await Promise.race([
				waitForChangeOrAbort(request.signal),
				heartbeat,
			]);
			if (request.signal.aborted) return;
			// A `data` field is required — per the SSE spec, EventSource silently
			// drops event blocks whose data buffer is empty, so `event` alone
			// (with no `data`) never dispatches to the browser.
			yield changed
				? sse({ event: "change", data: "change" })
				: sse({ event: "ping", data: "ping" });
		}
	},
);
