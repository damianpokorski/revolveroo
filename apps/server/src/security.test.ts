import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { crossSiteWriteGuard, isCrossSiteWrite } from "./security";

function req(method: string, headers: Record<string, string> = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
  };
}

const prod = { allowLocalOrigins: false };
const dev = { allowLocalOrigins: true };

describe("isCrossSiteWrite", () => {
  test("never blocks reads", () => {
    // Arrange
    const request = req("GET", {
      "Sec-Fetch-Site": "cross-site",
      Origin: "http://evil.example",
    });

    // Act
    const blocked = isCrossSiteWrite(request, prod);

    // Assert
    expect(blocked).toBe(false);
  });

  test("blocks a write the browser marks cross-site", () => {
    // Arrange
    const request = req("POST", {
      "Sec-Fetch-Site": "cross-site",
      Host: "revolveroo.lan",
    });

    // Act
    const blocked = isCrossSiteWrite(request, prod);

    // Assert
    expect(blocked).toBe(true);
  });

  test("allows a same-origin write", () => {
    // Arrange
    const request = req("PUT", {
      "Sec-Fetch-Site": "same-origin",
      Origin: "http://revolveroo.lan",
      Host: "revolveroo.lan",
    });

    // Act
    const blocked = isCrossSiteWrite(request, prod);

    // Assert
    expect(blocked).toBe(false);
  });

  test("blocks a write from a sibling subdomain even though the browser calls it same-site", () => {
    // Arrange: e.g. a proxied service page calling the app's API
    const request = req("POST", {
      "Sec-Fetch-Site": "same-site",
      Origin: "http://abc123.revolveroo.lan",
      Host: "revolveroo.lan",
    });

    // Act
    const blocked = isCrossSiteWrite(request, prod);

    // Assert
    expect(blocked).toBe(true);
  });

  test("blocks an opaque (null) origin", () => {
    // Arrange
    const request = req("DELETE", { Origin: "null", Host: "revolveroo.lan" });

    // Act
    const blocked = isCrossSiteWrite(request, prod);

    // Assert
    expect(blocked).toBe(true);
  });

  test("allows callers that send neither header (curl, scripts)", () => {
    // Arrange
    const request = req("POST", { Host: "revolveroo.lan" });

    // Act
    const blocked = isCrossSiteWrite(request, prod);

    // Assert
    expect(blocked).toBe(false);
  });

  test("allows the origin a rewriting front proxy reports via X-Forwarded-Host", () => {
    // Arrange
    const request = req("POST", {
      Origin: "https://dash.example.com",
      Host: "revolveroo:80",
      "X-Forwarded-Host": "dash.example.com",
    });

    // Act
    const blocked = isCrossSiteWrite(request, prod);

    // Assert
    expect(blocked).toBe(false);
  });

  test("allows a localhost dev origin in dev but not in production", () => {
    // Arrange
    const request = req("POST", {
      "Sec-Fetch-Site": "same-site",
      Origin: "http://localhost:5173",
      Host: "localhost:3000",
    });

    // Act
    const inDev = isCrossSiteWrite(request, dev);
    const inProd = isCrossSiteWrite(request, prod);

    // Assert
    expect(inDev).toBe(false);
    expect(inProd).toBe(true);
  });
});

describe("crossSiteWriteGuard mounted the way index.ts mounts it", () => {
  // Elysia hooks only cover routes registered after them, so the guard has to sit
  // *before* the router. This builds the same shape (guard, then a prefixed sub-app
  // that owns the routes) and drives real requests through it.
  const buildApp = (allowLocalOrigins: boolean) =>
    new Elysia()
      .use(crossSiteWriteGuard({ allowLocalOrigins }))
      .use(
        new Elysia({ prefix: "/api" })
          .post("/tabs", () => ({ created: true }))
          .get("/tabs", () => []),
      );

  const post = (app: ReturnType<typeof buildApp>, headers: Record<string, string>) =>
    app.handle(
      new Request("http://revolveroo.lan/api/tabs", {
        method: "POST",
        headers,
      }),
    );

  test("rejects a cross-origin write to a route owned by the sub-app", async () => {
    // Arrange
    const app = buildApp(false);

    // Act
    const response = await post(app, {
      Origin: "http://evil.example",
      Host: "revolveroo.lan",
    });

    // Assert
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      status: 403,
      message: "Cross-site request blocked",
    });
  });

  test("lets a same-origin write through", async () => {
    // Arrange
    const app = buildApp(false);

    // Act
    const response = await post(app, {
      Origin: "http://revolveroo.lan",
      Host: "revolveroo.lan",
    });

    // Assert
    expect(response.status).toBe(200);
  });

  test("never interferes with reads", async () => {
    // Arrange
    const app = buildApp(false);

    // Act
    const response = await app.handle(
      new Request("http://revolveroo.lan/api/tabs", {
        headers: { Origin: "http://evil.example" },
      }),
    );

    // Assert
    expect(response.status).toBe(200);
  });
});
