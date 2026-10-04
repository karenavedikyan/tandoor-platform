import express, { type Express, type Request, type Response } from "express";
import path from "node:path";
import crypto from "node:crypto";

export type ApiModule = {
  default: (req: any, res: any) => unknown;
  config?: { api?: { bodyParser?: boolean | { sizeLimit?: string } } };
};
export type ApiRoute = { path: string; load: () => Promise<ApiModule> };

export function createTimewebApp(routes: ApiRoute[], publicDir?: string): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  // Temporary operator-only transfer of explicitly staged source files.
  // Disabled when the deployment's random migration token is removed.
  app.get("/api/internal/migration/source/:file", (req, res) => {
    const token=process.env.MIGRATION_OPERATOR_TOKEN || "";
    const supplied=String(req.headers.authorization || "").replace(/^Bearer /,"");
    if(token.length<32 || supplied.length!==token.length ||
       !crypto.timingSafeEqual(crypto.createHash("sha256").update(token).digest(),
         crypto.createHash("sha256").update(supplied).digest())) {
      res.status(404).json({code:"NOT_FOUND"}); return;
    }
    if(!["manifest.json","clients.json","employees.json","groups.json","groups.xml","sections.xml","products.xml"].includes(String(req.params.file))) {
      res.status(404).json({code:"NOT_FOUND"}); return;
    }
    res.setHeader("Cache-Control","no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    res.sendFile(String(req.params.file),{root:"/tmp/tandoor-lk-source",dotfiles:"deny"});
  });
  app.get("/api/health", (_req, res) => res.json({ ok: true, runtime: "timeweb" }));
  app.get("/api/ready", async (_req, res) => {
    try {
      const { neon } = await import("./timeweb-pg.js");
      const sql = neon(process.env.DATABASE_URL || "");
      await sql("SELECT id FROM users LIMIT 0");
      res.json({ ready: true });
    } catch {
      res.status(503).json({ ready: false });
    }
  });
  app.use((req, res, next) => {
    const pathname = req.path;
    if (/^\/api\/(?:cron(?:\/|$)|admin\/(?:db-migrate|migrate|seed|sync|import|export|ftp|refresh))/.test(pathname)) {
      res.status(503).json({ code: "MIGRATION_OPERATIONS_DISABLED" });
      return;
    }
    if (process.env.LK_MIGRATION_READ_ONLY !== "0" &&
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        !/^\/api\/auth\/(?:login|logout|logout-all|employee-preview-start|employee-preview-stop)$/.test(pathname)) {
      res.status(503).json({ code: "MIGRATION_READ_ONLY", message: "Перенос данных: запись временно отключена." });
      return;
    }
    next();
  });
  app.use(async (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      next();
      return;
    }
    const pathname = req.path;
    if (/^\/api\/auth\/(?:login|logout|logout-all|employee-preview-start|employee-preview-stop)$/.test(pathname)) {
      next();
      return;
    }
    try {
      const { getPool, parseAuthRefreshToken, sha256Hex } = await import("../shared/admin/admin-auth.js");
      const { sessionHasActiveEmployeePreview } = await import("../shared/wholesale-preview-handlers.js");
      const pool = getPool();
      const token = parseAuthRefreshToken(req.headers.cookie);
      if (!pool || !token) {
        next();
        return;
      }
      const hash = sha256Hex(token);
      if (await sessionHasActiveEmployeePreview(pool, hash)) {
        res.status(403).json({
          code: "EMPLOYEE_PREVIEW_READ_ONLY",
          message: "Режим предпросмотра сотрудника: изменяющие операции запрещены.",
        });
        return;
      }
    } catch {
      res.status(503).json({
        code: "EMPLOYEE_PREVIEW_GUARD_UNAVAILABLE",
        message: "Не удалось проверить режим предпросмотра. Запись временно запрещена.",
      });
      return;
    }
    next();
  });
  // Preserve Vercel's explicit rewrites before matching file-system routes.
  app.use((req, _res, next) => {
    if (req.path === "/api/sales-plan-fact/state") {
      const url = new URL(req.url, "http://internal");
      url.pathname = "/api/actualization/state";
      url.searchParams.set("_route", "sales-plan-fact");
      req.url = url.pathname + url.search;
    } else if (req.path.startsWith("/p/brief/")) {
      req.url = "/api" + req.url;
    }
    next();
  });
  for (const route of routes) {
    app.all(route.path, async (req, res, next) => {
      try {
        const handler = await route.load();
        const query: Record<string, string | string[]> = Object.create(null);
        const url = new URL(req.url, "http://internal");
        for (const key of Array.from(new Set(url.searchParams.keys()))) {
          const values = url.searchParams.getAll(key);
          query[key] = values.length === 1 ? values[0] : values;
        }
        Object.assign(query, req.params); // Route parameters cannot be overridden by query.
        Object.defineProperty(req, "query", { value: query, configurable: true });
        (req as any).cookies = Object.fromEntries((req.headers.cookie || "").split(";")
          .map(s => s.trim().split(/=([\s\S]*)/)).filter(p => p.length > 1)
          .map(([k, v]) => {
            try { return [k, decodeURIComponent(v)]; } catch { return [k, v]; }
          }));
        const invoke = () => Promise.resolve(handler.default(req, res)).catch(next);
        if (handler.config?.api?.bodyParser === false) {
          await invoke();
        } else {
          const limit = typeof handler.config?.api?.bodyParser === "object"
            ? handler.config.api.bodyParser.sizeLimit || "1mb" : "1mb";
          const parse = req.is("application/x-www-form-urlencoded")
            ? express.urlencoded({ extended: false, limit })
            : express.json({ limit });
          parse(req, res, (err) => err ? next(err) : void invoke());
        }
      } catch (err) { next(err); }
    });
  }
  app.use("/api", (_req, res) => res.status(404).json({ code: "NOT_FOUND" }));
  if (publicDir) {
    app.use(express.static(publicDir));
    app.get("/{*path}", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
  }
  app.use((err: any, _req: Request, res: Response, _next: unknown) => {
    console.error("[http]", { code: err?.code || null, type: err?.type || null });
    if (!res.headersSent) res.status(err?.status === 413 ? 413 : 500).json({ code: "REQUEST_FAILED" });
  });
  return app;
}
