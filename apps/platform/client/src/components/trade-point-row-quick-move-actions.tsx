import { Archive, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TradePointListRow } from "@/lib/trade-point-list-for-actualization";

export type TradePointListRowQuickMoveProps = {
  canMoveRow: (row: TradePointListRow) => boolean;
  onArchive: (row: TradePointListRow) => void;
  onTrash: (row: TradePointListRow) => void;
};

export function TradePointRowQuickMoveActions({
  row,
  rowQuickMove,
  archiveTestIdPrefix = "trade-point-list",
}: {
  row: TradePointListRow;
  rowQuickMove: TradePointListRowQuickMoveProps;
  archiveTestIdPrefix?: string;
}) {
  if (!rowQuickMove.canMoveRow(row)) return null;
  const id = row.tradePointId;
  return (
    <>
      <div className="hidden items-center gap-0.5 sm:flex" onClick={(e) => e.stopPropagation()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              data-testid={`button-${archiveTestIdPrefix}-archive-${id}`}
              onClick={() => rowQuickMove.onArchive(row)}
            >
              <Archive className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">В Архив</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">В Архив</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              data-testid={`button-${archiveTestIdPrefix}-trash-${id}`}
              onClick={() => rowQuickMove.onTrash(row)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              <span className="sr-only">В Корзину</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">В Корзину</TooltipContent>
        </Tooltip>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground sm:hidden"
            data-testid={`button-${archiveTestIdPrefix}-more-${id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
            <span className="sr-only">Действия</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem data-testid={`menu-${archiveTestIdPrefix}-archive-${id}`} onClick={() => rowQuickMove.onArchive(row)}>
            <Archive className="mr-2 h-4 w-4" aria-hidden />
            В Архив
          </DropdownMenuItem>
          <DropdownMenuItem data-testid={`menu-${archiveTestIdPrefix}-trash-${id}`} onClick={() => rowQuickMove.onTrash(row)}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            В Корзину
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
