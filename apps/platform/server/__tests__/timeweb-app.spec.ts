import { afterEach, describe, expect, it, vi } from "vitest";
import { createTimewebApp, type ApiRoute } from "../timeweb-app";
import type { Server } from "node:http";
const servers: Server[] = [];
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(servers.splice(0).map(s => new Promise<void>(r => s.close(() => r())))); });
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
    vi.stubEnv("LK_MIGRATION_READ_ONLY", "1");
    expect((await fetch(url + "/api/auth/employee-preview-start", { method: "POST" })).status).not.toBe(503);
    expect((await fetch(url + "/api/auth/employee-preview-stop", { method: "POST" })).status).not.toBe(503);
    expect((await fetch(url + "/api/health")).status).toBe(200);
  });
  it("source transfer is disabled without a configured token", async()=>{
    vi.stubEnv("MIGRATION_OPERATOR_TOKEN","");
    const url=await serve([]);
    expect((await fetch(url+"/api/internal/migration/source/clients.json")).status).toBe(404);
  });
  it("source transfer rejects wrong and unicode credentials without server error", async()=>{
    vi.stubEnv("MIGRATION_OPERATOR_TOKEN","a".repeat(64));
    const url=await serve([]);
    for(const token of ["b".repeat(64),"é".repeat(64)]) {
      expect((await fetch(url+"/api/internal/migration/source/clients.json",{headers:{authorization:"Bearer "+token}})).status).toBe(404);
    }
  });
  it("valid transfer credential cannot read arbitrary paths", async()=>{
    vi.stubEnv("MIGRATION_OPERATOR_TOKEN","a".repeat(64));
    const url=await serve([]);
    for(const file of ["passwords.json",".env","%2e%2e%2fetc%2fpasswd"]) {
      expect((await fetch(url+"/api/internal/migration/source/"+file,{headers:{authorization:"Bearer "+"a".repeat(64)}})).status).toBe(404);
    }
  });
});
