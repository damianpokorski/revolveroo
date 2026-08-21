import { Elysia, t } from "elysia";
import { ConfigRepository } from "../db/ConfigRepository";
import { ConfigService } from "../services/ConfigService";

const ConfigModel = t.Object({
	playbackInterval: t.Number(),
	autoplayEnabled: t.Boolean(),
	theme: t.Union([
		t.Literal("mocha"),
		t.Literal("macchiato"),
		t.Literal("frappe"),
		t.Literal("latte"),
	]),
	tabTransition: t.Union([
		t.Literal("none"),
		t.Literal("crossfade"),
		t.Literal("slide"),
	]),
});

const service = new ConfigService(new ConfigRepository());

export const configController = new Elysia({ prefix: "/config" })
	.model({ Config: ConfigModel })
	.get("/", () => service.get(), {
		response: "Config",
		detail: { summary: "Get app configuration", tags: ["config"] },
	})
	.put("/", ({ body }) => service.update(body), {
		body: "Config",
		response: "Config",
		detail: { summary: "Update app configuration", tags: ["config"] },
	});
