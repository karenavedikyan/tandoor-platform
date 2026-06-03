import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getProductById, searchCatalog } from "@/lib/catalog-data";
import type { CatalogProduct } from "@/lib/catalog-product-type";
import { cn } from "@/lib/utils";

type DoorFilter = "all" | "entrance" | "interior";

function doorFilterLabel(f: DoorFilter): string {
  if (f === "entrance") return "ВХ";
  if (f === "interior") return "МК";
  return "Все";
}

function matchesDoorFilter(p: CatalogProduct, filter: DoorFilter): boolean {
  if (filter === "all") return true;
  if (filter === "entrance") return p.doorKind === "Входная";
  return p.doorKind === "Межкомнатная";
}

export type MatrixCatalogProductPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: Set<string>;
  onConfirm: (products: CatalogProduct[]) => void;
};

export function MatrixCatalogProductPicker(props: MatrixCatalogProductPickerProps): ReactElement {
  const { open, onOpenChange, excludeIds, onConfirm } = props;
  const [search, setSearch] = useState("");
  const [doorFilter, setDoorFilter] = useState<DoorFilter>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const results = useMemo(() => {
    const q = search.trim();
    let list = searchCatalog(q, q ? 80 : 40);
    list = list.filter((p) => !excludeIds.has(p.id));
    if (doorFilter !== "all") list = list.filter((p) => matchesDoorFilter(p, doorFilter));
    return list;
  }, [search, doorFilter, excludeIds]);

  const toggle = (id: string, checked: boolean) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const products = [...picked].map((id) => getProductById(id)).filter((p): p is CatalogProduct => Boolean(p));
    onConfirm(products);
    setPicked(new Set());
    setSearch("");
    setDoorFilter("all");
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPicked(new Set());
      setSearch("");
      setDoorFilter("all");
    }
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Добавить модели из каталога</SheetTitle>
        </SheetHeader>

        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, артикулу, серии"
            className="pl-9"
            data-testid="input-matrix-catalog-picker-search"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["all", "entrance", "interior"] as DoorFilter[]).map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={doorFilter === f ? "default" : "outline"}
              onClick={() => setDoorFilter(f)}
              data-testid={`button-matrix-catalog-picker-filter-${f}`}
            >
              {doorFilterLabel(f)}
            </Button>
          ))}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">По запросу ничего не найдено.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((p) => {
                const checked = picked.has(p.id);
                const typeShort = p.doorKind === "Входная" ? "ВХ" : p.doorKind === "Межкомнатная" ? "МК" : "—";
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "flex gap-3 rounded-lg border border-border bg-card p-2",
                      checked && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggle(p.id, v === true)}
                      aria-label={`Выбрать ${p.name}`}
                      data-testid={`checkbox-matrix-catalog-picker-${p.id}`}
                    />
                    <div className="flex min-w-0 flex-1 gap-2">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted/40">
                        {p.image ? (
                          <img src={p.image} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Нет фото</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-foreground">{p.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                            {typeShort}
                          </Badge>
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                            {p.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-4 flex shrink-0 flex-wrap gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={picked.size === 0}
            onClick={handleConfirm}
            data-testid="button-matrix-catalog-picker-confirm"
          >
            Добавить ({picked.size})
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
