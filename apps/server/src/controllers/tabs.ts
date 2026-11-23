import { Elysia, t } from "elysia";
import { DisplaysRepository } from "../db/DisplaysRepository";
import { TabsRepository } from "../db/TabsRepository";
import { WindowsRepository } from "../db/WindowsRepository";
import { errorPlugin } from "../errors";
import { runtimeState } from "../runtime/RuntimeState";
import { TabsService } from "../services/TabsService";

const TabWindowModel = t.Object({
  windowId: t.String(),
  days: t.Array(t.Integer({ minimum: 0, maximum: 6 })),
});

// Shape only — the per-kind key rules (header tokens, no line breaks, no Host
// override) are enforced by TabsService via injection.ts, returning a 422.
const InjectionModel = t.Object({
  kind: t.Union([
    t.Literal("requestHeader"),
    t.Literal("responseHeader"),
    t.Literal("cookie"),
    t.Literal("query"),
    t.Literal("localStorage"),
  ]),
  key: t.String({ minLength: 1 }),
  value: t.String(),
});

const TabBodyModel = t.Object({
  url: t.String(),
  title: t.String(),
  inLoop: t.Optional(t.Boolean()),
  displays: t.Optional(t.Nullable(t.Array(t.String()))),
  windows: t.Optional(t.Nullable(t.Array(TabWindowModel))),
  customDuration: t.Optional(t.Nullable(t.Number())),
  refreshInterval: t.Optional(t.Nullable(t.Number({ minimum: 60_000 }))),
  icon: t.Optional(t.Nullable(t.String())),
  useProxy: t.Optional(t.Boolean()),
  inject: t.Optional(t.Array(InjectionModel)),
});

const TabModel = t.Object({
  id: t.String(),
  url: t.String(),
  title: t.String(),
  inLoop: t.Boolean(),
  displays: t.Nullable(t.Array(t.String())),
  windows: t.Nullable(t.Array(TabWindowModel)),
  customDuration: t.Nullable(t.Number()),
  refreshInterval: t.Nullable(t.Number()),
  icon: t.Nullable(t.String()),
  useProxy: t.Boolean(),
  inject: t.Array(InjectionModel),
});

const TabHealthModel = t.Record(
  t.String(),
  t.Object({
    status: t.Union([t.Literal("ok"), t.Literal("slow"), t.Literal("fail")]),
    latencyMs: t.Nullable(t.Number()),
    httpStatus: t.Nullable(t.Number()),
    lastGoodAt: t.Nullable(t.String()),
    lastCheckedAt: t.String(),
  }),
);

const models = {
  Tab: TabModel,
  TabBody: TabBodyModel,
  TabList: t.Array(TabModel),
  TabHealth: TabHealthModel,
};

const service = new TabsService(
  new TabsRepository(),
  new DisplaysRepository(),
  new WindowsRepository(),
);

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
  .get("/health", () => runtimeState.getTabHealthMap(), {
    response: "TabHealth",
    detail: { summary: "Get per-tab URL health", tags: ["tabs"] },
  })
  .get("/:id", ({ params: { id } }) => service.getById(id), {
    params: t.Object({ id: t.String() }),
    response: { 200: "Tab", 404: "NotFoundError" },
    detail: { summary: "Get a tab by id", tags: ["tabs"] },
  })
  .post("/", ({ body }) => service.create(body), {
    body: "TabBody",
    response: {
      200: "Tab",
      400: "BadRequestError",
      422: "UnprocessableEntityError",
    },
    detail: { summary: "Create a new tab", tags: ["tabs"] },
  })
  .put("/:id", ({ params: { id }, body }) => service.update(id, body), {
    params: t.Object({ id: t.String() }),
    body: "TabBody",
    response: {
      200: "Tab",
      404: "NotFoundError",
      400: "BadRequestError",
      422: "UnprocessableEntityError",
    },
    detail: { summary: "Update a tab", tags: ["tabs"] },
  })
  .delete("/:id", ({ params: { id } }) => service.delete(id), {
    params: t.Object({ id: t.String() }),
    response: { 200: "Tab", 404: "NotFoundError" },
    detail: { summary: "Delete a tab", tags: ["tabs"] },
  });
