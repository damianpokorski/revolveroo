import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Tab } from "../store/types";
import {
	buildCaddyfile,
	buildRefererPattern,
	resolveFrameAncestors,
} from "./CaddyProxyService";

function tab(overrides: Partial<Tab> = {}): Tab {
	return {
		id: "example",
		title: "Example",
		url: "https://example.com/path",
		icon: null,
		inLoop: true,
		customDuration: null,
		displays: null,
		windows: null,
		useProxy: false,
		...overrides,
	};
}

const LABEL = "0123456789abcdef01234567";

function options(
	overrides: Partial<Parameters<typeof buildCaddyfile>[0]> = {},
) {
	return {
		tabs: [],
		mode: "production" as const,
		appPort: 3000,
		proxyPort: 80,
		domain: "revolveroo.example",
		adminPort: 2019,
		hostLabel: () => LABEL,
		frameAncestors: "http://revolveroo.example",
		...overrides,
	};
}

let warnSpy: ReturnType<typeof spyOn>;
beforeEach(() => {
	warnSpy = spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
	warnSpy.mockRestore();
});

describe("buildCaddyfile", () => {
	test("production mode always includes the root block, even with no tabs and no domain", () => {
		// Arrange
		const opts = options({ domain: undefined });

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).toContain("http://:80 {");
		expect(result).toContain("reverse_proxy 127.0.0.1:3000");
	});

	test("development mode omits the root block", () => {
		// Arrange
		const opts = options({
			mode: "development",
			proxyPort: 8080,
			domain: undefined,
		});

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).not.toContain("reverse_proxy 127.0.0.1:3000");
	});

	test("emits no per-tab or wildcard blocks when domain is unset, regardless of useProxy", () => {
		// Arrange
		const opts = options({
			domain: undefined,
			tabs: [tab({ useProxy: true })],
		});

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).not.toContain(LABEL);
		expect(result).not.toContain("respond 404");
	});

	test("addresses a proxied tab by its opaque label and never by its id", () => {
		// Arrange
		const opts = options({ tabs: [tab({ id: "grafana", useProxy: true })] });

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).toContain(`http://${LABEL}.revolveroo.example:80 {`);
		expect(result).not.toContain("grafana");
	});

	test("proxies every request straight through to the tab's origin, path and query untouched", () => {
		// Arrange
		const opts = options({
			tabs: [
				tab({
					url: "http://ha.internal:8123/tablet-view/weather?kiosk",
					useProxy: true,
				}),
			],
		});

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).not.toContain("rewrite");
		expect(result).toContain("reverse_proxy http://ha.internal:8123 {");
		expect(result).toContain(
			"header_up Host {http.reverse_proxy.upstream.hostport}",
		);
	});

	test("strips upstream framing headers and adds its own frame-ancestors allowlist", () => {
		// Arrange
		const opts = options({
			tabs: [tab({ useProxy: true })],
			frameAncestors: "http://revolveroo.example http://revolveroo.example:*",
		});

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).toContain("header_down -X-Frame-Options");
		expect(result).toContain(
			'header_down Content-Security-Policy "frame-ancestors[^;]*;?\\s*" ""',
		);
		expect(result).toContain(
			'+Content-Security-Policy "frame-ancestors http://revolveroo.example http://revolveroo.example:*"',
		);
	});

	test("hardens responses: same-origin referrer policy and no Server/Via disclosure", () => {
		// Arrange
		const opts = options({ tabs: [tab({ useProxy: true })] });

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).toContain("Referrer-Policy same-origin");
		expect(result).toContain("-Server");
		expect(result).toContain("-Via");
	});

	test("refuses document navigations that don't come from the app or the proxied host itself", () => {
		// Arrange
		const opts = options({
			tabs: [tab({ useProxy: true })],
			frameAncestors: "http://revolveroo.example",
		});

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).toContain("header Upgrade-Insecure-Requests *");
		expect(result).toContain(
			'not header_regexp Referer "^(?:http://revolveroo\\.example|',
		);
		expect(result).toContain("respond @direct 403");
	});

	test("answers every other host under the domain with a 404", () => {
		// Arrange
		const opts = options({ tabs: [tab({ useProxy: true })] });

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).toContain(
			"http://*.revolveroo.example:80 {\n\trespond 404\n}",
		);
	});

	test("skips a tab with an unparseable URL instead of failing the whole config", () => {
		// Arrange
		const opts = options({
			tabs: [
				tab({ id: "broken", url: "not a url", useProxy: true }),
				tab({ id: "fine", url: "http://ok.internal/", useProxy: true }),
			],
			hostLabel: (t: Tab) =>
				t.id === "fine" ? LABEL : "ffffffffffffffffffffffff",
		});

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).toContain(`http://${LABEL}.revolveroo.example:80 {`);
		expect(result).not.toContain("ffffffffffffffffffffffff");
		expect(warnSpy).toHaveBeenCalled();
	});

	test("skips a tab whose URL isn't http(s)", () => {
		// Arrange
		const opts = options({
			tabs: [tab({ url: "file:///etc/passwd", useProxy: true })],
		});

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).not.toContain(LABEL);
		expect(warnSpy).toHaveBeenCalled();
	});

	test("excludes tabs that don't have useProxy set, even when domain is configured", () => {
		// Arrange
		const opts = options({ tabs: [tab({ useProxy: false })] });

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).not.toContain(LABEL);
	});

	test("development mode with a domain emits per-tab and wildcard blocks but no root block", () => {
		// Arrange
		const opts = options({
			mode: "development",
			proxyPort: 8080,
			domain: "localtest.me",
			tabs: [tab({ useProxy: true })],
		});

		// Act
		const result = buildCaddyfile(opts);

		// Assert
		expect(result).toContain(`http://${LABEL}.localtest.me:8080 {`);
		expect(result).toContain("http://*.localtest.me:8080 {");
		expect(result).not.toContain("reverse_proxy 127.0.0.1:3000");
	});
});

