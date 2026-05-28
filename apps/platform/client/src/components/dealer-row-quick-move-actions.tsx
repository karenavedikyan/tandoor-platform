import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DealerRow } from "@/lib/dealer-base-mock-data";

export type DealerListRowQuickMoveProps = {
  canMoveDealerId: (dealerId: string) => boolean;
  onTrash: (row: DealerRow) => void;
  /** @deprecated Промт 79: архивация убрана из UI */
  onArchive?: (row: DealerRow) => void;
};

export function DealerRowQuickMoveActions({
  row,
  rowQuickMove,
}: {
  row: DealerRow;
  rowQuickMove: DealerListRowQuickMoveProps;
}) {
  if (!rowQuickMove.canMoveDealerId(row.id)) return null;
  return (
    <>
      <div className="hidden items-center gap-0.5 sm:flex" onClick={(e) => e.stopPropagation()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              data-testid={`button-dealer-row-trash-${row.id}`}
              onClick={() => rowQuickMove.onTrash(row)}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              <span className="sr-only">Удалить</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Удалить</TooltipContent>
        </Tooltip>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground sm:hidden"
            data-testid={`button-dealer-row-more-${row.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
            <span className="sr-only">Действия</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            data-testid={`menu-dealer-row-trash-${row.id}`}
            onClick={() => rowQuickMove.onTrash(row)}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
