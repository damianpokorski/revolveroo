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
