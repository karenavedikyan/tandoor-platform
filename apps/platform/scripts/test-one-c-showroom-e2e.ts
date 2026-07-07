/**
 * E2E skeleton: /1c → /1c/team → клик по менеджеру → /1c/manager/[id].
 *
 * ENV (обязательны для запуска):
 *   BASE_URL — например https://lk.tandoor.ru
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD
 *
 * Запуск: `npm run test:one-c-showroom-e2e` из apps/platform
 * (требует `npx playwright install chromium` при первом запуске).
 */

function step(ok: boolean, message: string): void {
  console.log(`${ok ? "OK" : "SKIP/FAIL"} ${message}`);
}

function mustEnv(name: string): string | null {
  const v = process.env[name]?.trim();
  return v || null;
}

async function main(): Promise<void> {
  const baseUrl = mustEnv("BASE_URL");
  const email = mustEnv("ADMIN_EMAIL");
  const password = mustEnv("ADMIN_PASSWORD");

  if (!baseUrl || !email || !password) {
    step(true, "SKIP: set BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD for live Playwright e2e");
    process.exit(0);
  }

  const origin = new URL(baseUrl.includes("://") ? baseUrl : `https://${baseUrl}`).origin;
  const hashBase = `${origin}/#/`;

  let chromium: {
    launch: (opts: { headless: boolean }) => Promise<{
      newContext: () => Promise<{
        newPage: () => Promise<{
          goto: (url: string, opts?: object) => Promise<void>;
          fill: (selector: string, value: string) => Promise<void>;
          click: (selector: string) => Promise<void>;
          waitForURL: (pattern: RegExp, opts?: object) => Promise<void>;
          waitForSelector: (selector: string, opts?: object) => Promise<void>;
          locator: (selector: string) => {
            first: () => {
              getAttribute: (name: string) => Promise<string | null>;
              click: () => Promise<void>;
            };
          };
        }>;
      }>;
      close: () => Promise<void>;
    }>;
  };
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    console.error("FAIL: install playwright — npx playwright install chromium");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${origin}/#/login`, { waitUntil: "domcontentloaded" });
    await page.fill('[data-testid="input-login-email"]', email);
    await page.fill('[data-testid="input-login-password"]', password);
    await page.click('[data-testid="button-login-submit"]');
    await page.waitForURL(/#\/(dealer-base|admin)/, { timeout: 60_000 });

    await page.goto(`${hashBase}1c`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="page-one-c-overview"]', { timeout: 30_000 });
    step(true, "overview page opened");

    await page.click('[data-testid="card-one-c-team"]');
    await page.waitForURL(/#\/1c\/team/, { timeout: 15_000 });
    await page.waitForSelector('[data-testid="page-one-c-team"]', { timeout: 15_000 });
    step(true, "team list opened");

    const firstManagerLink = page.locator('[data-testid^="row-one-c-manager-"] a').first();
    const managerHref = await firstManagerLink.getAttribute("href");
    if (!managerHref) throw new Error("no manager link in team table");
    await firstManagerLink.click();
    await page.waitForURL(/#\/1c\/manager\//, { timeout: 15_000 });
    await page.waitForSelector('[data-testid="page-one-c-manager"]', { timeout: 15_000 });
    step(true, `manager page opened (${managerHref})`);

    console.log("ALL PASS one-c-showroom-e2e");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
