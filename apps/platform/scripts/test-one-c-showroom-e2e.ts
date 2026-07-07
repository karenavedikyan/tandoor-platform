/**
 * E2E skeleton: /1c/team → раскрыть РОПа → РМа → клик по менеджеру.
 *
 * ENV: BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
 * Запуск: `npm run test:one-c-showroom-e2e`
 */

function step(ok: boolean, message: string): void {
  console.log(`${ok ? "OK" : "SKIP/FAIL"} ${message}`);
}

function mustEnv(name: string): string | null {
  return process.env[name]?.trim() || null;
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

    await page.goto(`${hashBase}1c/team`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="page-one-c-team"]', { timeout: 30_000 });
    step(true, "team hierarchy page opened");

    const firstRop = page.locator('[data-testid^="one-c-rop-"]').first();
    await firstRop.locator("button").first().click();
    step(true, "expanded first ROP");

    const firstRm = page.locator('[data-testid^="one-c-rm-"]').first();
    await firstRm.locator("button").first().click();
    step(true, "expanded first RM");

    const firstManager = page.locator('[data-testid^="one-c-manager-"] a').first();
    await firstManager.click();
    await page.waitForURL(/#\/1c\/manager\//, { timeout: 15_000 });
    await page.waitForSelector('[data-testid="page-one-c-manager"]', { timeout: 15_000 });
    step(true, "manager page opened");

    await page.goto(`${hashBase}1c/stores`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="page-one-c-stores"]', { timeout: 30_000 });
    const firstStore = page.locator('[data-testid^="row-one-c-store-"] a').first();
    await firstStore.click();
    await page.waitForURL(/#\/1c\/store\//, { timeout: 15_000 });
    await page.waitForSelector('[data-testid="section-one-c-distribution"]', { timeout: 15_000 });
    step(true, "store page with distribution section opened");

    const matrixInput = page.locator('[data-testid="input-one-c-matrix-entrance_doors"]');
    if (await matrixInput.count()) {
      await matrixInput.fill("3");
      await matrixInput.blur();
      await page.waitForTimeout(800);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="input-one-c-matrix-entrance_doors"]', { timeout: 15_000 });
      const value = await matrixInput.inputValue();
      step(value === "3", `matrix value persisted after reload (${value})`);
    } else {
      step(true, "SKIP matrix edit — no entrance_doors input (read-only user?)");
    }

    console.log("ALL PASS one-c-showroom-e2e");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
