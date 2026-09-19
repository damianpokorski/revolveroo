import { describe, expect, test } from "bun:test";
import { dataEvents, notifyDataChanged } from "./events";

describe("notifyDataChanged", () => {
	test("emits a 'change' event that a registered listener receives", () => {
		// Arrange
		let received = false;
		const listener = () => {
			received = true;
		};
		dataEvents.once("change", listener);

		// Act
		notifyDataChanged();

		// Assert
		expect(received).toBe(true);
	});
});

describe("heartbeat event", () => {
	test("is a distinct event name from 'change' on the same emitter", () => {
		// Arrange
		let changeReceived = false;
		let heartbeatReceived = false;
		dataEvents.once("change", () => {
			changeReceived = true;
		});
		dataEvents.once("heartbeat", () => {
			heartbeatReceived = true;
		});

		// Act
		dataEvents.emit("heartbeat", { displayId: "office" });

		// Assert
		expect(heartbeatReceived).toBe(true);
		expect(changeReceived).toBe(false);
	});
});
