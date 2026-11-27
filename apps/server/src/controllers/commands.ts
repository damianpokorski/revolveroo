import { Elysia, t } from "elysia";
import { TabsRepository } from "../db/TabsRepository";
import { errorPlugin } from "../errors";
import { CommandsService } from "../services/CommandsService";

const TargetsModel = t.Union([t.Literal("all"), t.Array(t.String())]);

const ShowTabBodyModel = t.Object({
	tabId: t.String(),
	targets: TargetsModel,
	mode: t.Optional(t.Union([t.Literal("duration"), t.Literal("lock")])),
	durationMs: t.Optional(t.Number()),
});

const ResumeBodyModel = t.Object({
	targets: TargetsModel,
});

const models = {
	ShowTabBody: ShowTabBodyModel,
	ResumeBody: ResumeBodyModel,
};

const service = new CommandsService(new TabsRepository());

export const commandsController = new Elysia({ prefix: "/commands" })
	.use(errorPlugin)
	.model(models)
	.post(
		"/show-tab",
		async ({ body }) => {
			await service.showTab(body);
			return { ok: true };
		},
		{
			body: "ShowTabBody",
			response: { 200: t.Object({ ok: t.Boolean() }), 404: "NotFoundError" },
			detail: {
				summary: "Force a tab onto the targeted displays",
				tags: ["commands"],
			},
		},
	)
	.post(
		"/resume",
		({ body }) => {
			service.resume(body.targets);
			return { ok: true };
		},
		{
			body: "ResumeBody",
			response: t.Object({ ok: t.Boolean() }),
			detail: {
				summary: "Release a forced tab and resume normal rotation",
				tags: ["commands"],
			},
		},
	);
