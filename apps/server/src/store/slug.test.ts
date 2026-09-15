import { describe, expect, test } from "bun:test";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
	test("lowercases and kebab-cases a plain title", () => {
		// Arrange
		const title = "Front Door camera";

		// Act
		const result = slugify(title);

		// Assert
		expect(result).toBe("front-door-camera");
	});

	test("strips diacritics", () => {
		// Arrange
		const title = "Café Münchén";

		// Act
		const result = slugify(title);

		// Assert
		expect(result).toBe("cafe-munchen");
	});

	test("strips apostrophes instead of turning them into a separator", () => {
		// Arrange
		const title = "What's on";

		// Act
		const result = slugify(title);

		// Assert
		expect(result).toBe("whats-on");
	});

	test("collapses runs of punctuation into a single separator", () => {
		// Arrange
		const title = "Weekdays (9-5)";

		// Act
		const result = slugify(title);

		// Assert
		expect(result).toBe("weekdays-9-5");
	});

	test("falls back to a placeholder for an unsluggable title", () => {
		// Arrange
		const title = "   !!! ";

		// Act
		const result = slugify(title);

		// Assert
		expect(result).toBe("item");
	});
});

describe("uniqueSlug", () => {
	test("returns the base slug unchanged when there's no collision", () => {
		// Arrange
		const existing = ["other"];

		// Act
		const result = uniqueSlug("dashboard", existing);

		// Assert
		expect(result).toBe("dashboard");
	});

	test("suffixes with -2 on a single collision", () => {
		// Arrange
		const existing = ["dashboard"];

		// Act
		const result = uniqueSlug("dashboard", existing);

		// Assert
		expect(result).toBe("dashboard-2");
	});

	test("finds the first free suffix across multiple collisions", () => {
		// Arrange
		const existing = ["dashboard", "dashboard-2", "dashboard-3"];

		// Act
		const result = uniqueSlug("dashboard", existing);

		// Assert
		expect(result).toBe("dashboard-4");
	});
});
