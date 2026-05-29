/**
 * OG HTML для /p/brief/:id — мессенджеры читают meta-теги; люди редиректятся в SPA.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../../../shared/admin/admin-auth.js";
import {
  buildOgDescription,
  buildOgTitle,
  escapeHtml,
  fetchBriefForOg,
  parseBriefOgId,
} from "../../../shared/marketing-brief-og.js";

function requestOrigin(req: VercelRequest): string {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "tandoor-platform.vercel.app");
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0]?.trim() || "https";
  return `${proto}://${host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = parseBriefOgId(req.query.id);
  if (!id) {
    res.status(400).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("bad id");
    return;
  }

  const pool = getPool();
  if (!pool) {
    res.status(503).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("database unavailable");
    return;
  }

  const brief = await fetchBriefForOg(pool, id);
  const origin = requestOrigin(req);
  const canonicalUrl = `${origin}/p/brief/${id}`;
  const wantsPrint = req.query.print === "1";
  const spaUrl = wantsPrint
    ? `${origin}/?print=1#/marketing-briefs/public/${id}`
    : `${origin}/#/marketing-briefs/public/${id}`;
  const imageUrl = `${origin}/api/og/brief-image/${id}`;

  if (!brief) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    res.status(404).end(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Бриф не найден — TANDOOR</title>
  <meta property="og:title" content="Бриф не найден — TANDOOR" />
  <meta property="og:site_name" content="TANDOOR" />
</head>
<body><p>Бриф не найден.</p></body>
</html>`);
    return;
  }

  const title = escapeHtml(buildOgTitle(brief));
  const description = escapeHtml(buildOgDescription(brief));

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.status(200).end(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="TANDOOR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(spaUrl)}" />
  <script>location.replace(${JSON.stringify(spaUrl)});</script>
</head>
<body>
  <p>Открываем бриф… <a href="${escapeHtml(spaUrl)}">Открыть</a></p>
</body>
</html>`);
}
