import { openapi } from "@elysia/openapi";
import { Elysia } from "elysia";
import { z } from "zod";
import { configController } from "./controllers/config";
import { eventsController } from "./controllers/events";
import { proxyController, proxySwRoute } from "./controllers/proxy";
import { tabsController } from "./controllers/tabs";
import { timeRangesController } from "./controllers/time-ranges";
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
	.use(timeRangesController)
	.use(eventsController)
	.use(proxyController)
	.use(proxySwRoute);
