import { Elysia, t } from "elysia";
import { TimeRangesRepository } from "../db/TimeRangesRepository";
import { errorPlugin } from "../errors";
import { TimeRangesService } from "../services/TimeRangesService";

const TimeRangeBodyModel = t.Object({
	name: t.String(),
	startTime: t.String({ pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" }),
	endTime: t.String({ pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" }),
	daysOfWeek: t.Optional(
		t.Nullable(t.Array(t.Integer({ minimum: 0, maximum: 6 }))),
	),
});

const TimeRangeModel = t.Object({
	id: t.String(),
	name: t.String(),
	startTime: t.String(),
	endTime: t.String(),
	daysOfWeek: t.Nullable(t.Array(t.Integer())),
});

const models = {
	TimeRange: TimeRangeModel,
	TimeRangeBody: TimeRangeBodyModel,
	TimeRangeList: t.Array(TimeRangeModel),
};

const service = new TimeRangesService(new TimeRangesRepository());

export const timeRangesController = new Elysia({ prefix: "/time-ranges" })
	.use(errorPlugin)
	.model(models)
	.get("/", () => service.getAll(), {
		response: "TimeRangeList",
		detail: { summary: "List all time ranges", tags: ["time-ranges"] },
	})
	.get("/:id", ({ params: { id } }) => service.getById(id), {
		params: t.Object({ id: t.String() }),
		response: { 200: "TimeRange", 404: "NotFoundError" },
		detail: { summary: "Get a time range by id", tags: ["time-ranges"] },
	})
	.post("/", ({ body }) => service.create(body), {
		body: "TimeRangeBody",
		response: "TimeRange",
		detail: { summary: "Create a new time range", tags: ["time-ranges"] },
	})
	.put("/:id", ({ params: { id }, body }) => service.update(id, body), {
		params: t.Object({ id: t.String() }),
		body: "TimeRangeBody",
		response: { 200: "TimeRange", 404: "NotFoundError" },
		detail: { summary: "Update a time range", tags: ["time-ranges"] },
	})
	.delete("/:id", ({ params: { id } }) => service.delete(id), {
		params: t.Object({ id: t.String() }),
		response: { 200: "TimeRange", 404: "NotFoundError" },
		detail: { summary: "Delete a time range", tags: ["time-ranges"] },
	});
