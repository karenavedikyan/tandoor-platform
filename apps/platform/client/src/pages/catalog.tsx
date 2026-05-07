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
import {
  CATALOG_PRODUCTS,
  buildCatalogProductSearchHaystack,
  catalogSearchQueryMatchesHaystack,
  type CatalogProduct,
} from "@/lib/catalog-data";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";

type ViewMode = "cards" | "list" | "table";
type QuickChip = "all" | "hit" | "new" | "exclusive" | "action" | "stock";

const CHIPS: { id: QuickChip; label: string; testId: string }[] = [
  { id: "all", label: "Все", testId: "filter-catalog-all" },
  { id: "hit", label: "Хиты", testId: "filter-catalog-hit" },
  { id: "new", label: "Новинки", testId: "filter-catalog-new" },
  { id: "exclusive", label: "Эксклюзив", testId: "filter-catalog-exclusive" },
  { id: "action", label: "Акции", testId: "filter-catalog-action" },
  { id: "stock", label: "В наличии", testId: "filter-catalog-stock" },
];

function applyChip(p: CatalogProduct, chip: QuickChip): boolean {
  switch (chip) {
    case "all":
      return true;
    case "hit":
      return p.isTop;
    case "new":
      return p.isNew;
    case "exclusive":
      return p.isExclusive;
    case "action":
      return p.isAction;
    case "stock":
      return p.inStock;
    default:
      return true;
  }
}

function ProductImage({ product }: { product: CatalogProduct }) {
  if (product.image) {
    return (
      <img
        src={product.image}
        alt=""
        className="mx-auto h-full max-h-[min(52vh,420px)] w-full max-w-full object-contain"
      />
    );
  }
  return (
    <div className="flex h-full min-h-[120px] w-full flex-col items-center justify-center bg-muted/60 p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{product.doorKind}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">Изображение модели не загружено</p>
    </div>
  );
}

function ProductBadges({ p }: { p: CatalogProduct }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {p.isTop ? (
        <Badge variant="outline" className="border-primary/40 bg-primary/15 font-semibold">
          Хит
        </Badge>
      ) : null}
      {p.isNew ? (
        <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-950">
          Новинка
        </Badge>
      ) : null}
      {p.isExclusive ? (
        <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-950">
          Эксклюзив
        </Badge>
      ) : null}
      {p.isAction ? (
        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-950">
          Акция
        </Badge>
      ) : null}
      {p.recommendedForShowcase ? (
        <Badge variant="outline" className="border-border bg-muted/60">
          Витрина
        </Badge>
      ) : null}
    </div>
  );
}

