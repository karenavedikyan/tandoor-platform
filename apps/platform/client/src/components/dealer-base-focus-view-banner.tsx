import { Link } from "wouter";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FocusViewChipMeta } from "@/lib/main-focus-tiles";

export type DealerBaseFocusViewBannerProps = {
  meta: FocusViewChipMeta;
  clientCount: number;
};

export function DealerBaseFocusViewBanner({ meta, clientCount }: DealerBaseFocusViewBannerProps) {
  const nLabel =
    clientCount === 1 ? "1 клиент" : clientCount >= 2 && clientCount <= 4 ? `${clientCount} клиента` : `${clientCount} клиентов`;

  return (
    <div
      className="mb-4 flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2 text-sm"
      data-testid="banner-dealer-base-focus-view"
    >
      <span className="text-base leading-none" aria-hidden>
        {meta.icon}
      </span>
      <span className="min-w-0 font-medium text-foreground">
        {meta.label}
        <span className="font-normal text-muted-foreground"> · {nLabel}</span>
      </span>
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="ml-auto h-8 w-8 shrink-0 text-muted-foreground"
        data-testid="button-dealer-base-focus-clear"
      >
        <Link href="/dealer-base" aria-label="Очистить фокус-фильтр">
          <X className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
