import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type FilterCheckboxOption = { value: string; count: number };

type Props = {
  label: string;
  options: FilterCheckboxOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  maxVisible?: number;
};

export function FilterCheckboxGroup({
  label,
  options,
  selected,
  onChange,
  maxVisible = 8,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, maxVisible);
  const hasMore = options.length > maxVisible;

  function toggle(value: string, checked: boolean) {
    if (checked) {
      onChange([...selected, value]);
    } else {
      onChange(selected.filter((v) => v !== value));
    }
  }

  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div className="space-y-1.5">
        {visible.map((opt) => {
          const id = `${label}-${opt.value}`;
          const checked = selected.includes(opt.value);
          return (
            <div key={opt.value} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(v) => toggle(opt.value, v === true)}
              />
              <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-snug">
                {opt.value}{" "}
                <span className="text-muted-foreground">({opt.count.toLocaleString("ru-RU")})</span>
              </Label>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Свернуть" : `Показать все (${options.length})`}
        </Button>
      )}
    </div>
  );
}
