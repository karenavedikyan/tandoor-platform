import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  fetchMarketingBriefFeed,
  markMarketingBriefViewed,
  type MarketingBriefFeedItem,
} from "@/lib/marketing-briefs-api";
import { isBriefNew } from "@/lib/marketing-briefs-utils";
import { CategoryBadge } from "@/components/marketing/CategoryBadge";
import { cn } from "@/lib/utils";

const MINIMIZED_LS_KEY = "marketing_carousel_minimized";

function isMarketingBriefsRoute(path: string): boolean {
  const p = path.split("?")[0] ?? path;
  return p === "/marketing-briefs" || p.startsWith("/marketing-briefs/");
}

function readMinimized(): boolean {
  try {
    return localStorage.getItem(MINIMIZED_LS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMinimized(value: boolean): void {
  try {
    if (value) localStorage.setItem(MINIMIZED_LS_KEY, "1");
    else localStorage.removeItem(MINIMIZED_LS_KEY);
  } catch {
    /* ignore */
  }
}

function CarouselCard({
  item,
  onOpen,
}: {
  item: MarketingBriefFeedItem;
  onOpen: (id: string) => void;
}) {
  const isNew = !item.viewed_by_current_user && isBriefNew(item.published_at);

  return (
    <article
      className="relative flex h-[140px] w-[calc(100vw-2rem)] shrink-0 snap-center flex-row gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-sm sm:w-[280px]"
      data-testid={`carousel-brief-card-${item.id}`}
    >
      <div className="h-[100px] w-[100px] shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.cover_image_url ? (
          <img src={item.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Нет фото</div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="space-y-1">
          <CategoryBadge category={item.category} />
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-[#222631]">{item.title}</h4>
          {item.summary ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
          ) : null}
        </div>
        {isNew ? (
          <span className="inline-flex w-fit rounded-full bg-[#9ACA3C] px-2 py-0.5 text-xs font-medium text-[#222631]">
            Новое
          </span>
        ) : null}
      </div>
      <Link
        href={`/marketing-briefs/${item.id}`}
        className="absolute inset-0 rounded-xl"
        aria-label={item.title}
        data-testid={`link-carousel-brief-${item.id}`}
        onClick={(e) => {
          e.preventDefault();
          onOpen(item.id);
        }}
      />
      {isNew && !item.viewed_by_current_user ? (
        <span
          className="pointer-events-none absolute right-2 top-2 h-2 w-2 rounded-full bg-[#9ACA3C]"
          aria-hidden
        />
      ) : null}
    </article>
  );
}

export function MarketingTopCarousel() {
  const [location, setLocation] = useLocation();
  const [minimized, setMinimized] = useState(readMinimized);
  const [activeDot, setActiveDot] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["marketing-briefs", "feed", 10],
    queryFn: () => fetchMarketingBriefFeed(10),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const items = data ?? [];

  const onOpen = useCallback(
    async (id: string) => {
      void markMarketingBriefViewed(id).catch(() => undefined);
      void qc.invalidateQueries({ queryKey: ["marketing-briefs", "feed"] });
      setLocation(`/marketing-briefs/${id}`);
    },
    [qc, setLocation],
  );

  const scrollByCard = useCallback((dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-testid^='carousel-brief-card-']");
    const step = card ? card.offsetWidth + 12 : 292;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || items.length === 0) return;

    const onScroll = () => {
      const card = el.querySelector<HTMLElement>("[data-testid^='carousel-brief-card-']");
      const step = card ? card.offsetWidth + 12 : 292;
      const idx = Math.round(el.scrollLeft / step);
      setActiveDot(Math.min(Math.max(idx, 0), items.length - 1));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [items.length]);

  if (isMarketingBriefsRoute(location)) return null;
  if (isError) return null;

  if (isLoading) {
    return (
      <div
        className="mb-4 h-[140px] animate-pulse rounded-xl bg-muted"
        data-testid="widget-marketing-carousel-skeleton"
      />
    );
  }

  if (items.length === 0) return null;

  if (minimized) {
    return (
      <div
        className="mb-4 flex h-8 items-center justify-between rounded-lg border border-border/80 bg-muted/40 px-3 text-sm text-[#222631]"
        data-testid="widget-marketing-carousel-minimized"
      >
        <button
          type="button"
          className="font-medium hover:underline"
          onClick={() => {
            setMinimized(false);
            writeMinimized(false);
          }}
        >
          📢 Маркетинг ({items.length}) — развернуть
        </button>
      </div>
    );
  }

  return (
    <section className="relative mb-4" data-testid="widget-marketing-top-carousel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#222631]">Материалы маркетинга</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="hidden h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-card lg:flex"
            aria-label="Назад"
            onClick={() => scrollByCard(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="hidden h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-card lg:flex"
            aria-label="Вперёд"
            onClick={() => scrollByCard(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Свернуть"
            data-testid="button-marketing-carousel-minimize"
            onClick={() => {
              setMinimized(true);
              writeMinimized(true);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <CarouselCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>

      <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
        {items.map((item, i) => (
          <span
            key={item.id}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              i === activeDot ? "bg-[#9ACA3C]" : "bg-muted-foreground/30",
            )}
          />
        ))}
      </div>
    </section>
  );
}
