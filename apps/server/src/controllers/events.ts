import { Elysia, sse } from "elysia";
import { dataEvents } from "../events";

const HEARTBEAT_MS = 30_000;

function waitForAnyEvent(
	names: string[],
	signal: AbortSignal,
): Promise<{ event: string; payload: unknown } | false> {
	return new Promise((resolve) => {
		const listeners = names.map((name) => {
			const onEvent = (payload: unknown) => {
				cleanup();
				resolve({ event: name, payload });
			};
			return { name, onEvent };
		});
		const onAbort = () => {
			cleanup();
			resolve(false);
		};
		const cleanup = () => {
			for (const { name, onEvent } of listeners) dataEvents.off(name, onEvent);
			signal.removeEventListener("abort", onAbort);
		};
		for (const { name, onEvent } of listeners) dataEvents.once(name, onEvent);
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

export const eventsController = new Elysia().get(
	"/events",
	async function* ({ request }) {
		while (!request.signal.aborted) {
			const heartbeatTimeout = new Promise<false>((resolve) =>
				setTimeout(() => resolve(false), HEARTBEAT_MS),
			);
			const result = await Promise.race([
				waitForAnyEvent(["change", "heartbeat"], request.signal),
				heartbeatTimeout,
			]);
			if (request.signal.aborted) return;
			// A `data` field is required — per the SSE spec, EventSource silently
			// drops event blocks whose data buffer is empty, so `event` alone
			// (with no `data`) never dispatches to the browser.
			if (!result) {
				yield sse({ event: "ping", data: "ping" });
			} else if (result.event === "heartbeat") {
				yield sse({ event: "heartbeat", data: JSON.stringify(result.payload) });
			} else {
				yield sse({ event: "change", data: "change" });
			}
		}
	},
);
