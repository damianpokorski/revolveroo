import { Elysia, t } from "elysia";
import { TabsRepository } from "../db/TabsRepository";
import { errorPlugin } from "../errors";
import { TabsService } from "../services/TabsService";

const TabConditionModel = t.Union([
	t.Object({
		type: t.Literal("queryParams"),
		queryParams: t.Record(t.String(), t.String()),
	}),
	t.Object({
		type: t.Literal("timeRange"),
		timeRangeIds: t.Array(t.String()),
	}),
]);

const TabBodyModel = t.Object({
	url: t.String(),
	title: t.String(),
	hiddenFromLoop: t.Optional(t.Boolean()),
	useProxy: t.Optional(t.Boolean()),
	conditions: t.Optional(t.Array(TabConditionModel)),
	customDuration: t.Optional(t.Nullable(t.Number())),
	icon: t.Optional(t.Nullable(t.String())),
});

const TabModel = t.Object({
	id: t.String(),
	url: t.String(),
	title: t.String(),
	hiddenFromLoop: t.Boolean(),
	useProxy: t.Boolean(),
	conditions: t.Nullable(t.Array(TabConditionModel)),
	customDuration: t.Nullable(t.Number()),
	icon: t.Nullable(t.String()),
});

const models = {
	Tab: TabModel,
	TabBody: TabBodyModel,
	TabList: t.Array(TabModel),
};

const service = new TabsService(new TabsRepository());

export const tabsController = new Elysia({ prefix: "/tabs" })
	.use(errorPlugin)
	.model(models)
	.get("/", () => service.getAll(), {
		response: "TabList",
		detail: { summary: "List all tabs", tags: ["tabs"] },
	})
	.patch("/reorder", ({ body }) => service.reorder(body.ids), {
		body: t.Object({ ids: t.Array(t.String()) }),
		response: { 200: "TabList", 400: "BadRequestError" },
		detail: { summary: "Reorder tabs", tags: ["tabs"] },
	})
	.get("/:id", ({ params: { id } }) => service.getById(id), {
		params: t.Object({ id: t.String() }),
		response: { 200: "Tab", 404: "NotFoundError" },
		detail: { summary: "Get a tab by id", tags: ["tabs"] },
	})
	.post("/", ({ body }) => service.create(body), {
		body: "TabBody",
		response: "Tab",
		detail: { summary: "Create a new tab", tags: ["tabs"] },
	})
	.put("/:id", ({ params: { id }, body }) => service.update(id, body), {
		params: t.Object({ id: t.String() }),
		body: "TabBody",
		response: { 200: "Tab", 404: "NotFoundError" },
		detail: { summary: "Update a tab", tags: ["tabs"] },
	})
	.delete("/:id", ({ params: { id } }) => service.delete(id), {
		params: t.Object({ id: t.String() }),
		response: { 200: "Tab", 404: "NotFoundError" },
		detail: { summary: "Delete a tab", tags: ["tabs"] },
	});
