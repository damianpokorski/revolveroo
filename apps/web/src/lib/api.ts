import { treaty } from "@elysia/eden";
import type { router } from "server/src/router";

const resolveServerUrl = () =>
	import.meta.env.DEV ? "http://localhost:3000" : window.location.origin;

export const createApi = () => treaty<typeof router>(resolveServerUrl());

type ApiClient = ReturnType<typeof createApi>;
export type TabData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["tabs"]["get"]>>["data"]
>[number];
export type TabBody = Parameters<ApiClient["api"]["tabs"]["post"]>[0];
export type TimeRangeData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["time-ranges"]["get"]>>["data"]
>[number];
export type TimeRangeBody = Parameters<
	ApiClient["api"]["time-ranges"]["post"]
>[0];
export type ConfigData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["config"]["get"]>>["data"]
>;
export type ConfigBody = Parameters<ApiClient["api"]["config"]["put"]>[0];