export default function CatalogPage() {
  const [view, setView] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<QuickChip>("all");
  const [category, setCategory] = useState<string>("all");
  const [series, setSeries] = useState<string>("all");
  const [doorKind, setDoorKind] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const categories = useMemo(() => Array.from(new Set(CATALOG_PRODUCTS.map((p) => p.category))).sort(), []);
  const seriesList = useMemo(() => Array.from(new Set(CATALOG_PRODUCTS.map((p) => p.series))).sort(), []);
  const doorKinds = useMemo(() => Array.from(new Set(CATALOG_PRODUCTS.map((p) => p.doorKind))).sort(), []);
  const statuses = useMemo(() => Array.from(new Set(CATALOG_PRODUCTS.map((p) => p.status))).sort(), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATALOG_PRODUCTS.filter((p) => {
      if (!applyChip(p, chip)) return false;
      if (category !== "all" && p.category !== category) return false;
      if (series !== "all" && p.series !== series) return false;
      if (doorKind !== "all" && p.doorKind !== doorKind) return false;
      if (status !== "all" && p.status !== status) return false;
      if (!q) return true;
      const hay = buildCatalogProductSearchHaystack(p);
      return catalogSearchQueryMatchesHaystack(q, hay);
    });
  }, [search, chip, category, series, doorKind, status]);

  return (
    <div className="space-y-6 sm:space-y-8" data-testid="page-catalog">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Каталог</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Входные, межкомнатные и скрытые двери Tandoor: поиск по названию и артикулу, фильтры и переход в карточку модели.
        </p>
      </div>

      <section className="space-y-4" data-testid="section-catalog-filters">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Название, артикул или серия…"
            className="min-h-11 rounded-xl border-border bg-card pl-10"
            data-testid="input-catalog-search"
            aria-label="Поиск по каталогу"
          />
        </div>

        <div className="flex flex-wrap gap-2" data-testid="section-catalog-quick-filters">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChip(c.id)}
              data-testid={c.testId}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                chip === c.id
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Категория</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="min-h-11 rounded-xl bg-card" data-testid="select-catalog-category">
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Серия</Label>
            <Select value={series} onValueChange={setSeries}>
              <SelectTrigger className="min-h-11 rounded-xl bg-card" data-testid="select-catalog-series">
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все серии</SelectItem>
                {seriesList.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Вид двери</Label>
            <Select value={doorKind} onValueChange={setDoorKind}>
              <SelectTrigger className="min-h-11 rounded-xl bg-card" data-testid="select-catalog-door-kind">
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Любой</SelectItem>
                {doorKinds.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Статус</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="min-h-11 rounded-xl bg-card" data-testid="select-catalog-status">
                <SelectValue placeholder="Все" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Вид:</span>
          {(
            [
              { id: "cards" as const, icon: LayoutGrid, label: "Карточки", testId: "button-catalog-view-cards" },
              { id: "list" as const, icon: List, label: "Список", testId: "button-catalog-view-list" },
              { id: "table" as const, icon: Table2, label: "Таблица", testId: "button-catalog-view-table" },
            ] as const
          ).map((v) => (
            <Button
              key={v.id}
              type="button"
              variant={view === v.id ? "default" : "outline"}
              size="sm"
              className="min-h-10 gap-2 rounded-full"
              data-testid={v.testId}
              onClick={() => setView(v.id)}
            >
              <v.icon className="h-4 w-4" aria-hidden />
              {v.label}
            </Button>
          ))}
          <span className="ml-auto text-sm text-muted-foreground" data-testid="text-catalog-count">
            Найдено: {filtered.length}
          </span>
        </div>
      </section>

      {view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="section-catalog-results-cards">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md">
        <div className="aspect-[4/3] w-full overflow-hidden border-b border-border bg-[#F7F8FB] px-2 py-3 sm:px-4 sm:py-5">
                <ProductImage product={p} />
              </div>
              <CardHeader className="space-y-2 pb-2">
                <ProductBadges p={p} />
                <CardTitle className="text-lg leading-snug">{p.name}</CardTitle>
                <p className="text-sm font-mono text-muted-foreground">{p.article}</p>
                <p className="text-xs text-muted-foreground">
                  {p.doorKind} · серия «{p.series}» · {p.coating}
                </p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{p.shortDescription}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <Button asChild className="w-full min-h-11 font-semibold" data-testid={`button-catalog-open-${p.id}`}>
                  <Link href={`/catalog/${p.id}`}>Открыть</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {view === "list" ? (
        <ul className="space-y-2" data-testid="section-catalog-results-list">
          {filtered.map((p) => (
            <li key={p.id}>
              <Card className="rounded-2xl border border-border/80 bg-card shadow-sm">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.article} · {p.doorKind} · серия «{p.series}» · {p.status}
                    </p>
                    <ProductBadges p={p} />
                  </div>
                  <Button asChild variant="outline" className="min-h-10 shrink-0 border-border bg-card" data-testid={`button-catalog-open-${p.id}`}>
                    <Link href={`/catalog/${p.id}`}>Открыть</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {view === "table" ? (
        <Card className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md" data-testid="section-catalog-results-table">
          <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-4 py-3 font-semibold">Модель</th>
                  <th className="px-4 py-3 font-semibold">Артикул</th>
                  <th className="px-4 py-3 font-semibold">Вид</th>
                  <th className="px-4 py-3 font-semibold">Серия</th>
                  <th className="px-4 py-3 font-semibold">Статус</th>
                  <th className="px-4 py-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border/80 last:border-0">
                    <td className="max-w-[200px] px-4 py-3 font-medium break-words">{p.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground">{p.article}</td>
                    <td className="px-4 py-3">{p.doorKind}</td>
                    <td className="px-4 py-3">{p.series}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.status}</td>
                    <td className="px-4 py-3">
                      <Button asChild variant="ghost" size="sm" className="font-semibold text-primary" data-testid={`button-catalog-open-${p.id}`}>
                        <Link href={`/catalog/${p.id}`}>Открыть</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground" data-testid="text-catalog-empty">
          Ничего не найдено — измените фильтры или запрос.
        </p>
      ) : null}

      <FloatingBackButton
        href="/dealer-base"
        label="К базе"
        testId="floating-back-to-dealer-base"
        ariaLabel="Назад к клиентской базе"
      />
    </div>
  );
}
