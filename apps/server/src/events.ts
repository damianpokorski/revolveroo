import { EventEmitter } from "node:events";

export const dataEvents = new EventEmitter();
// Multiple kiosk devices + settings tabs each hold a long-lived SSE
// connection with one 'change' listener — comfortably exceeds Node's
// default max of 10 without being a real leak.
dataEvents.setMaxListeners(50);

export const notifyDataChanged = () => dataEvents.emit("change");
