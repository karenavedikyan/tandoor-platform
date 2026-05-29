import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { BrandBriefView } from "@/components/marketing-brief/brand-brief-view";
import { fetchPublicBrief, type MarketingBriefBlockRow, type MarketingBriefRow } from "@/lib/marketing-briefs-api";

export default function MarketingBriefPublicPage() {
  const [, params] = useRoute("/p/brief/:id");
  const id = params?.id ?? "";

  const [brief, setBrief] = useState<MarketingBriefRow | null>(null);
  const [blocks, setBlocks] = useState<MarketingBriefBlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
      try {
        const data = await fetchPublicBrief(id);
        if (!cancelled) {
          setBrief(data.brief);
          setBlocks(data.blocks);
        }
      } catch {
        if (!cancelled) {
          setBrief(null);
          setBlocks([]);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" data-testid="page-marketing-brief-public">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
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
          Бриф не найден, не опубликован или приватный
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
