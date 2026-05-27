/**
 * Промт 54-B: sheet-карточка торговой точки (drilldown в 54-C/D).
 */
import type { ReactNode } from "react";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { ArchiveInArchiveBadge } from "@/components/archive-record-visual";
import { TradePointManualActualizationView } from "@/components/trade-point-manual-actualization-view";
import { TradePointReadOnlyProvider } from "@/lib/trade-point-read-only-context";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TradePointLegalEntityLink } from "@/components/trade-point-legal-entity-link";

export interface TradePointSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  readOnly?: boolean;
  title?: string;
  isArchived?: boolean;
}

export function TradePointSheet({
  open,
  onOpenChange,
  dealer,
  point,
  profile,
  readOnly,
  title,
  isArchived,
}: TradePointSheetProps): ReactNode {
  const isReadOnly = readOnly === true;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl"
        data-testid="sheet-trade-point"
      >
        <SheetHeader className={cn("shrink-0 border-b border-border px-4 py-3 text-left", isArchived && "bg-muted/30")}>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-base font-semibold text-foreground">
              {title?.trim() ? title.trim() : point.name}
            </SheetTitle>
            {isArchived ? <ArchiveInArchiveBadge size="header" testId="badge-trade-point-sheet-header-archived" /> : null}
          </div>
          <SheetDescription className="sr-only">Карточка торговой точки</SheetDescription>
          <TradePointLegalEntityLink dealerId={dealer.id} tradePointId={point.id} />
          {isReadOnly ? (
            <p className="text-xs text-muted-foreground" data-testid="text-trade-point-readonly-hint">
              Только просмотр
            </p>
          ) : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TradePointReadOnlyProvider value={isReadOnly}>
            <TradePointManualActualizationView
              dealer={dealer}
              point={point}
              profile={profile}
              readOnly={isReadOnly}
              embeddedInSheet
              isArchived={isArchived}
            />
          </TradePointReadOnlyProvider>
        </div>
      </SheetContent>
    </Sheet>
  );
}
