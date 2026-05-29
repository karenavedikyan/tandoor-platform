/**
 * Динамическая OG-картинка 1200×630 для /p/brief/:id
 */

import { ImageResponse } from "@vercel/og";
import {
  briefShowsTitleOnOgImage,
  fetchBriefForOgEdge,
  formatMarketingBriefPeriodLabel,
  parseBriefOgId,
} from "../../../shared/marketing-brief-og.js";

export const config = {
  runtime: "edge",
};

function idFromRequest(req: Request): string | null {
  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return parseBriefOgId(last);
}

export default async function handler(req: Request): Promise<Response> {
  const id = idFromRequest(req);
  if (!id) {
    return new Response("bad id", { status: 400 });
  }

  const brief = await fetchBriefForOgEdge(id);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "tandoor-platform.vercel.app";
  const showTitle = brief ? briefShowsTitleOnOgImage(brief) : false;
  const accent = brief?.accent_color ?? "#9ACA3C";
  const title = showTitle && brief ? (brief.title.trim() || "Без названия") : "Бриф TANDOOR";
  const period =
    showTitle && brief ? formatMarketingBriefPeriodLabel(brief.period_label) : "Внутренний маркетинговый бриф";
  const subtitle = showTitle ? "" : "Для просмотра требуется вход в ЛК";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: accent,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 32, color: "#ffffff", opacity: 0.9, letterSpacing: 4 }}>БРИФ TANDOOR</div>
        <div
          style={{
            fontSize: showTitle ? 72 : 56,
            color: "#222631",
            fontWeight: 700,
            marginTop: 32,
            lineHeight: 1.1,
            maxWidth: "100%",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 36, color: "#222631", marginTop: 16, opacity: 0.9 }}>{period}</div>
        {subtitle ? (
          <div style={{ fontSize: 28, color: "#ffffff", marginTop: 12, opacity: 0.95 }}>{subtitle}</div>
        ) : null}
        <div style={{ marginTop: "auto", fontSize: 26, color: "#ffffff", opacity: 0.85 }}>{host}</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
