import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";
import { z } from "zod";
import { configController } from "./controllers/config";
import { displaysController } from "./controllers/displays";
import { eventsController } from "./controllers/events";
import { overviewController } from "./controllers/overview";
import { tabsController } from "./controllers/tabs";
import { windowsController } from "./controllers/windows";
import { errorPlugin } from "./errors";

export const router = new Elysia({ prefix: "/api" })
	.use(errorPlugin)
	.use(
		openapi({
			documentation: {
				info: { title: "Revolver API", version: "1.0.0" },
			},
			mapJsonSchema: { zod: z.toJSONSchema },
		}),
	)
	.get("/", () => "OK")
	.get("/health", () => ({ status: "ok" }))
	.use(configController)
	.use(tabsController)
	.use(windowsController)
	.use(displaysController)
	.use(overviewController)
	.use(eventsController);
