import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
const filterCheckboxClass =
  "h-3.5 w-3.5 shrink-0 rounded-[2px] border-[#e3e6f3] data-[state=checked]:border-[#9aca3c] data-[state=checked]:bg-[#9aca3c] data-[state=checked]:text-white";

export type FilterCheckboxOption = { value: string; count: number };

type Props = {
  label: string;
  kind?: "checkbox" | "range_buckets" | "boolean";
  options: FilterCheckboxOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  maxVisible?: number;
  showCounts?: boolean;
};

export function FilterCheckboxGroup({
  label,
  kind = "checkbox",
  options,
  selected,
  onChange,
  maxVisible = 8,
  showCounts = true,
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

  if (kind === "boolean") {
    const yes = options[0]?.value ?? "Да";
    const checked = selected.includes(yes);
    const id = `${label}-boolean`;
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={checked}
          className={filterCheckboxClass}
          onCheckedChange={(v) => onChange(v === true ? [yes] : [])}
        />
        <Label htmlFor={id} className="cursor-pointer text-sm font-normal text-foreground">
          {label}
          {showCounts && options[0] ? (
            <span className="text-muted-foreground"> ({options[0].count.toLocaleString("ru-RU")})</span>
          ) : null}
        </Label>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {visible.map((opt) => {
          const id = `${label}-${opt.value}`;
          const checked = selected.includes(opt.value);
          return (
            <div key={opt.value} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={checked}
                className={filterCheckboxClass}
                onCheckedChange={(v) => toggle(opt.value, v === true)}
              />
              <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-snug text-foreground">
                {opt.value}
                {showCounts ? (
                  <span className="text-muted-foreground"> ({opt.count.toLocaleString("ru-RU")})</span>
                ) : null}
              </Label>
            </div>
          );
        })}
      </div>
      {hasMore && kind === "checkbox" && (
        <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Свернуть" : `Показать все (${options.length})`}
        </Button>
      )}
    </div>
  );
}
