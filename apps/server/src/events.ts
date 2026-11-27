import { EventEmitter } from "node:events";

// Several event names live on this one emitter, each relayed verbatim as an SSE
// event by controllers/events.ts: "change" (any store mutation — kiosk/settings
// refetch and the kiosk resets to tab 0), "heartbeat" (a display's runtime state
// changed — RuntimeState.recordHeartbeat, consumed only by /overview), and the
// Home Assistant command surface's "show-tab"/"resume"/"notification" (emitted
// directly by CommandsService/NotificationsService — fire-and-forget, nothing
// is persisted server-side, so a disconnected kiosk simply misses it). Keep
// "change" distinct from the rest: reusing it for heartbeats/commands would make
// every kiosk jump back to tab 0 whenever one fired.
export const dataEvents = new EventEmitter();
// Multiple kiosk devices + settings tabs each hold a long-lived SSE
// connection with one 'change' listener — comfortably exceeds Node's
// default max of 10 without being a real leak.
dataEvents.setMaxListeners(50);

export const notifyDataChanged = () => dataEvents.emit("change");
