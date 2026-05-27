/**
 * E2E: менеджер Скляров видит непустую /dealer-base (real-режим).
 *
 * ENV (обязательны для запуска):
 *   BASE_URL — например https://tandoor-platform.vercel.app
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD
 *
 * Запуск: `npm run test:manager-dealer-base-e2e` из apps/platform
 * (требует `npx playwright install chromium` при первом запуске).
 */

const SKLYAROV_UUID = "dc958e02-d80e-4615-bb8a-8a46be70daed";

type Json = Record<string, unknown>;

function step(ok: boolean, message: string): void {
  console.log(`${ok ? "OK" : "FAIL"} ${message}`);
}

function mergeCookieJar(prev: string, setCookie: string | null): string {
  if (!setCookie) return prev;
  const jar = new Map<string, string>();
  for (const part of prev.split(";").map((p) => p.trim()).filter(Boolean)) {
    const idx = part.indexOf("=");
    if (idx > 0) jar.set(part.slice(0, idx), part.slice(idx + 1));
  }
  const segments = setCookie.split(/,(?=[^;]+=)/);
  for (const seg of segments) {
    const first = seg.split(";")[0]?.trim();
    if (!first) continue;
    const idx = first.indexOf("=");
    if (idx > 0) jar.set(first.slice(0, idx), first.slice(idx + 1));
  }
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function readJson(res: Response): Promise<Json> {
  const t = await res.text();
  if (!t) return {};
  try {
    return JSON.parse(t) as Json;
  } catch {
    return {};
  }
}

function mustEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

function originFromBaseUrl(base: string): string {
  const u = new URL(base.includes("://") ? base : `https://${base}`);
  return u.origin;
}

function cookieHeaderToPlaywright(cookieHeader: string, url: string) {
  const origin = new URL(url).origin;
  const hostname = new URL(url).hostname;
  const cookies = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf("=");
      if (idx <= 0) return null;
      return {
        name: part.slice(0, idx),
        value: part.slice(idx + 1),
        url: origin,
        domain: hostname,
        path: "/",
        httpOnly: true,
        secure: origin.startsWith("https"),
        sameSite: "Lax" as const,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c != null);
  return { cookies };
}

async function main(): Promise<void> {
  const base = (process.env.BASE_URL?.trim() || "").replace(/\/$/, "");
  if (!base) {
    console.log("SKIP: set BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD for live Playwright e2e");
    process.exit(0);
  }
  const origin = originFromBaseUrl(base);
  const adminEmail = mustEnv("ADMIN_EMAIL");
  const adminPassword = mustEnv("ADMIN_PASSWORD");

  let cookie = "";
  const headersBase = {
    "Content-Type": "application/json",
    Origin: origin,
  } as Record<string, string>;

  {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: headersBase,
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const body = await readJson(res);
    if (!res.ok || body.success !== true) {
      step(false, `admin login status=${res.status}`);
      process.exit(1);
    }
    cookie = mergeCookieJar("", res.headers.get("set-cookie"));
    step(true, "admin login");
  }

  {
    const res = await fetch(`${base}/api/auth/impersonate-start`, {
      method: "POST",
      headers: { ...headersBase, Cookie: cookie },
      body: JSON.stringify({ targetUserId: SKLYAROV_UUID }),
    });
    const body = await readJson(res);
    if (!res.ok || body.success !== true) {
      step(false, `impersonate-start status=${res.status}`);
      process.exit(1);
    }
    cookie = mergeCookieJar(cookie, res.headers.get("set-cookie"));
    step(true, "impersonate Sklyarov");
  }

  let chromium: { launch: (opts: { headless: boolean }) => Promise<{ newContext: (o: object) => Promise<{ newPage: () => Promise<PlaywrightPage> }>; close: () => Promise<void> }> };
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    console.error("FAIL: install playwright — npx playwright install chromium");
    process.exit(1);
  }

  type PlaywrightPage = {
    goto: (url: string, opts: object) => Promise<void>;
    getByText: (re: RegExp) => { first: () => { textContent: (o: object) => Promise<string | null>; isVisible: () => Promise<boolean> } };
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(cookieHeaderToPlaywright(cookie, `${origin}/`));
  const page = await context.newPage();

  await page.goto(`${origin}/#/dealer-base`, { waitUntil: "networkidle", timeout: 120_000 });

  const totalText = await page.getByText(/Всего клиентов/i).first().textContent({ timeout: 60_000 }).catch(() => "");
  const outletsText = await page.getByText(/Торговые точки/i).first().textContent({ timeout: 10_000 }).catch(() => "");
  const emptyList = await page.getByText(/Нет клиентов по выбранным фильтрам/i).first().isVisible().catch(() => false);

  const totalMatch = totalText?.match(/(\d+)/);
  const total = totalMatch ? Number(totalMatch[1]) : 0;
  const outletsMatch = outletsText?.match(/(\d+)/);
  const outlets = outletsMatch ? Number(outletsMatch[1]) : 0;

  step(total >= 40, `KPI Всего клиентов >= 40 (got ${total})`);
  step(outlets >= 50, `KPI Торговые точки >= 50 (got ${outlets})`);
  step(!emptyList, "список клиентов не пустой");

  await fetch(`${base}/api/auth/impersonate-stop`, {
    method: "POST",
    headers: { ...headersBase, Cookie: cookie },
    body: "{}",
  }).catch(() => {});

  await browser.close();

  if (total < 40 || outlets < 50 || emptyList) process.exit(1);
  console.log("ALL PASS manager-dealer-base-e2e");
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
