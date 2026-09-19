import { Elysia, t } from "elysia";
import { DisplaysRepository } from "../db/DisplaysRepository";
import { TabsRepository } from "../db/TabsRepository";
import { WindowsRepository } from "../db/WindowsRepository";
import { runtimeState } from "../runtime/RuntimeState";
import { OverviewService } from "../services/OverviewService";

const OverviewModel = t.Object({
	issues: t.Array(
		t.Object({
			severity: t.Union([t.Literal("warn"), t.Literal("fail")]),
			kind: t.Union([
				t.Literal("blank-frame"),
				t.Literal("no-display-match"),
				t.Literal("display-offline"),
			]),
			tabId: t.Optional(t.String()),
			displayId: t.Optional(t.String()),
			message: t.String(),
		}),
	),
	displays: t.Array(
		t.Object({
			id: t.String(),
			name: t.String(),
			online: t.Boolean(),
			currentTabId: t.Nullable(t.String()),
			currentTabTitle: t.Nullable(t.String()),
			frameState: t.Nullable(
				t.Union([t.Literal("ok"), t.Literal("error"), t.Literal("timeout")]),
			),
			uptimeSeconds: t.Nullable(t.Number()),
			progressPercent: t.Nullable(t.Number()),
		}),
	),
	grid: t.Array(
		t.Object({
			tabId: t.String(),
			cells: t.Record(t.String(), t.String()),
		}),
	),
});

// Read-only per spec section 9 ("the panel is read-only") — GET only, no mutating
// routes on this controller.
const service = new OverviewService(
	new TabsRepository(),
	new DisplaysRepository(),
	new WindowsRepository(),
	runtimeState,
);

export const overviewController = new Elysia({ prefix: "/overview" })
	.model({ Overview: OverviewModel })
	.get("/", () => service.get(), {
		response: "Overview",
		detail: {
			summary: "Read-only aggregated live state for the Overview page",
			tags: ["overview"],
		},
	});
