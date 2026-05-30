import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { BrandBriefView } from "@/components/marketing-brief/brand-brief-view";
import { Button } from "@/components/ui/button";
import { buildHashPath, useRouteSearchParams } from "@/lib/hash-route-utils";
import { cn } from "@/lib/utils";
import {
  brandBriefTheme,
  type BrandBriefThemeMode,
} from "@/components/marketing-brief/brand-brief-theme";
import {
  fetchPublicBrief,
  MarketingBriefPublicFetchError,
  type MarketingBriefBlockRow,
  type MarketingBriefRow,
} from "@/lib/marketing-briefs-api";

const FILENAME_UNSAFE_RE = /[/\\:*?"<>|]/g;

function formatBriefPrintDate(brief: MarketingBriefRow): string {
  const iso = brief.published_at || brief.updated_at || brief.created_at;
  const d = iso ? new Date(iso) : new Date();
  const t = d.getTime();
  if (Number.isNaN(t)) {
    return new Date().toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function cleanBriefTitleForFilename(title: string): string {
  return title.replace(FILENAME_UNSAFE_RE, " ").replace(/\s+/g, " ").trim();
}

function buildBriefPrintDocumentTitle(brief: MarketingBriefRow): string {
  const rawTitle = brief.title.trim() || "Без названия";
  const date = formatBriefPrintDate(brief);
  const cleanTitle = cleanBriefTitleForFilename(rawTitle);
  return `TANDOOR ${date} ${cleanTitle}`.trim();
}

function waitForDocumentImages(): Promise<void> {
  return Promise.all(
    Array.from(document.images).map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        setTimeout(done, 8000);
      });
    }),
  ).then(() => undefined);
}

function briefPublicPrintCss(themeMode: BrandBriefThemeMode): string {
  const theme = brandBriefTheme(themeMode);
  return `
@page {
  margin: 10mm;
  size: A4;
}
@media print {
  [data-no-print="true"] { display: none !important; }
  html, body {
    background: ${theme.bg} !important;
    color: ${theme.text} !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .brief-public-shell {
    padding: 0 !important;
    margin: 0 !important;
    background: ${theme.bg} !important;
  }
  [data-print-root] { background: ${theme.bg} !important; }

  [data-brief-block] {
    break-inside: auto;
    page-break-inside: auto;
  }

  [data-brief-block] h2,
  [data-brief-block] h3 {
    break-after: avoid;
    page-break-after: avoid;
  }

  [data-testid^="brand-brief-product-"] {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  [data-brief-block] tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  [data-brief-block] article,
  [data-brief-block] .brief-segment-card,
  [data-brief-block] .brief-bonus-card {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  [data-testid^="brand-brief-callout-"] {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  [data-testid="brand-brief-section"] {
    break-after: avoid;
    page-break-after: avoid;
  }

  img { break-inside: avoid; page-break-inside: avoid; max-width: 100%; }
}
`;
}

export default function MarketingBriefPublicPage() {
  const [, setLocation] = useLocation();
  const routeSearch = useRouteSearchParams();
  const wantsPrint = routeSearch.get("print") === "1";
  const themeParam = routeSearch.get("theme");
  const forcedTheme: BrandBriefThemeMode | undefined =
    themeParam === "dark" || themeParam === "light" ? themeParam : undefined;
  const [, params] = useRoute("/marketing-briefs/public/:id");
  const id = params?.id ?? "";

  const [brief, setBrief] = useState<MarketingBriefRow | null>(null);
  const [blocks, setBlocks] = useState<MarketingBriefBlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setNotFound(false);
      setForbidden(false);
      try {
        const data = await fetchPublicBrief(id);
        if (!cancelled) {
          setBrief(data.brief);
          setBlocks(data.blocks);
        }
      } catch (e) {
        if (cancelled) return;
        setBrief(null);
        setBlocks([]);
        if (e instanceof MarketingBriefPublicFetchError) {
          if (e.reason === "unauthorized") {
            setLocation(
              buildHashPath("/login", {
                next: `/marketing-briefs/public/${id}`,
                ...(wantsPrint ? { print: "1" } : {}),
              }),
            );
            return;
          }
          if (e.reason === "forbidden") {
            setForbidden(true);
            return;
          }
        }
        setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, setLocation, wantsPrint]);

  useEffect(() => {
    if (!wantsPrint || loading || !brief) return;
    let cancelled = false;
    const prevTitle = document.title;
    void (async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
      await waitForDocumentImages();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (cancelled) return;
      document.title = buildBriefPrintDocumentTitle(brief);
      window.print();
    })();
    return () => {
      cancelled = true;
      document.title = prevTitle;
    };
  }, [wantsPrint, loading, brief]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" data-testid="page-marketing-brief-public">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center"
        data-testid="page-marketing-brief-public"
      >
        <p className="text-sm text-muted-foreground" data-testid="text-marketing-brief-public-forbidden">
          Доступ запрещён
        </p>
        <Button asChild variant="outline" data-testid="button-marketing-brief-public-home">
          <Link href="/main">На главную</Link>
        </Button>
      </div>
    );
  }

  if (notFound || !brief) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center"
        data-testid="page-marketing-brief-public"
      >
        <p className="text-sm text-muted-foreground" data-testid="text-marketing-brief-public-not-found">
          Бриф не найден
        </p>
      </div>
    );
  }

  return (
    <>
      {wantsPrint ? <style>{briefPublicPrintCss(forcedTheme ?? "light")}</style> : null}
      <div
        className={cn("brief-public-shell min-h-screen", !wantsPrint && "bg-background")}
        style={
          wantsPrint
            ? { backgroundColor: brandBriefTheme(forcedTheme ?? "light").bg, minHeight: "100vh" }
            : undefined
        }
        data-testid="page-marketing-brief-public"
      >
        <BrandBriefView
          brief={brief}
          blocks={blocks}
          readOnly={wantsPrint}
          embed={wantsPrint}
          showPrint={!wantsPrint}
          showShare={!wantsPrint}
          forcedTheme={forcedTheme}
          onBriefChange={setBrief}
        />
      </div>
    </>
  );
}
