import { afterEach, describe, expect, it } from "vitest";
import { createTimewebApp, type ApiRoute } from "../timeweb-app";
import type { Server } from "node:http";
const servers: Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => new Promise<void>(r => s.close(() => r())))); });
async function serve(routes: ApiRoute[]) {
  const app = createTimewebApp(routes);
  const s = app.listen(0, "127.0.0.1"); servers.push(s);
  await new Promise<void>(r => s.listening ? r() : s.once("listening", r));
  return `http://127.0.0.1:${(s.address() as any).port}`;
}
describe("Timeweb API compatibility", () => {
  it("maps dynamic params and repeated query values without query override", async () => {
    const url = await serve([{ path: "/api/example/:action", load: async () => ({
      default: (req, res) => res.json(req.query),
    }) }]);
    const response = await fetch(url + "/api/example/list?action=delete&filter=A&filter=B");
    expect(await response.json()).toEqual({ action: "list", filter: ["A", "B"] });
  });
  it("parses login JSON and cookies", async () => {
    const url = await serve([{ path: "/api/auth/:action", load: async () => ({
      default: (req, res) => res.json({ body: req.body, cookies: req.cookies }),
    }) }]);
    const response = await fetch(url + "/api/auth/login", { method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "test=a%20b" }, body: '{"email":"synthetic@example.invalid"}' });
    expect(await response.json()).toEqual({ body: { email: "synthetic@example.invalid" }, cookies: { test: "a b" } });
  });
  it("does not expose unknown API paths as HTML and blocks cron and writes", async () => {
    const url = await serve([]);
    expect((await fetch(url + "/api/no-such-route")).status).toBe(404);
    expect((await fetch(url + "/api/cron/sync-catalog-1c")).status).toBe(503);
    expect((await fetch(url + "/api/admin/migrate")).status).toBe(503);
    expect((await fetch(url + "/api/dealers/save", { method: "POST" })).status).toBe(503);
    expect((await fetch(url + "/api/health")).status).toBe(200);
  });
});
