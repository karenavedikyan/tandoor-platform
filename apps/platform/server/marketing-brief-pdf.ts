/**
 * PDF generation via headless Chromium rendering the public preview page.
 * Same HTML → same look as /p/brief/:id.
 */
import type { MarketingBriefBlockRow, MarketingBriefRow } from "../shared/marketing-briefs-types.js";

export type BriefPdfTheme = "light" | "dark";

export type BriefPdfRenderOptions = {
  baseUrl?: string;
};

export async function renderBriefPdf(
  brief: MarketingBriefRow,
  _blocks: MarketingBriefBlockRow[],
  theme: BriefPdfTheme = "dark",
  options?: BriefPdfRenderOptions,
): Promise<Buffer> {
  const [{ default: chromium }, puppeteer] = await Promise.all([
    import("@sparticuz/chromium-min"),
    import("puppeteer-core"),
  ]);

  const remotePackUrl = process.env.CHROMIUM_REMOTE_EXEC_PATH?.trim();
  if (!remotePackUrl) {
    throw new Error("CHROMIUM_REMOTE_EXEC_PATH env var is required for PDF generation");
  }

  const baseUrl =
    options?.baseUrl ??
    process.env.PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://tandoor-platform.vercel.app");

  const url = `${baseUrl.replace(/\/$/, "")}/p/brief/${encodeURIComponent(brief.id)}?print=1&pdf=1&theme=${theme}`;

  const browser = await puppeteer.default.launch({
    args: chromium.args,
    defaultViewport: { width: 1200, height: 1600, deviceScaleFactor: 2 },
    executablePath: await chromium.executablePath(remotePackUrl),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 25_000 });
    await page.waitForSelector('[data-testid="brand-brief-view"]', { timeout: 25_000 });
    await page.evaluateHandle("document.fonts.ready");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "16mm", left: "12mm" },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="font-size:8px;color:#888;width:100%;padding:0 12mm;display:flex;justify-content:space-between;">
          <span>TANDOOR · ${escapeHtml(brief.title)}</span>
          <span class="pageNumber"></span>/<span class="totalPages"></span>
        </div>`,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
