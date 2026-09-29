import type { TabData } from "$lib/api";

// One injection row as the API returns it (see apps/server/src/injection.ts for
// where each kind is applied and the server-side validation rules).
export type InjectionRow = TabData["inject"][number];
export type InjectionKind = InjectionRow["kind"];

export const INJECTION_KIND_OPTIONS: {
  kind: InjectionKind;
  label: string;
  placeholder: string;
}[] = [
  { kind: "requestHeader", label: "Request header", placeholder: "X-Header" },
  { kind: "responseHeader", label: "Response header", placeholder: "X-Header" },
  { kind: "cookie", label: "Cookie", placeholder: "name" },
  { kind: "query", label: "Query param", placeholder: "param" },
  { kind: "localStorage", label: "localStorage", placeholder: "key" },
];

export interface InjectionPreset {
  id: string;
  label: string;
  rows: readonly InjectionRow[];
}

// Picking a preset just appends its rows — nothing preset-specific exists
// outside this list.
export const INJECTION_PRESETS: readonly InjectionPreset[] = [
  {
    id: "ha-hide-sidebar",
    label: "Home Assistant: hide sidebar",
    // HA stores its frontend prefs JSON-encoded in localStorage, so the value
    // carries its own quotes.
    rows: [{ kind: "localStorage", key: "dockedSidebar", value: '"always_hidden"' }],
  },
];
