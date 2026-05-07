import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { BookOpen, ChevronRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  countTrainingMaterialsForProductQuickTrack,
  getAllTrainingMaterials,
  getTrainingAssignments,
  getTrainingDashboardSummary,
  getTrainingPrograms,
  searchTrainingMaterials,
  summarizeTrainingKpis,
  TRAINING_AUDIENCE_LABEL,
  TRAINING_PROGRAM_LEVEL_LABEL,
  TRAINING_PROGRESS_STATUS_LABEL,
  TRAINING_ROLE_LABEL,
  TRAINING_SECTION_LABEL,
  TRAINING_STATUS_LABEL,
  TRAINING_TYPE_LABEL,
  TRAINING_WIKI_REVIEW_LABEL,
  type TrainingMaterial,
  type TrainingMaterialStatus,
  type TrainingMaterialType,
  type TrainingProgressStatus,
  type TrainingRole,
  type TrainingSection,
} from "@/lib/training-data";
import { getProductById } from "@/lib/catalog-data";
import { getWikiTrainingImportSummary } from "@/lib/training-wiki-import";
import { getWikiTrainingContentByPriority, getWikiTrainingContentMapSummary, WIKI_MAP_REVIEW_LABEL } from "@/lib/training-wiki-content-map";

type StatusFilter = "all" | TrainingMaterialStatus;

const ALL = "all" as const;

const SECTION_FILTER_OPTIONS: { value: typeof ALL | TrainingSection; label: string }[] = [
  { value: ALL, label: "Все разделы" },
  { value: "product", label: TRAINING_SECTION_LABEL.product },
  { value: "sales", label: TRAINING_SECTION_LABEL.sales },
  { value: "onboarding", label: TRAINING_SECTION_LABEL.onboarding },
  { value: "regulations", label: TRAINING_SECTION_LABEL.regulations },
  { value: "development", label: TRAINING_SECTION_LABEL.development },
];

const ROLE_FILTER_OPTIONS: { value: typeof ALL | TrainingRole; label: string }[] = [
  { value: ALL, label: "Все роли" },
  { value: "manager", label: TRAINING_ROLE_LABEL.manager },
  { value: "regional_manager", label: TRAINING_ROLE_LABEL.regional_manager },
  { value: "leadership", label: TRAINING_ROLE_LABEL.leadership },
  { value: "new_hire", label: TRAINING_ROLE_LABEL.new_hire },
];

const REQUIRED_FILTER_OPTIONS: { value: "all" | "required" | "optional"; label: string }[] = [
  { value: "all", label: "Все по обязательности" },
  { value: "required", label: "Только обязательные" },
  { value: "optional", label: "Только рекомендованные" },
];

const PROGRESS_FILTER_OPTIONS: { value: typeof ALL | TrainingProgressStatus; label: string }[] = [
  { value: ALL, label: "Любой прогресс" },
  { value: "not_started", label: TRAINING_PROGRESS_STATUS_LABEL.not_started },
  { value: "in_progress", label: TRAINING_PROGRESS_STATUS_LABEL.in_progress },
  { value: "completed", label: TRAINING_PROGRESS_STATUS_LABEL.completed },
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

function statusBadgeClass(status: TrainingMaterial["status"]) {
  if (status === "required") return "border-primary/50 bg-primary/15 text-foreground";
  if (status === "new") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "updated") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted/60 text-foreground";
}

