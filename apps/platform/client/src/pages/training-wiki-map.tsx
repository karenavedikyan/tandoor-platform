import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import {
  getWikiTrainingAvailableProgramIds,
  getWikiTrainingContentGaps,
  getWikiTrainingContentMap,
  getWikiTrainingContentMapSummary,
  getWikiTrainingMapAudienceRolesCoveredCount,
  WIKI_MAP_REVIEW_LABEL,
  WIKI_TRAINING_AUDIENCE_LABEL,
  WIKI_TRAINING_PRODUCT_SCOPE_LABEL,
  WIKI_TRAINING_WORK_CONTEXT_LABEL,
  type WikiTrainingAudience,
  type WikiTrainingContentMapItem,
  type WikiTrainingMapReviewStatus,
  type WikiTrainingPriority,
  type WikiTrainingProductScope,
} from "@/lib/training-wiki-content-map";
import { getTrainingProgramById, TRAINING_SECTION_LABEL, type TrainingSectionKey } from "@/lib/training-data";

const ALL = "all" as const;

type SectionFilterValue = typeof ALL | TrainingSectionKey | "other";

function programShortLabel(programId: string): string {
  return getTrainingProgramById(programId)?.title ?? programId;
}

export default function TrainingWikiMapPage() {
  const map = useMemo(() => getWikiTrainingContentMap(), []);
  const summary = useMemo(() => getWikiTrainingContentMapSummary(), []);
  const gaps = useMemo(() => getWikiTrainingContentGaps(), []);
  const programIds = useMemo(() => getWikiTrainingAvailableProgramIds(), []);
  const audienceRolesCovered = useMemo(() => getWikiTrainingMapAudienceRolesCoveredCount(), []);

  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<typeof ALL | WikiTrainingPriority>(ALL);
  const [audience, setAudience] = useState<typeof ALL | WikiTrainingAudience>(ALL);
  const [section, setSection] = useState<SectionFilterValue>(ALL);
  const [productScope, setProductScope] = useState<typeof ALL | WikiTrainingProductScope>(ALL);
  const [reviewStatus, setReviewStatus] = useState<typeof ALL | WikiTrainingMapReviewStatus>(ALL);
  const [program, setProgram] = useState<typeof ALL | string>(ALL);

  const resetFilters = useCallback(() => {
    setSearch("");
    setPriority(ALL);
    setAudience(ALL);
    setSection(ALL);
    setProductScope(ALL);
    setReviewStatus(ALL);
    setProgram(ALL);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return map.filter((item) => {
      if (q) {
        const blob = `${item.wikiTitle} ${item.safeSummary} ${item.reason}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (priority !== ALL && item.priority !== priority) return false;
      if (audience !== ALL && !item.audiences.includes(audience)) return false;
      if (section !== ALL && item.section !== section) return false;
      if (productScope !== ALL && item.productScope !== productScope) return false;
      if (reviewStatus !== ALL && item.reviewStatus !== reviewStatus) return false;
      if (program !== ALL && !item.targetProgramIds.includes(program)) return false;
      return true;
    });
  }, [map, search, priority, audience, section, productScope, reviewStatus, program]);

  return (
    <div className="min-w-0 space-y-8 pb-28 sm:space-y-10" data-testid="page-training-wiki-map">
      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8"
        data-testid="section-training-wiki-map-hero"
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative min-w-0 space-y-4 pl-3 sm:pl-4">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Карта Wiki</h1>
            <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
              План переноса материалов из базы знаний в обучение, программы и рабочие сценарии.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Button asChild className="min-h-11 w-full font-semibold" data-testid="button-wiki-map-open-training">
              <Link href="/training">К обучению</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card font-semibold" data-testid="button-wiki-map-open-programs">
              <Link href="/training">К программам</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card font-semibold" data-testid="button-wiki-map-open-catalog">
              <Link href="/catalog">Каталог</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card font-semibold" data-testid="button-wiki-map-open-tasks">
              <Link href="/tasks">Задачи</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-training-wiki-map-kpis">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Сводка</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-map-total">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Всего элементов</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{summary.total}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-map-p0">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">P0</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{summary.byPriority.P0}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-map-review">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">На ревью</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{summary.needsReview}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-map-catalog">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Связано с каталогом</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{summary.catalogLinked}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-map-audiences">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ролей покрыто</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {audienceRolesCovered}
                <span className="text-lg font-normal text-muted-foreground"> / 4</span>
              </p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-map-gaps">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Пробелов</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{gaps.length}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6" data-testid="section-training-wiki-map-filters">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Фильтры</h2>
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="input-wiki-map-search">
              Поиск
            </label>
            <Input
              id="input-wiki-map-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Заголовок, описание, причина…"
              className="h-11 min-h-[44px] w-full min-w-0"
              data-testid="input-wiki-map-search"
            />
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Приоритет</span>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof ALL | WikiTrainingPriority)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-map-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все</SelectItem>
                <SelectItem value="P0">P0</SelectItem>
                <SelectItem value="P1">P1</SelectItem>
                <SelectItem value="P2">P2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Роль</span>
            <Select value={audience} onValueChange={(v) => setAudience(v as typeof ALL | WikiTrainingAudience)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-map-audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все</SelectItem>
                {(Object.keys(WIKI_TRAINING_AUDIENCE_LABEL) as WikiTrainingAudience[]).map((a) => (
                  <SelectItem key={a} value={a}>
                    {WIKI_TRAINING_AUDIENCE_LABEL[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Раздел</span>
            <Select value={section} onValueChange={(v) => setSection(v as SectionFilterValue)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-map-section">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все</SelectItem>
                <SelectItem value="product">{TRAINING_SECTION_LABEL.product}</SelectItem>
                <SelectItem value="sales">{TRAINING_SECTION_LABEL.sales}</SelectItem>
                <SelectItem value="onboarding">{TRAINING_SECTION_LABEL.onboarding}</SelectItem>
                <SelectItem value="regulations">{TRAINING_SECTION_LABEL.regulations}</SelectItem>
                <SelectItem value="development">{TRAINING_SECTION_LABEL.development}</SelectItem>
                <SelectItem value="other">Другое</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Категория</span>
            <Select value={productScope} onValueChange={(v) => setProductScope(v as typeof ALL | WikiTrainingProductScope)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-map-product-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все</SelectItem>
                {(Object.keys(WIKI_TRAINING_PRODUCT_SCOPE_LABEL) as WikiTrainingProductScope[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {WIKI_TRAINING_PRODUCT_SCOPE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Статус ревью</span>
            <Select value={reviewStatus} onValueChange={(v) => setReviewStatus(v as typeof ALL | WikiTrainingMapReviewStatus)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-map-review-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все</SelectItem>
                <SelectItem value="needs_review">needs_review</SelectItem>
                <SelectItem value="approved">approved</SelectItem>
                <SelectItem value="archive_candidate">archive_candidate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 md:col-span-2 xl:col-span-1">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Программа</span>
            <Select value={program} onValueChange={(v) => setProgram(v as typeof ALL | string)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-map-program">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все</SelectItem>
                {programIds.map((pid) => (
                  <SelectItem key={pid} value={pid}>
                    {programShortLabel(pid)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Найдено:{" "}
            <span className="font-semibold tabular-nums text-foreground" data-testid="text-wiki-map-results-count">
              {filtered.length}
            </span>
          </p>
          <Button type="button" variant="outline" className="min-h-11 w-full font-semibold sm:w-auto" data-testid="button-wiki-map-reset-filters" onClick={resetFilters}>
            Сбросить фильтры
          </Button>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-training-wiki-map-list">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Элементы карты</h2>
        {filtered.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-muted/20" data-testid="empty-wiki-map-results">
            <CardContent className="flex min-w-0 flex-col gap-3 p-6 text-center sm:text-left">
              <p className="text-sm text-muted-foreground">По выбранным фильтрам материалов нет.</p>
              <Button type="button" variant="secondary" className="mx-auto min-h-11 w-full max-w-xs font-semibold sm:mx-0 sm:w-auto" data-testid="button-wiki-map-empty-reset" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
            {filtered.map((item) => (
              <WikiMapItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4" data-testid="section-training-wiki-map-gaps">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Пробелы и следующие шаги</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {gaps.map((text, index) => (
            <Card key={`gap-${index}`} className="min-w-0 border-border/70 shadow-xs" data-testid={`card-wiki-map-gap-${index}`}>
              <CardContent className="p-4 text-sm text-muted-foreground">
                <p className="leading-relaxed text-foreground">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <FloatingBackButton href="/training" label="К обучению" testId="floating-back-to-training" ariaLabel="К обучению" />
    </div>
  );
}

function WikiMapItemCard({ item }: { item: WikiTrainingContentMapItem }) {
  const firstProgramId = item.targetProgramIds[0];
  return (
    <Card className="min-w-0 overflow-hidden border-border/70 shadow-xs" data-testid={`card-wiki-map-item-${item.id}`}>
      <CardHeader className="min-w-0 space-y-2 pb-2 pt-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <CardTitle className="min-w-0 text-base leading-snug">{item.wikiTitle}</CardTitle>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Badge variant="secondary" className="font-semibold tabular-nums">
              {item.priority}
            </Badge>
            <Badge variant="outline" className="text-xs font-medium">
              {WIKI_MAP_REVIEW_LABEL[item.reviewStatus]}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Раздел:{" "}
          <span className="font-medium text-foreground">
            {item.section === "other" ? "Другое" : TRAINING_SECTION_LABEL[item.section as TrainingSectionKey]}
          </span>
        </p>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3 pb-4 pt-0">
        <div className="flex flex-wrap gap-1.5">
          {item.audiences.map((a) => (
            <Badge key={a} variant="outline" className="text-[11px] font-normal">
              {WIKI_TRAINING_AUDIENCE_LABEL[a]}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Категория: <span className="font-medium text-foreground">{WIKI_TRAINING_PRODUCT_SCOPE_LABEL[item.productScope]}</span>
        </p>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Программы</p>
          <p className="mt-1 break-words text-xs text-foreground">
            {item.targetProgramIds.length > 0 ? item.targetProgramIds.map(programShortLabel).join(" · ") : "—"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Сценарии</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {item.workContexts.map((w) => (
              <Badge key={w} variant="secondary" className="rounded-md text-[11px] font-normal">
                {WIKI_TRAINING_WORK_CONTEXT_LABEL[w]}
              </Badge>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Кратко:</span> {item.safeSummary}
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Зачем:</span> {item.reason}
        </p>
        {item.migrationNotes.length > 0 ? (
          <div className="min-w-0 rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="text-xs font-medium text-foreground">Заметки по переносу</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
              {item.migrationNotes.map((note, i) => (
                <li key={`${item.id}-mn-${i}`}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          {firstProgramId ? (
            <Button asChild variant="secondary" className="min-h-11 w-full font-semibold sm:w-auto" data-testid={`button-wiki-map-open-program-${item.id}`}>
              <Link href={`/training/programs/${firstProgramId}`}>К программе</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card font-semibold sm:w-auto" data-testid={`button-wiki-map-open-training-${item.id}`}>
            <Link href="/training">К обучению</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
