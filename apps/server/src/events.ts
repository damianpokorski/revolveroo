import { EventEmitter } from "node:events";

// Two event names live on this one emitter: "change" (any store mutation —
// kiosk/settings refetch and the kiosk resets to tab 0) and "heartbeat" (a
// display's runtime state changed — RuntimeState.recordHeartbeat, consumed only
// by /overview). Keep them distinct: reusing "change" for heartbeats would make
// every kiosk jump back to tab 0 on every ~15s heartbeat.
export const dataEvents = new EventEmitter();
// Multiple kiosk devices + settings tabs each hold a long-lived SSE
// connection with one 'change' listener — comfortably exceeds Node's
// default max of 10 without being a real leak.
dataEvents.setMaxListeners(50);

export const notifyDataChanged = () => dataEvents.emit("change");
