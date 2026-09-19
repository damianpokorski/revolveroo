import { Elysia, t } from "elysia";
import { TabsRepository } from "../db/TabsRepository";
import { WindowsRepository } from "../db/WindowsRepository";
import { errorPlugin } from "../errors";
import { WindowsService } from "../services/WindowsService";

const TIME_PATTERN = "^([01]\\d|2[0-3]):[0-5]\\d$";

const WindowBodyModel = t.Object({
	name: t.String(),
	startTime: t.String({ pattern: TIME_PATTERN }),
	endTime: t.String({ pattern: TIME_PATTERN }),
});

const WindowModel = t.Object({
	id: t.String(),
	name: t.String(),
	startTime: t.String(),
	endTime: t.String(),
});

const models = {
	Window: WindowModel,
	WindowBody: WindowBodyModel,
	WindowList: t.Array(WindowModel),
};

const service = new WindowsService(
	new WindowsRepository(),
	new TabsRepository(),
);

export const windowsController = new Elysia({ prefix: "/windows" })
	.use(errorPlugin)
	.model(models)
	.get("/", () => service.getAll(), {
		response: "WindowList",
		detail: { summary: "List all time windows", tags: ["windows"] },
	})
	.get("/:id", ({ params: { id } }) => service.getById(id), {
		params: t.Object({ id: t.String() }),
		response: { 200: "Window", 404: "NotFoundError" },
		detail: { summary: "Get a time window by id", tags: ["windows"] },
	})
	.post("/", ({ body }) => service.create(body), {
		body: "WindowBody",
		response: "Window",
		detail: { summary: "Create a new time window", tags: ["windows"] },
	})
	.put("/:id", ({ params: { id }, body }) => service.update(id, body), {
		params: t.Object({ id: t.String() }),
		body: "WindowBody",
		response: { 200: "Window", 404: "NotFoundError" },
		detail: { summary: "Update a time window", tags: ["windows"] },
	})
	.delete("/:id", ({ params: { id } }) => service.delete(id), {
		params: t.Object({ id: t.String() }),
		response: { 200: "Window", 404: "NotFoundError" },
		detail: { summary: "Delete a time window", tags: ["windows"] },
	});
