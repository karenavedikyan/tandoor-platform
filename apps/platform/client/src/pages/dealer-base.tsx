import { useMemo, useState } from "react";
import { Link } from "wouter";
import { LayoutGrid, List, Search, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DEALER_BASE_ROWS, type DealerRow, type DealerCategory, type DealerStatus } from "@/lib/dealer-base-mock-data";

type ViewMode = "list" | "cards" | "table";
type QuickFilter = "all" | "active" | "potential" | "attention" | "top" | "no_activity";

const QUICK_FILTERS: { id: QuickFilter; label: string; testId: string }[] = [
  { id: "all", label: "Все", testId: "filter-dealers-all" },
  { id: "active", label: "Активные", testId: "filter-dealers-active" },
  { id: "potential", label: "Потенциальные", testId: "filter-dealers-potential" },
  { id: "attention", label: "Требуют внимания", testId: "filter-dealers-attention" },
  { id: "top", label: "TOP", testId: "filter-dealers-top" },
  { id: "no_activity", label: "Без активности", testId: "filter-dealers-no-activity" },
];

function statusBadgeClass(status: DealerStatus) {
  if (status === "требует внимания") return "border-amber-300 bg-amber-50 text-amber-950";
  if (status === "потенциальный") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "приостановлен") return "border-neutral-200 bg-muted text-muted-foreground";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function categoryBadgeClass(cat: DealerCategory) {
  if (cat === "TOP") return "border-primary/40 bg-primary/15 text-foreground font-semibold";
  return "border-border bg-muted/60 text-foreground";
}

function applyQuickFilter(row: DealerRow, q: QuickFilter): boolean {
  switch (q) {
    case "all":
      return true;
    case "active":
      return row.status === "активный";
    case "potential":
      return row.status === "потенциальный";
    case "attention":
      return row.status === "требует внимания" || row.hasProblem;
    case "top":
      return row.category === "TOP";
    case "no_activity":
      return !row.hasRecentActivity;
    default:
      return true;
  }
}

