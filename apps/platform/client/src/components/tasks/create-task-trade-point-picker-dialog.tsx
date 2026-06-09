import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  fetchTradePointsManagerDetail,
  fetchTradePointsOverview,
  type TradePointsManagerDetailTp,
} from "@/lib/trade-points-overview-api";

export type TradePointPickerOption = {
  dealerId: string;
  pointId: string;
  label: string;
  searchText: string;
};

async function loadTradePointsForPicker(userId: string, role: string): Promise<TradePointPickerOption[]> {
  if (role === "regional_manager") return [];
  const overview = await fetchTradePointsOverview();
  let managerIds: string[] = [];
  if (role === "rop") {
    managerIds = overview.ropGroups
      .filter((g) => g.ropUserId === userId)
      .flatMap((g) => g.managers.map((m) => m.userId));
  } else if (role === "admin" || role === "director") {
    managerIds = overview.ropGroups.flatMap((g) => g.managers.map((m) => m.userId));
  } else {
    managerIds = [userId];
  }
  managerIds = Array.from(new Set(managerIds)).slice(0, 40);
  const details = await Promise.all(
    managerIds.map((id) => fetchTradePointsManagerDetail(id).catch(() => null)),
  );
  return flattenTradePoints(details);
}

function flattenTradePoints(
  details: Array<{ tradePoints: TradePointsManagerDetailTp[] } | null>,
): TradePointPickerOption[] {
  const options: TradePointPickerOption[] = [];
  const seen = new Set<string>();
  for (const d of details) {
    if (!d) continue;
    for (const tp of d.tradePoints) {
      const dealerId = tp.dealerProfileId ?? tp.clientId;
      const key = `${dealerId}|${tp.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const label = `${tp.clientFullName}${tp.name ? ` · ${tp.name}` : ""}${tp.city ? ` (${tp.city})` : ""}`;
      options.push({
        dealerId,
        pointId: tp.id,
        label,
        searchText: `${label} ${tp.address ?? ""}`.toLowerCase(),
      });
    }
  }
  options.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  return options;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userRole: string;
};

export function CreateTaskTradePointPickerDialog({ open, onOpenChange, userId, userRole }: Props) {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<TradePointPickerOption[]>([]);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setLoadError("");
    if (userRole === "regional_manager") {
      setOptions([]);
      return;
    }
    setLoading(true);
    void loadTradePointsForPicker(userId, userRole)
      .then(setOptions)
      .catch(() => {
        setOptions([]);
        setLoadError("Не удалось загрузить список торговых точек");
      })
      .finally(() => setLoading(false));
  }, [open, userId, userRole]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.searchText.includes(q));
  }, [options, search]);

  const pick = (opt: TradePointPickerOption) => {
    onOpenChange(false);
    setLocation(
      `/dealers/${encodeURIComponent(opt.dealerId)}/trade-points/${encodeURIComponent(opt.pointId)}?tradePointShowcase=1`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg" data-testid="dialog-create-task-pick-tp">
        <DialogHeader>
          <DialogTitle>Выберите торговую точку</DialogTitle>
          <DialogDescription>
            Задание создаётся на витрине выбранной ТТ: отметьте модели и нажмите «Создать задание».
          </DialogDescription>
        </DialogHeader>
        {userRole === "regional_manager" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Перейдите к списку торговых точек и откройте витрину нужной ТТ.
            </p>
            <Button
              type="button"
              className="w-full"
              data-testid="button-create-task-go-trade-points"
              onClick={() => {
                onOpenChange(false);
                setLocation("/trade-points");
              }}
            >
              Перейти к торговым точкам
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по клиенту, названию, адресу…"
                className="pl-9"
                data-testid="input-create-task-tp-search"
              />
            </div>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : loadError ? (
              <p className="text-sm text-destructive">{loadError}</p>
            ) : filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Торговые точки не найдены</p>
            ) : (
              <ul className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
                {filtered.map((opt) => (
                  <li key={`${opt.dealerId}|${opt.pointId}`}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-border/70 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                      onClick={() => pick(opt)}
                      data-testid={`button-create-task-tp-${opt.pointId}`}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
