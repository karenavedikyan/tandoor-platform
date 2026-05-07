import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { BookOpen, ChevronRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getAllTrainingMaterials,
  summarizeTrainingKpis,
  TRAINING_AUDIENCE_LABEL,
  TRAINING_SECTION_LABEL,
  TRAINING_STATUS_LABEL,
  TRAINING_TYPE_LABEL,
  type TrainingAudience,
  type TrainingMaterial,
  type TrainingMaterialStatus,
  type TrainingMaterialType,
  type TrainingSection,
} from "@/lib/training-data";
import { getProductById } from "@/lib/catalog-data";

type StatusFilter = "all" | TrainingMaterialStatus;

const ALL = "all" as const;
/** Отдельное значение фильтра «любая аудитория», чтобы не пересекаться с типом `TrainingAudience.all`. */
const AUDIENCE_FILTER_ANY = "__any__" as const;

const SECTION_FILTER_OPTIONS: { value: typeof ALL | TrainingSection; label: string }[] = [
  { value: ALL, label: "Все разделы" },
  { value: "product", label: TRAINING_SECTION_LABEL.product },
  { value: "sales", label: TRAINING_SECTION_LABEL.sales },
  { value: "onboarding", label: TRAINING_SECTION_LABEL.onboarding },
  { value: "regulations", label: TRAINING_SECTION_LABEL.regulations },
  { value: "development", label: TRAINING_SECTION_LABEL.development },
];

const AUDIENCE_FILTER_OPTIONS: { value: typeof AUDIENCE_FILTER_ANY | TrainingAudience; label: string }[] = [
  { value: AUDIENCE_FILTER_ANY, label: "Вся аудитория" },
  { value: "employees", label: TRAINING_AUDIENCE_LABEL.employees },
  { value: "dealers", label: TRAINING_AUDIENCE_LABEL.dealers },
  { value: "managers", label: TRAINING_AUDIENCE_LABEL.managers },
  { value: "regional_managers", label: TRAINING_AUDIENCE_LABEL.regional_managers },
  { value: "purchasing", label: TRAINING_AUDIENCE_LABEL.purchasing },
  { value: "all", label: TRAINING_AUDIENCE_LABEL.all },
];

const TYPE_FILTER_OPTIONS: { value: typeof ALL | TrainingMaterialType; label: string }[] = [
  { value: ALL, label: "Все типы" },
  { value: "article", label: TRAINING_TYPE_LABEL.article },
  { value: "course", label: TRAINING_TYPE_LABEL.course },
  { value: "script", label: TRAINING_TYPE_LABEL.script },
  { value: "comparison", label: TRAINING_TYPE_LABEL.comparison },
  { value: "regulation", label: TRAINING_TYPE_LABEL.regulation },
  { value: "faq", label: TRAINING_TYPE_LABEL.faq },
  { value: "video", label: TRAINING_TYPE_LABEL.video },
];

const SECTION_CARD_TEST: Record<TrainingSection, string> = {
  product: "card-training-section-product",
  sales: "card-training-section-sales",
  onboarding: "card-training-section-onboarding",
  regulations: "card-training-section-regulations",
  development: "card-training-section-development",
};

const STATUS_CHIPS: { id: StatusFilter; label: string; testId: string }[] = [
  { id: "all", label: "Все", testId: "filter-training-all" },
  { id: "required", label: "Обязательные", testId: "filter-training-required" },
  { id: "recommended", label: "Рекомендованные", testId: "filter-training-recommended" },
  { id: "new", label: "Новые", testId: "filter-training-new" },
  { id: "updated", label: "Обновлённые", testId: "filter-training-updated" },
];

function matchesSearch(m: TrainingMaterial, q: string) {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const inTitle = m.title.toLowerCase().includes(s);
  const inDesc = m.description.toLowerCase().includes(s);
  const inTags = m.tags.some((t) => t.toLowerCase().includes(s));
  return inTitle || inDesc || inTags;
}

function statusBadgeClass(status: TrainingMaterial["status"]) {
  if (status === "required") return "border-primary/50 bg-primary/15 text-foreground";
  if (status === "new") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "updated") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted/60 text-foreground";
}

