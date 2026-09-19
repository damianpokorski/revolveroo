import { treaty } from "@elysia/eden";
import type { router } from "server/src/router";

export const resolveServerUrl = () =>
	import.meta.env.DEV ? "http://localhost:3000" : window.location.origin;

export const createApi = () => treaty<typeof router>(resolveServerUrl());

type ApiClient = ReturnType<typeof createApi>;

export type TabData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["tabs"]["get"]>>["data"]
>[number];
export type TabBody = Parameters<ApiClient["api"]["tabs"]["post"]>[0];
export type TabHealthData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["tabs"]["health"]["get"]>>["data"]
>;

export type WindowData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["windows"]["get"]>>["data"]
>[number];
export type WindowBody = Parameters<ApiClient["api"]["windows"]["post"]>[0];

export type DisplayData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["displays"]["get"]>>["data"]
>[number];
export type DisplayBody = Parameters<ApiClient["api"]["displays"]["post"]>[0];

export type ConfigData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["config"]["get"]>>["data"]
>;
export type ConfigBody = Parameters<ApiClient["api"]["config"]["put"]>[0];

export type OverviewData = NonNullable<
	Awaited<ReturnType<ApiClient["api"]["overview"]["get"]>>["data"]
>;
