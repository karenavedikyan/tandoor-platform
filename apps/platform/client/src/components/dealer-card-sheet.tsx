/**
 * Промт 54-B: sheet-карточка клиента (drilldown в 54-C/D).
 * readOnly по умолчанию false — поведение как у полной страницы.
 */
import type { ReactNode } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { ArchiveInArchiveBadge } from "@/components/archive-record-visual";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { DealerManualActualizationPage } from "@/components/dealer-manual-actualization-page";
import { isDealerArchivedInActualization } from "@/lib/archive-record-visual";
import { DealerCardReadOnlyProvider } from "@/lib/dealer-card-read-only-context";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface DealerCardSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseRow: DealerRow;
  profile: ReleaseDemoProfile;
  /**
   * Если true — карточка в режиме просмотра: поля disabled, мутации и inline-add скрыты.
   * По умолчанию false.
   */
  readOnly?: boolean;
  title?: string;
}

export function DealerCardSheet({
  open,
  onOpenChange,
  baseRow,
  profile,
  readOnly,
  title,
}: DealerCardSheetProps): ReactNode {
  const actx = useClientBaseActualization();
  const isReadOnly = readOnly === true;
  const archived = actx.enabled && isDealerArchivedInActualization(baseRow.id, actx.state);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl"
        data-testid="sheet-dealer-card"
      >
        <SheetHeader className={cn("shrink-0 border-b border-border px-4 py-3 text-left", archived && "bg-muted/30")}>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle className="text-base font-semibold text-foreground">
              {title?.trim() ? title.trim() : baseRow.name}
            </SheetTitle>
            {archived ? <ArchiveInArchiveBadge size="header" testId="badge-dealer-sheet-header-archived" /> : null}
          </div>
          <SheetDescription className="sr-only">Карточка клиента</SheetDescription>
          {isReadOnly ? (
            <p className="text-xs text-muted-foreground" data-testid="text-dealer-card-readonly-hint">
              Только просмотр
            </p>
          ) : null}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <DealerCardReadOnlyProvider value={isReadOnly}>
            <DealerManualActualizationPage
              baseRow={baseRow}
              profile={profile}
              readOnly={isReadOnly}
              embeddedInSheet
            />
          </DealerCardReadOnlyProvider>
        </div>
      </SheetContent>
    </Sheet>
  );
}