export default function TrainingPage() {
  const all = useMemo(() => getAllTrainingMaterials(), []);
  const kpis = useMemo(() => summarizeTrainingKpis(all), [all]);
  const dashboard = useMemo(() => getTrainingDashboardSummary(), []);
  const programs = useMemo(() => getTrainingPrograms(), []);
  const assignments = useMemo(() => getTrainingAssignments(), []);
  const wikiSummary = useMemo(() => getWikiTrainingImportSummary(), []);
  const wikiMapSummary = useMemo(() => getWikiTrainingContentMapSummary(), []);
  const wikiMapP0Preview = useMemo(() => getWikiTrainingContentByPriority("P0").slice(0, 8), []);
  const materialsRef = useRef<HTMLElement>(null);

  const [search, setSearch] = useState("");
  const [section, setSection] = useState<typeof ALL | TrainingSection>(ALL);
  const [role, setRole] = useState<typeof ALL | TrainingRole>(ALL);
  const [type, setType] = useState<typeof ALL | TrainingMaterialType>(ALL);
  const [requiredFilter, setRequiredFilter] = useState<"all" | "required" | "optional">("all");
  const [progressFilter, setProgressFilter] = useState<typeof ALL | TrainingProgressStatus>(ALL);
  const [sourceFilter, setSourceFilter] = useState<typeof ALL | "wiki" | "manual">(ALL);
  const [statusChip, setStatusChip] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const req = requiredFilter === "required" ? "required" : requiredFilter === "optional" ? "optional" : "all";
    const prog = progressFilter === ALL ? "all" : progressFilter;
    const src = sourceFilter === ALL ? "all" : sourceFilter;
    return searchTrainingMaterials(search, {
      section: section === ALL ? "all" : section,
      role: role === ALL ? "all" : role,
      type: type === ALL ? "all" : type,
      required: req,
      progressStatus: prog,
      source: src,
    }).filter((m) => statusChip === "all" || m.status === statusChip);
  }, [all, search, section, role, type, statusChip, requiredFilter, progressFilter, sourceFilter]);

  const scrollToMaterials = useCallback(() => {
    materialsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const applySearchPreset = useCallback(
    (query: string, nextSection: typeof ALL | TrainingSection) => {
      setSearch(query);
      setSection(nextSection);
      setStatusChip("all");
      setType(ALL);
      setRole(ALL);
      setRequiredFilter("all");
      setProgressFilter(ALL);
      setSourceFilter(ALL);
      requestAnimationFrame(() => scrollToMaterials());
    },
    [scrollToMaterials],
  );

  const resetMaterialsView = useCallback(() => {
    setSearch("");
    setSection(ALL);
    setStatusChip("all");
    setType(ALL);
    setRole(ALL);
    setRequiredFilter("all");
    setProgressFilter(ALL);
    setSourceFilter(ALL);
  }, []);

  const vhMaterialCount = useMemo(() => countTrainingMaterialsForProductQuickTrack("vh"), []);
  const mkMaterialCount = useMemo(() => countTrainingMaterialsForProductQuickTrack("mk"), []);
  const hwMaterialCount = useMemo(() => countTrainingMaterialsForProductQuickTrack("hardware"), []);

  const progProductLines = useMemo(() => programs.find((p) => p.id === "prog-product-lines"), [programs]);
  const progHardwareSales = useMemo(() => programs.find((p) => p.id === "prog-hardware-sales"), [programs]);
  const progSalesHits = useMemo(() => programs.find((p) => p.id === "prog-sales-hits"), [programs]);

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
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-6"
        data-testid="section-training-hero"
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative flex flex-col gap-4 pl-3 sm:flex-row sm:items-center sm:justify-between sm:pl-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <GraduationCap className="h-6 w-6 shrink-0" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">База знаний</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Обучение</h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Помощь менеджеру: продукт, скрипты и ответы перед звонком или визитом
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Button asChild className="min-h-10 font-semibold sm:min-h-9" data-testid="button-training-open-main">
              <Link href="/main">К главному</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold sm:min-h-9" data-testid="button-training-open-catalog">
              <Link href="/catalog">Каталог</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold sm:min-h-9" data-testid="button-training-open-tasks">
              <Link href="/tasks">Задачи</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold sm:min-h-9" data-testid="button-training-open-analytics">
              <Link href="/analytics">Аналитика</Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-6"
        data-testid="section-training-search-hero"
      >
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Найдите материал за секунды</h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            Материал, скрипт, ответ на возражение или товарная подсказка — по заголовку, тегам и содержанию.
          </p>
        </div>
        <div className="min-w-0">
          <label className="mb-2 block text-xs font-medium text-muted-foreground" htmlFor="input-training-search">
            Поиск по базе
          </label>
          <Input
            id="input-training-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Например: ВХ двери, замки, возражение дорого, скрипт звонка…"
            className="h-12 min-h-[48px] w-full min-w-0 border-border/80 text-base"
            data-testid="input-training-search"
          />
        </div>
        <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label="Быстрые запросы">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-9 shrink-0 rounded-full font-medium"
            data-testid="button-training-search-chip-vh"
            onClick={() => applySearchPreset("ВХ двери", "product")}
          >
            ВХ двери
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-9 shrink-0 rounded-full font-medium"
            data-testid="button-training-search-chip-mk"
            onClick={() => applySearchPreset("МК двери", "product")}
          >
            МК двери
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-9 shrink-0 rounded-full font-medium"
            data-testid="button-training-search-chip-hardware"
            onClick={() => applySearchPreset("фурнитура комплектация", "product")}
          >
            Фурнитура
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 shrink-0 rounded-full border-border font-medium"
            data-testid="button-training-search-chip-objections"
            onClick={() => applySearchPreset("возражение дорого конкуренты подумаю", "sales")}
          >
            Возражения
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 shrink-0 rounded-full border-border font-medium"
            data-testid="button-training-search-chip-scripts"
            onClick={() => applySearchPreset("скрипт звонок консультация", "sales")}
          >
            Скрипты
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 shrink-0 rounded-full border-border font-medium"
            data-testid="button-training-search-chip-price"
            onClick={() => applySearchPreset("цена стоимость ценность", "sales")}
          >
            Цена
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9 shrink-0 rounded-full font-medium"
            data-testid="button-training-search-chip-locks"
            onClick={() => applySearchPreset("замки покрытия", "product")}
          >
            Замки · покрытия
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9 shrink-0 rounded-full font-medium"
            data-testid="button-training-search-chip-completeness"
            onClick={() => applySearchPreset("комплектация петли ручки", "product")}
          >
            Комплектация
          </Button>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-training-product-first">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Сначала продукт</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Входные и межкомнатные двери и фурнитура — то, с чего чаще всего начинается консультация.
          </p>
        </div>
        <div className="grid min-w-0 gap-3 md:grid-cols-3">
          <Card className="min-w-0 border-border/80 shadow-md" data-testid="card-training-product-vh">
            <CardHeader className="space-y-2 pb-2">
              <CardTitle className="text-base">ВХ двери</CardTitle>
              <p className="text-sm text-muted-foreground">
                Карточка модели, конструкция, замки и аргументы продажи для входной группы.
              </p>
              <p className="text-xs text-muted-foreground">
                Материалов по направлению: <span className="font-semibold text-foreground">{vhMaterialCount}</span>
                {progProductLines ? (
                  <>
                    {" "}
                    · программа «{progProductLines.title}»:{" "}
                    <span className="font-semibold text-foreground">{progProductLines.totalMaterials}</span> позиций
                  </>
                ) : null}
              </p>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                <li>Карточка модели и складская программа</li>
                <li>Замки и комплект безопасности</li>
                <li>Сравнение и аргументы на витрине</li>
              </ul>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <Button
                type="button"
                className="w-full min-h-10 font-semibold"
                data-testid="button-training-open-product-vh"
                onClick={() => applySearchPreset("ВХ двери входные", "product")}
              >
                Открыть материалы
              </Button>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/80 shadow-md" data-testid="card-training-product-mk">
            <CardHeader className="space-y-2 pb-2">
              <CardTitle className="text-base">МК двери</CardTitle>
              <p className="text-sm text-muted-foreground">Покрытия, материалы полотна, линейки и скрытые решения.</p>
              <p className="text-xs text-muted-foreground">
                Материалов по направлению: <span className="font-semibold text-foreground">{mkMaterialCount}</span>
                {progProductLines ? (
                  <>
                    {" "}
                    · программа «{progProductLines.title}»:{" "}
                    <span className="font-semibold text-foreground">{progProductLines.totalMaterials}</span> позиций
                  </>
                ) : null}
              </p>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                <li>Ассортимент и подбор под интерьер</li>
                <li>MDF, HDF, SPC, ПЭТ</li>
                <li>Линейки и сравнение на полу</li>
              </ul>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <Button
                type="button"
                className="w-full min-h-10 font-semibold"
                data-testid="button-training-open-product-mk"
                onClick={() => applySearchPreset("МК двери межкомнатные", "product")}
              >
                Открыть материалы
              </Button>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/80 shadow-md" data-testid="card-training-product-hardware">
            <CardHeader className="space-y-2 pb-2">
              <CardTitle className="text-base">Фурнитура</CardTitle>
              <p className="text-sm text-muted-foreground">Комплектация, допродажа с дверью и типовые ошибки подбора.</p>
              <p className="text-xs text-muted-foreground">
                Материалов по направлению: <span className="font-semibold text-foreground">{hwMaterialCount}</span>
                {progHardwareSales ? (
                  <>
                    {" "}
                    · программа «{progHardwareSales.title}»:{" "}
                    <span className="font-semibold text-foreground">{progHardwareSales.totalMaterials}</span> позиций
                  </>
                ) : null}
              </p>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                <li>Петли, ручки, замки, доборы</li>
                <li>Чек-лист комплектации</li>
                <li>QR и паспорт изделия</li>
              </ul>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <Button
                type="button"
                className="w-full min-h-10 font-semibold"
                data-testid="button-training-open-product-hardware"
                onClick={() => applySearchPreset("фурнитура петли ручки", "product")}
              >
                Открыть материалы
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-training-sales-help">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Продажи и консультация</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Скрипты, возражения, реакции клиента и подготовка к визиту — второй уровень после продукта.
            {progSalesHits ? (
              <span>
                {" "}
                Программа «{progSalesHits.title}» — <span className="font-medium text-foreground">{progSalesHits.totalMaterials}</span>{" "}
                материалов.
              </span>
            ) : null}
          </p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-sales-scripts">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold text-foreground">Скрипты продаж</CardTitle>
              <p className="text-xs text-muted-foreground">Звонок, шоурум, подбор, фурнитура, повторное касание.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pb-4 pt-0">
              <Button type="button" variant="secondary" className="min-h-10 w-full font-semibold" onClick={() => applySearchPreset("скрипт звонок консультация", "sales")}>
                Показать материалы
              </Button>
              <Button asChild variant="outline" size="sm" className="min-h-9 w-full border-border font-semibold" data-testid="button-open-training-material-tr-sales-scripts-core">
                <Link href="/training/tr-sales-scripts-core">Скрипты: курс</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="min-h-9 w-full border-border font-semibold">
                <Link href="/training/programs/prog-sales-hits">К программе</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-sales-objections">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold text-foreground">Возражения</CardTitle>
              <p className="text-xs text-muted-foreground">Дорого, конкуренты, «подумаю», сроки, качество, цвет и размер.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pb-4 pt-0">
              <Button type="button" variant="secondary" className="min-h-10 w-full font-semibold" onClick={() => applySearchPreset("возражение дорого подумаю конкуренты", "sales")}>
                Показать материалы
              </Button>
              <Button asChild variant="outline" size="sm" className="min-h-9 w-full border-border font-semibold" data-testid="button-open-training-material-tr-sales-objections-ready-answers">
                <Link href="/training/tr-sales-objections-ready-answers">Готовые ответы</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-sales-reactions">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold text-foreground">Реакции клиента</CardTitle>
              <p className="text-xs text-muted-foreground">Молчит, торгуется, спешит, сравнивает, «просто посмотреть».</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pb-4 pt-0">
              <Button type="button" variant="secondary" className="min-h-10 w-full font-semibold" onClick={() => applySearchPreset("реакция клиента молчит торгуется", "sales")}>
                Показать материалы
              </Button>
              <Button asChild variant="outline" size="sm" className="min-h-9 w-full border-border font-semibold" data-testid="button-open-training-material-tr-sales-client-reactions-playbook">
                <Link href="/training/tr-sales-client-reactions-playbook">Справочник реакций</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-sales-consultation">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold text-foreground">Консультация и подготовка</CardTitle>
              <p className="text-xs text-muted-foreground">Карточка товара, визит в зал, сравнение моделей.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pb-4 pt-0">
              <Button type="button" variant="secondary" className="min-h-10 w-full font-semibold" onClick={() => applySearchPreset("консультация подготовка карточка", "sales")}>
                Показать материалы
              </Button>
              <Button asChild variant="outline" size="sm" className="min-h-9 w-full border-border font-semibold" data-testid="button-open-training-material-tr-sales-consult-prep">
                <Link href="/training/tr-sales-consult-prep">Подготовка к визиту</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-training-kpis">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Показатели обучения</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-kpi-progress">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Прогресс месяца</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{dashboard.monthProgressPercent}%</p>
              <Progress value={dashboard.monthProgressPercent} className="h-2" />
              <p className="text-xs text-muted-foreground">Средняя заполненность материалов по выборке.</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-kpi-required">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Обязательные</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {dashboard.requiredCompleted}/{dashboard.requiredTotal}
              </p>
              <p className="text-xs text-muted-foreground">Завершено из обязательных материалов</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-kpi-in-progress">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">В работе</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{dashboard.inProgressCount}</p>
              <p className="text-xs text-muted-foreground">Материалы с частичным прогрессом</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-kpi-attention">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Требует внимания</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{dashboard.attentionCount}</p>
              <p className="text-xs text-muted-foreground">Назначения с высоким приоритетом</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-kpi-wiki-imported">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Из Wiki</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{wikiSummary.totalImported}</p>
              <p className="text-xs text-muted-foreground">Материалов импортировано</p>
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground">
          Всего материалов в базе: {kpis.total}. Доступно для партнёров: {kpis.dealerAccess}.
        </p>
      </section>

      <section className="space-y-4" data-testid="section-training-programs">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Мои программы</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {programs.map((p) => (
            <Card key={p.id} className="min-w-0 border-border/80 shadow-md" data-testid={`card-training-program-${p.id}`}>
              <CardHeader className="space-y-2 pb-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{TRAINING_ROLE_LABEL[p.role]}</Badge>
                  <Badge variant="outline">{TRAINING_SECTION_LABEL[p.section]}</Badge>
                  <Badge variant="outline">{TRAINING_PROGRAM_LEVEL_LABEL[p.level]}</Badge>
                </div>
                <CardTitle className="text-base leading-snug">{p.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{p.description.slice(0, 120)}…</p>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Материалы: {p.completedMaterials}/{p.totalMaterials}
                  </span>
                  <span>~{p.durationMinutes} мин</span>
                </div>
                <Progress value={p.progressPercent} className="h-2" />
                <Button asChild className="w-full min-h-10 font-semibold" data-testid={`button-open-training-program-${p.id}`}>
                  <Link href={`/training/programs/${p.id}`}>Открыть программу</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-training-assignments">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Назначено мне</h2>
        <div className="grid min-w-0 gap-3">
          {assignments.map((a) => (
            <Card key={a.id} className="min-w-0 border-border/70 shadow-xs" data-testid={`card-training-assignment-${a.id}`}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Срок {a.dueDate} · приоритет {a.priority === "high" ? "высокий" : a.priority === "medium" ? "средний" : "низкий"} ·{" "}
                    {TRAINING_PROGRESS_STATUS_LABEL[a.status]}
                  </p>
                </div>
                <Button asChild variant="secondary" className="min-h-10 w-full shrink-0 font-semibold sm:w-auto" data-testid={`button-open-training-assignment-${a.id}`}>
                  <Link href={`/training/${a.materialId}`}>Открыть</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-training-sections">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Разделы базы знаний</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Результаты подбора</h2>
            <p className="text-xs text-muted-foreground">Поле поиска — вверху страницы. Здесь фильтры и список карточек.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Найдено: <span className="font-semibold text-foreground">{filtered.length}</span>
            </p>
            <Button type="button" variant="outline" size="sm" className="min-h-9 shrink-0 font-semibold" onClick={resetMaterialsView}>
              Все материалы
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <h3 className="text-sm font-semibold text-foreground">Фильтры списка</h3>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Раздел</span>
              <Select value={section} onValueChange={(v) => setSection(v as typeof ALL | TrainingSection)}>
                <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-training-section">
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
            <div className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Роль</span>
              <Select value={role} onValueChange={(v) => setRole(v as typeof ALL | TrainingRole)}>
                <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-training-role">
                  <SelectValue placeholder="Роль" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_FILTER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Тип</span>
              <Select value={type} onValueChange={(v) => setType(v as typeof ALL | TrainingMaterialType)}>
                <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-training-type">
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
            <div className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Обязательность</span>
              <Select value={requiredFilter} onValueChange={(v) => setRequiredFilter(v as "all" | "required" | "optional")}>
                <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-training-required">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUIRED_FILTER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Прогресс</span>
              <Select value={progressFilter} onValueChange={(v) => setProgressFilter(v as typeof ALL | TrainingProgressStatus)}>
                <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-training-progress">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROGRESS_FILTER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Источник</span>
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof ALL | "wiki" | "manual")}>
                <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-training-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Все</SelectItem>
                  <SelectItem value="wiki">Wiki</SelectItem>
                  <SelectItem value="manual">Ручные</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Статус публикации материала">
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
        </div>

        {filtered.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-muted/20" data-testid="empty-training-materials-results">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Нет материалов по выбранным условиям. Измените поиск или фильтры.
            </CardContent>
          </Card>
        ) : (
          <div className="grid min-w-0 gap-3">
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
                        {m.required ? (
                          <Badge variant="secondary" className="font-semibold">
                            Обязательно к прохождению
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="font-medium">
                          {TRAINING_PROGRESS_STATUS_LABEL[m.progressStatus]}
                        </Badge>
                        <Badge variant="outline" className="text-muted-foreground">
                          Сложность: {m.difficulty === "easy" ? "лёгкая" : m.difficulty === "hard" ? "высокая" : "средняя"}
                        </Badge>
                        {m.sourceType === "wiki" ? (
                          <Badge
                            variant="secondary"
                            className="border-primary/30 bg-primary/5 font-semibold"
                            data-testid={`badge-training-material-source-${m.id}`}
                          >
                            Wiki · {TRAINING_WIKI_REVIEW_LABEL[m.reviewStatus ?? m.wikiSource?.wikiReviewStatus ?? "needs_review"]}
                          </Badge>
                        ) : null}
                      </div>
                      {m.knowledgeTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {m.knowledgeTags.map((t) => (
                            <Badge key={t} variant="secondary" className="rounded-md text-[11px] font-normal">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Аудитория:{" "}
                        <span className="font-medium text-foreground">
                          {m.audience.map((a) => TRAINING_AUDIENCE_LABEL[a]).join(", ")}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>
                          Время: <span className="font-medium text-foreground">{m.durationMinutes} мин</span>
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
        )}
      </section>

      <section className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-5 sm:p-6" data-testid="section-training-wiki-import">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Импорт из корпоративной Wiki</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Материалы загружены из закрытой базы знаний в безопасном формате. Полные тексты подключаются после ревью и настройки закрытого хранилища.
        </p>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <p className="font-medium text-foreground">
            Импортировано материалов: <span className="tabular-nums">{wikiSummary.totalImported}</span>
          </p>
          <p className="font-medium text-foreground">
            На проверке: <span className="tabular-nums">{wikiSummary.needsReview}</span>
          </p>
        </div>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p>Распределение по разделам:</p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(wikiSummary.bySection)
              .filter(([, count]) => count > 0)
              .map(([s, count]) => (
              <li key={s} className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                <span>
                  {s === "other"
                    ? "Прочее"
                    : s in TRAINING_SECTION_LABEL
                      ? TRAINING_SECTION_LABEL[s as TrainingSection]
                      : s}
                  : {count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border/80 bg-card p-5 shadow-xs sm:p-6" data-testid="section-training-wiki-map">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Карта наполнения Wiki</h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              План переноса тем из закрытой базы в учебные программы: приоритеты, роли и сценарии без полных текстов и внутренних ссылок.
            </p>
          </div>
          <Button asChild className="h-11 min-h-[44px] w-full shrink-0 font-semibold sm:w-auto sm:min-w-[11rem]" data-testid="button-training-open-wiki-map">
            <Link href="/training/wiki-map">Открыть карту Wiki</Link>
          </Button>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-wiki-map-total">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">В карте</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{wikiMapSummary.total}</p>
              <p className="text-xs text-muted-foreground">Позиций дорожной карты</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-wiki-map-p0">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">P0</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{wikiMapSummary.byPriority.P0}</p>
              <p className="text-xs text-muted-foreground">Первая очередь переноса</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-wiki-map-review">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">На ревью</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{wikiMapSummary.needsReview}</p>
              <p className="text-xs text-muted-foreground">Требуют проверки перед импортом</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-training-wiki-map-catalog">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Каталог</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{wikiMapSummary.catalogLinked}</p>
              <p className="text-xs text-muted-foreground">Связка с линейками / ассортиментом</p>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">P0 — первая очередь (фрагмент)</h3>
          <ul className="min-w-0 space-y-2">
            {wikiMapP0Preview.map((item) => (
              <li
                key={item.id}
                data-testid={`card-training-wiki-map-item-${item.id}`}
                className="flex min-w-0 flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-foreground">{item.wikiTitle}</p>
                  <p className="text-xs text-muted-foreground">{item.safeSummary}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Зачем:</span> {item.reason}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5 sm:flex-col sm:items-end">
                  <Badge variant="secondary" className="font-semibold tabular-nums">
                    {item.priority}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-medium">
                    {WIKI_MAP_REVIEW_LABEL[item.reviewStatus]}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
