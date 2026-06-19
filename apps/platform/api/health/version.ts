/**
 * Промт 434: публичный endpoint с метаданными текущего билда.
 * Используется клиентом для автодетекта новой версии.
 * Никакой auth, никакой БД. Кешировать НЕ нужно — отвечать всегда свежо.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ success: false, code: "METHOD_NOT_ALLOWED" });
    return;
  }

  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
  const deployment = process.env.VERCEL_DEPLOYMENT_ID ?? "dev";
  const builtAt = process.env.VERCEL_DEPLOYMENT_CREATED_AT ?? null;

  // Антикеш: каждый ответ должен быть свежим (без CDN cache).
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.status(200).json({
    success: true,
    commit,
    deployment,
    builtAt,
  });
}