export default function DealerBase() {
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [city, setCity] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [manager, setManager] = useState<string>("all");

  const cities = useMemo(() => {
    const s = new Set(DEALER_BASE_ROWS.map((r) => r.city));
    return Array.from(s).sort();
  }, []);

  const managers = useMemo(() => {
    const s = new Set(DEALER_BASE_ROWS.map((r) => r.manager));
    return Array.from(s).sort();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return DEALER_BASE_ROWS.filter((row) => {
      if (!applyQuickFilter(row, quick)) return false;
      if (city !== "all" && row.city !== city) return false;
      if (category !== "all" && row.category !== category) return false;
      if (manager !== "all" && row.manager !== manager) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.city.toLowerCase().includes(q) ||
        row.manager.toLowerCase().includes(q) ||
        row.regionalManager.toLowerCase().includes(q)
      );
    });
  }, [search, quick, city, category, manager]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((r) => r.status === "активный").length;
    const potential = filtered.filter((r) => r.status === "потенциальный").length;
    const attention = filtered.filter((r) => r.status === "требует внимания" || r.hasProblem).length;
    const outlets = filtered.reduce((a, r) => a + r.outlets, 0);
    const avgDist =
      total > 0 ? Math.round(filtered.reduce((a, r) => a + r.distribution, 0) / total) : 0;
    return { total, active, potential, attention, outlets, avgDist };
  }, [filtered]);

  return (
    <div className="space-y-6 sm:space-y-8" data-testid="page-dealer-base">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Клиентская база</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Список дилеров и торговых партнёров: поиск, фильтры и переход в карточку клиента.
        </p>
      </div>

      <section className="space-y-3" data-testid="section-dealer-base-kpis">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Всего дилеров", value: String(kpis.total) },
            { label: "Активные", value: String(kpis.active) },
            { label: "Потенциальные", value: String(kpis.potential) },
            { label: "Требуют внимания", value: String(kpis.attention) },
            { label: "Торговые точки", value: String(kpis.outlets) },
            { label: "Средняя дистрибуция", value: `${kpis.avgDist}%` },
          ].map((k) => (
            <Card key={k.label} className="rounded-2xl border border-border/80 bg-card shadow-md">
              <CardHeader className="p-4 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">{k.value}</p>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, городу, ответственному"
              className="min-h-11 rounded-xl border-border pl-10"
              data-testid="input-dealer-search"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map((f) => (
              <Button
                key={f.id}
                type="button"
                size="sm"
                variant={quick === f.id ? "default" : "outline"}
                className={cn("rounded-full", quick === f.id ? "" : "border-border bg-card")}
                onClick={() => setQuick(f.id)}
                data-testid={f.testId}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Город</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="min-h-11 rounded-xl">
                  <SelectValue placeholder="Город" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все города</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Категория</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="min-h-11 rounded-xl">
                  <SelectValue placeholder="Категория" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {(["TOP", "A", "B", "C"] as DealerCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Ответственный</Label>
              <Select value={manager} onValueChange={setManager}>
                <SelectTrigger className="min-h-11 rounded-xl">
                  <SelectValue placeholder="Менеджер" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все менеджеры</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <span className="w-full text-xs font-medium text-muted-foreground sm:w-auto sm:py-2">Вид:</span>
            <Button
              type="button"
              size="sm"
              variant={view === "list" ? "default" : "outline"}
              className={cn("gap-2 rounded-full", view !== "list" && "border-border bg-card")}
              onClick={() => setView("list")}
              data-testid="toggle-view-list"
            >
              <List className="h-4 w-4" />
              Список
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "cards" ? "default" : "outline"}
              className={cn("gap-2 rounded-full", view !== "cards" && "border-border bg-card")}
              onClick={() => setView("cards")}
              data-testid="toggle-view-cards"
            >
              <LayoutGrid className="h-4 w-4" />
              Карточки
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "table" ? "default" : "outline"}
              className={cn("gap-2 rounded-full", view !== "table" && "border-border bg-card")}
              onClick={() => setView("table")}
              data-testid="toggle-view-table"
            >
              <Table2 className="h-4 w-4" />
              Таблица
            </Button>
          </div>
        </CardContent>
      </Card>

      <section data-testid="section-dealer-base-results">
        {filtered.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Ничего не найдено. Измените фильтры или поиск.
          </Card>
        ) : view === "list" ? (
          <div className="space-y-3">
            {filtered.map((row) => (
              <Card
                key={row.id}
                className="rounded-2xl border border-border/80 bg-card shadow-sm"
                data-testid={`row-dealer-${row.id}`}
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{row.name}</span>
                      <Badge variant="outline" className={cn("text-xs", categoryBadgeClass(row.category))}>
                        {row.category}
                      </Badge>
                      <Badge variant="outline" className={cn("text-xs", statusBadgeClass(row.status))}>
                        {row.status}
                      </Badge>
                      {row.hasProblem ? (
                        <Badge variant="outline" className="border-red-200 bg-red-50 text-xs text-red-800">
                          Есть вопрос
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {row.city}, {row.region} · {row.format} · ТТ: {row.outlets}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Менеджер: {row.manager} · РМ: {row.regionalManager}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Активность: {row.lastActivity} · Дистрибуция: {row.distribution}% · Витрина: {row.showcaseStatus}
                    </p>
                    <p className="text-xs text-foreground/90">Далее: {row.nextAction}</p>
                  </div>
                  <Button asChild className="min-h-11 shrink-0 font-semibold" data-testid={`button-open-dealer-${row.id}`}>
                    <Link href="/dealer-card-foundation">Открыть</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : view === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => (
              <Card
                key={row.id}
                className="flex flex-col rounded-2xl border border-border/80 bg-card shadow-md"
                data-testid={`card-dealer-${row.id}`}
              >
                <CardHeader className="space-y-2 pb-2">
                  <CardTitle className="text-base leading-snug">{row.name}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={cn("text-xs", statusBadgeClass(row.status))}>
                      {row.status}
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs", categoryBadgeClass(row.category))}>
                      {row.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.city}, {row.region}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.manager} · {row.regionalManager}
                  </p>
                </CardHeader>
                <CardContent className="mt-auto flex flex-1 flex-col gap-3 pb-4">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Дистрибуция</p>
                      <p className="font-semibold text-foreground">{row.distribution}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Витрина</p>
                      <p className="font-semibold text-foreground">{row.showcaseStatus}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">ТТ</p>
                      <p className="font-semibold text-foreground">{row.outlets}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Активность</p>
                      <p className="font-semibold text-foreground">{row.lastActivity}</p>
                    </div>
                  </div>
                  {row.hasProblem ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-xs text-amber-950">{row.comment}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">Далее: {row.nextAction}</p>
                  <Button asChild className="mt-auto min-h-11 w-full font-semibold" data-testid={`button-open-dealer-${row.id}`}>
                    <Link href="/dealer-card-foundation">Открыть</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-3 sm:hidden">
              {filtered.map((row) => (
                <Card key={row.id} className="rounded-2xl border border-border/80 bg-card shadow-sm" data-testid={`row-dealer-${row.id}`}>
                  <CardContent className="space-y-2 p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{row.name}</span>
                      <Badge variant="outline" className={cn("text-xs", categoryBadgeClass(row.category))}>
                        {row.category}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {row.city} · {row.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.manager} · {row.regionalManager} · ТТ {row.outlets}
                    </p>
                    <p className="text-xs">
                      Дистр. {row.distribution}% · {row.showcaseStatus}
                    </p>
                    <Button asChild className="min-h-11 w-full font-semibold" data-testid={`button-open-dealer-${row.id}`}>
                      <Link href="/dealer-card-foundation">Открыть</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="hidden sm:block sm:overflow-x-auto sm:rounded-2xl sm:border sm:border-border/80 sm:bg-card sm:shadow-sm">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    {["№", "Дилер", "Город", "Статус", "Категория", "Менеджер", "РМ", "ТТ", "Дистр.", "Витрина", "Активность", "Действие", ""].map(
                      (h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0" data-testid={`row-dealer-${row.id}`}>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{row.id}</td>
                      <td className="max-w-[140px] truncate px-3 py-3 font-medium">{row.name}</td>
                      <td className="whitespace-nowrap px-3 py-3">{row.city}</td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={cn("text-xs", statusBadgeClass(row.status))}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={cn("text-xs", categoryBadgeClass(row.category))}>
                          {row.category}
                        </Badge>
                      </td>
                      <td className="max-w-[100px] truncate px-3 py-3 text-xs">{row.manager}</td>
                      <td className="max-w-[100px] truncate px-3 py-3 text-xs">{row.regionalManager}</td>
                      <td className="px-3 py-3 tabular-nums">{row.outlets}</td>
                      <td className="px-3 py-3 tabular-nums">{row.distribution}%</td>
                      <td className="max-w-[90px] truncate px-3 py-3 text-xs">{row.showcaseStatus}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{row.lastActivity}</td>
                      <td className="max-w-[120px] truncate px-3 py-3 text-xs">{row.nextAction}</td>
                      <td className="px-3 py-3">
                        <Button asChild size="sm" className="font-semibold" data-testid={`button-open-dealer-${row.id}`}>
                          <Link href="/dealer-card-foundation">Открыть</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
