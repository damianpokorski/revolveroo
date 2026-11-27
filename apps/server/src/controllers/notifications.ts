import { Elysia, t } from "elysia";
import { errorPlugin } from "../errors";
import { NotificationsService } from "../services/NotificationsService";

const TargetsModel = t.Union([t.Literal("all"), t.Array(t.String())]);

const DismissModel = t.Union([
	t.Literal("manual"),
	t.Object({ timeoutMs: t.Number() }),
]);

const NotifyBodyModel = t.Object({
	title: t.Optional(t.String()),
	message: t.String(),
	dismiss: t.Optional(DismissModel),
	targets: TargetsModel,
});

const models = {
	NotifyBody: NotifyBodyModel,
};

const service = new NotificationsService();

export const notificationsController = new Elysia({ prefix: "/notifications" })
	.use(errorPlugin)
	.model(models)
	.post("/", ({ body }) => service.notify(body), {
		body: "NotifyBody",
		response: { 200: t.Object({ id: t.String() }), 400: "BadRequestError" },
		detail: {
			summary: "Push a toast notification to targeted displays",
			tags: ["notifications"],
		},
	});
