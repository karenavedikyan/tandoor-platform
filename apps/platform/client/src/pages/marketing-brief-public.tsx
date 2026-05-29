import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { BrandBriefView } from "@/components/marketing-brief/brand-brief-view";
import { Button } from "@/components/ui/button";
import { buildHashPath } from "@/lib/hash-route-utils";
import {
  fetchPublicBrief,
  MarketingBriefPublicFetchError,
  type MarketingBriefBlockRow,
  type MarketingBriefRow,
} from "@/lib/marketing-briefs-api";

export default function MarketingBriefPublicPage() {
  const [, setLocation] = useLocation();
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
            setLocation(buildHashPath("/login", { next: `/marketing-briefs/public/${id}` }));
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
  }, [id, setLocation]);

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
    <div className="min-h-screen bg-background" data-testid="page-marketing-brief-public">
      <BrandBriefView brief={brief} blocks={blocks} showPrint showShare onBriefChange={setBrief} />
    </div>
  );
}
