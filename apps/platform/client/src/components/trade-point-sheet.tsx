/**
 * Промт 54-B: sheet-карточка торговой точки (drilldown в 54-C/D).
 */
import type { ReactNode } from "react";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { TradePointManualActualizationView } from "@/components/trade-point-manual-actualization-view";
import { TradePointReadOnlyProvider } from "@/lib/trade-point-read-only-context";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TradePointLegalEntitiesSection } from "@/components/trade-point-legal-entities-section";
import { canEditDealerTradePoints } from "@/lib/dealer-trade-points-overrides";
import { resolveTradePointDisplayName } from "@/lib/trade-point-display-labels";

export interface TradePointSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  readOnly?: boolean;
  title?: string;
}

export function TradePointSheet({
  open,
  onOpenChange,
  dealer,
  point,
  profile,
  readOnly,
  title,
}: TradePointSheetProps): ReactNode {
  const isReadOnly = readOnly === true;
  const canEditTp = !isReadOnly && canEditDealerTradePoints(profile, dealer);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl"
        data-testid="sheet-trade-point"
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-base font-semibold text-foreground">
              {title?.trim() ? title.trim() : resolveTradePointDisplayName(dealer, point)}
            </SheetTitle>
          </div>
          <SheetDescription className="sr-only">Карточка торговой точки</SheetDescription>
          <TradePointLegalEntitiesSection dealerId={dealer.id} tradePointId={point.id} canEdit={canEditTp} />
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
            />
          </TradePointReadOnlyProvider>
        </div>
      </SheetContent>
    </Sheet>
  );
}
