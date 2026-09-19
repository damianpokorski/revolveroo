import { Elysia, t } from "elysia";
import { DisplaysRepository } from "../db/DisplaysRepository";
import { TabsRepository } from "../db/TabsRepository";
import { errorPlugin } from "../errors";
import { runtimeState } from "../runtime/RuntimeState";
import { DisplaysService } from "../services/DisplaysService";

const DisplayMatchModel = t.Union([
	t.Object({
		kind: t.Literal("queryParam"),
		key: t.String(),
		value: t.String(),
	}),
	t.Object({
		kind: t.Literal("hostname"),
		value: t.String(),
	}),
]);

const DisplayBodyModel = t.Object({
	name: t.String(),
	match: DisplayMatchModel,
});

const DisplayModel = t.Object({
	id: t.String(),
	name: t.String(),
	match: DisplayMatchModel,
});

const models = {
	Display: DisplayModel,
	DisplayBody: DisplayBodyModel,
	DisplayList: t.Array(DisplayModel),
};

const service = new DisplaysService(
	new DisplaysRepository(),
	new TabsRepository(),
);

export const displaysController = new Elysia({ prefix: "/displays" })
	.use(errorPlugin)
	.model(models)
	.get("/", () => service.getAll(), {
		response: "DisplayList",
		detail: { summary: "List all displays", tags: ["displays"] },
	})
	.get("/:id", ({ params: { id } }) => service.getById(id), {
		params: t.Object({ id: t.String() }),
		response: { 200: "Display", 404: "NotFoundError" },
		detail: { summary: "Get a display by id", tags: ["displays"] },
	})
	.post("/", ({ body }) => service.create(body), {
		body: "DisplayBody",
		response: "Display",
		detail: { summary: "Create a new display", tags: ["displays"] },
	})
	.put("/:id", ({ params: { id }, body }) => service.update(id, body), {
		params: t.Object({ id: t.String() }),
		body: "DisplayBody",
		response: { 200: "Display", 404: "NotFoundError" },
		detail: { summary: "Update a display", tags: ["displays"] },
	})
	.delete("/:id", ({ params: { id } }) => service.delete(id), {
		params: t.Object({ id: t.String() }),
		response: { 200: "Display", 404: "NotFoundError" },
		detail: { summary: "Delete a display", tags: ["displays"] },
	})
	.post(
		"/:id/heartbeat",
		({ params: { id }, body }) => {
			runtimeState.recordHeartbeat(id, body);
			return { ok: true };
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				currentTabId: t.Nullable(t.String()),
				frameState: t.Union([
					t.Literal("ok"),
					t.Literal("error"),
					t.Literal("timeout"),
				]),
				progressPercent: t.Optional(t.Nullable(t.Number())),
			}),
			response: t.Object({ ok: t.Boolean() }),
			detail: {
				summary: "Report a display's current tab and frame state",
				tags: ["displays"],
			},
		},
	);
