import type { ReactElement } from "react";
import { LayoutGrid, Table } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { OneCListViewMode } from "./use-one-c-list-view";

type Props = {
  value: OneCListViewMode;
  onChange: (value: OneCListViewMode) => void;
  testIdPrefix: string;
};

export function OneCListViewToggle({ value, onChange, testIdPrefix }: Props): ReactElement {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next === "cards" || next === "table") onChange(next);
      }}
      className="justify-start"
      data-testid={`${testIdPrefix}-view-toggle`}
    >
      <ToggleGroupItem value="cards" className="h-8 gap-1 px-2 text-xs" data-testid={`${testIdPrefix}-view-cards`}>
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
        Карточки
      </ToggleGroupItem>
      <ToggleGroupItem value="table" className="h-8 gap-1 px-2 text-xs" data-testid={`${testIdPrefix}-view-table`}>
        <Table className="h-3.5 w-3.5" aria-hidden />
        Таблица
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