export default function TrainingPage() {
  const all = useMemo(() => getAllTrainingMaterials(), []);
  const kpis = useMemo(() => summarizeTrainingKpis(all), [all]);
  const materialsRef = useRef<HTMLElement>(null);

  const [search, setSearch] = useState("");
  const [section, setSection] = useState<typeof ALL | TrainingSection>(ALL);
  const [audience, setAudience] = useState<typeof AUDIENCE_FILTER_ANY | TrainingAudience>(AUDIENCE_FILTER_ANY);
  const [type, setType] = useState<typeof ALL | TrainingMaterialType>(ALL);
  const [statusChip, setStatusChip] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    return all.filter((m) => {
      if (!matchesSearch(m, search)) return false;
      if (section !== ALL && m.section !== section) return false;
      if (audience !== AUDIENCE_FILTER_ANY && !m.audience.includes(audience)) return false;
      if (type !== ALL && m.type !== type) return false;
      if (statusChip !== "all" && m.status !== statusChip) return false;
      return true;
    });
  }, [all, search, section, audience, type, statusChip]);

  const scrollToMaterials = useCallback(() => {
    materialsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const pickSection = useCallback(
    (s: TrainingSection) => {
      setSection(s);
      setStatusChip("all");
      requestAnimationFrame(() => scrollToMaterials());
    },
    [scrollToMaterials],
  );

  return (
    <div className="space-y-8 pb-10 sm:space-y-10" data-testid="page-training">
      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8"
        data-testid="section-training-hero"
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative flex flex-col gap-5 pl-3 sm:flex-row sm:items-start sm:justify-between sm:pl-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <GraduationCap className="h-7 w-7 shrink-0" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">База знаний</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Обучение</h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">Материалы по продукту, продажам, адаптации и регламентам.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[200px]">
            <Button asChild className="min-h-11 w-full font-semibold" data-testid="button-training-open-main">
              <Link href="/main">К главному</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card font-semibold" data-testid="button-training-open-catalog">
              <Link href="/catalog">К каталогу</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card font-semibold" data-testid="button-training-open-tasks">
              <Link href="/tasks">К задачам</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-training-summary">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Сводка</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/70 shadow-xs" data-testid="card-training-total">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Всего материалов</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{kpis.total}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-xs" data-testid="card-training-required">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Обязательные</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{kpis.required}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-xs" data-testid="card-training-in-progress">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">В процессе</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{kpis.inProgress}</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 shadow-xs" data-testid="card-training-dealer-access">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Доступно дилерам</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{kpis.dealerAccess}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6" data-testid="section-training-filters">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Фильтры</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="input-training-search">
              Поиск
            </label>
            <Input
              id="input-training-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Название, описание, теги…"
              className="h-11 min-h-[44px] border-border/80"
              data-testid="input-training-search"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Раздел</span>
            <Select value={section} onValueChange={(v) => setSection(v as typeof ALL | TrainingSection)}>
              <SelectTrigger className="h-11 min-h-[44px]" data-testid="select-training-section">
                <SelectValue placeholder="Раздел" />
              </SelectTrigger>
              <SelectContent>
                {SECTION_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Аудитория</span>
            <Select value={audience} onValueChange={(v) => setAudience(v as typeof AUDIENCE_FILTER_ANY | TrainingAudience)}>
              <SelectTrigger className="h-11 min-h-[44px]" data-testid="select-training-audience">
                <SelectValue placeholder="Аудитория" />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Тип</span>
            <Select value={type} onValueChange={(v) => setType(v as typeof ALL | TrainingMaterialType)}>
              <SelectTrigger className="h-11 min-h-[44px]" data-testid="select-training-type">
                <SelectValue placeholder="Тип" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Статус материала">
          {STATUS_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={c.testId}
              onClick={() => setStatusChip(c.id)}
              className={cn(
                "min-h-10 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                statusChip === c.id
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-training-sections">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Разделы</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {(Object.keys(TRAINING_SECTION_LABEL) as TrainingSection[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => pickSection(key)}
              data-testid={SECTION_CARD_TEST[key]}
              className="group flex min-h-[120px] flex-col items-start justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <BookOpen className="h-6 w-6 text-primary" aria-hidden />
              <span className="text-sm font-semibold leading-snug text-foreground">{TRAINING_SECTION_LABEL[key]}</span>
              <span className="text-xs text-muted-foreground">Показать материалы раздела</span>
            </button>
          ))}
        </div>
      </section>

      <section ref={materialsRef} className="scroll-mt-28 space-y-4 sm:scroll-mt-32" data-testid="section-training-materials">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Материалы</h2>
          <p className="text-sm text-muted-foreground">
            Найдено: <span className="font-semibold text-foreground">{filtered.length}</span>
          </p>
        </div>
        <div className="grid gap-3">
          {filtered.map((m) => (
            <Card key={m.id} className="border-border/70 shadow-xs" data-testid={`card-training-material-${m.id}`}>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <h3 className="text-base font-semibold leading-snug text-foreground sm:text-lg">{m.title}</h3>
                    <p className="text-sm text-muted-foreground">{m.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="font-medium">
                        {TRAINING_SECTION_LABEL[m.section]}
                      </Badge>
                      <Badge variant="outline" className="font-medium">
                        {TRAINING_TYPE_LABEL[m.type]}
                      </Badge>
                      <Badge variant="outline" className={cn("font-medium", statusBadgeClass(m.status))}>
                        {TRAINING_STATUS_LABEL[m.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Аудитория:{" "}
                      <span className="font-medium text-foreground">
                        {m.audience.map((a) => TRAINING_AUDIENCE_LABEL[a]).join(", ")}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        Чтение: <span className="font-medium text-foreground">{m.readTimeMinutes} мин</span>
                      </span>
                      <span>
                        Прогресс: <span className="font-medium text-foreground">{m.progressPercent}%</span>
                      </span>
                      <span>
                        Обновлено: <span className="font-medium text-foreground">{m.updatedAt}</span>
                      </span>
                    </div>
                    {m.relatedProductIds.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Связанные товары:{" "}
                        <span className="font-medium text-foreground">
                          {m.relatedProductIds
                            .map((pid) => getProductById(pid)?.name ?? pid)
                            .join(", ")}
                        </span>
                      </p>
                    ) : null}
                    {m.relatedTaskIds.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Связанные задачи:{" "}
                        <span className="font-mono font-medium text-foreground">{m.relatedTaskIds.join(", ")}</span>
                      </p>
                    ) : null}
                  </div>
                  <Button asChild className="w-full shrink-0 font-semibold sm:w-auto sm:min-w-[8rem]" data-testid={`button-open-training-material-${m.id}`}>
                    <Link href={`/training/${m.id}`}>
                      Открыть
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {filtered.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-muted/20">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">Нет материалов по выбранным условиям. Измените фильтры.</CardContent>
          </Card>
        ) : null}
      </section>

      <section className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 sm:p-6" data-testid="section-training-wiki-import">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Импорт из корпоративной Wiki</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Материалы будут переноситься из корпоративной Wiki после инвентаризации и проверки актуальности.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-foreground">
          <li>Инвентаризация</li>
          <li>Экспорт</li>
          <li>Конвертация</li>
          <li>Проверка</li>
          <li>Связь с каталогом и задачами</li>
        </ol>
      </section>
    </div>
  );
}