describe("resolveFrameAncestors", () => {
	test("defaults to the proxy domain, any port, when no origins are configured", () => {
		// Arrange / Act
		const result = resolveFrameAncestors("revolveroo.example", undefined);

		// Assert
		expect(result).toBe(
			"http://revolveroo.example http://revolveroo.example:*",
		);
	});

	test("uses the configured origins verbatim, space-separated", () => {
		// Arrange / Act
		const result = resolveFrameAncestors(
			"revolveroo.example",
			"http://192.168.1.20, http://localhost:5173",
		);

		// Assert
		expect(result).toBe("http://192.168.1.20 http://localhost:5173");
	});

	test("drops entries that could inject into the CSP header and warns", () => {
		// Arrange / Act
		const result = resolveFrameAncestors(
			"revolveroo.example",
			"http://ok.example, http://evil.example; script-src *, 'none'",
		);

		// Assert
		expect(result).toBe("http://ok.example");
		expect(warnSpy).toHaveBeenCalled();
	});

	test("falls back to the default when every configured entry is invalid", () => {
		// Arrange / Act
		const result = resolveFrameAncestors("revolveroo.example", "nonsense");

		// Assert
		expect(result).toBe(
			"http://revolveroo.example http://revolveroo.example:*",
		);
	});
});

describe("buildRefererPattern", () => {
	const SELF = "0123456789abcdef01234567.revolveroo.example";
	const matches = (frameAncestors: string, referer: string) =>
		new RegExp(buildRefererPattern(frameAncestors, SELF)).test(referer);

	test("accepts the app's origin, with or without a path", () => {
		// Arrange
		const allowed = "http://revolveroo.example";

		// Act / Assert
		expect(matches(allowed, "http://revolveroo.example/")).toBe(true);
		expect(matches(allowed, "http://revolveroo.example/settings?x=1")).toBe(
			true,
		);
	});

	test("accepts the proxied host itself on any port, so in-frame link clicks work", () => {
		// Arrange / Act / Assert
		expect(matches("http://revolveroo.example", `http://${SELF}/`)).toBe(true);
		expect(
			matches("http://revolveroo.example", `http://${SELF}:8080/page`),
		).toBe(true);
	});

	test("honours an explicit port and a wildcard port", () => {
		// Arrange / Act / Assert
		expect(matches("http://localhost:5173", "http://localhost:5173/")).toBe(
			true,
		);
		expect(matches("http://localhost:5173", "http://localhost:3000/")).toBe(
			false,
		);
		expect(
			matches("http://revolveroo.example:*", "http://revolveroo.example:8123/"),
		).toBe(true);
	});

	test("honours a wildcard subdomain", () => {
		// Arrange / Act / Assert
		expect(
			matches("http://*.kiosks.example", "http://tablet1.kiosks.example/"),
		).toBe(true);
		expect(matches("http://*.kiosks.example", "http://kiosks.example/")).toBe(
			false,
		);
	});

	test("rejects other sites and look-alike origins", () => {
		// Arrange
		const allowed = "http://revolveroo.example";

		// Act / Assert
		expect(matches(allowed, "http://evil.example/")).toBe(false);
		expect(matches(allowed, "http://revolveroo.example.evil.example/")).toBe(
			false,
		);
		expect(matches(allowed, "http://evilrevolveroo.example/")).toBe(false);
		expect(matches(allowed, "http://revolveroo.example@evil.example/")).toBe(
			false,
		);
		expect(matches(allowed, "https://revolveroo.example/")).toBe(false);
	});

	test("treats regex metacharacters in a host literally", () => {
		// Arrange / Act / Assert
		expect(matches("http://a.example", "http://aXexample/")).toBe(false);
	});
});
