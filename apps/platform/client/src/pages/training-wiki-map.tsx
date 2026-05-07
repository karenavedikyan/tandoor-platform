import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import {
  getWikiTrainingAvailableProgramIds,
  getWikiTrainingContentGaps,
  getWikiTrainingContentMap,
  getWikiTrainingContentMapSummary,
  getWikiTrainingMapAudienceRolesCoveredCount,
  getWikiTrainingPublishQueue,
  getWikiTrainingPublishQueueSummary,
  getWikiTrainingReviewChecklistScore,
  getWikiTrainingReviewRiskFlags,
  getWikiTrainingReviewSummary,
  WIKI_MAP_REVIEW_LABEL,
  WIKI_PUBLISH_FORMAT_LABEL,
  WIKI_PUBLISH_READINESS_LABEL,
  WIKI_PUBLISH_WAVE_LABEL,
  WIKI_REVIEW_DECISION_LABEL,
  WIKI_TRAINING_AUDIENCE_LABEL,
  WIKI_TRAINING_PRODUCT_SCOPE_LABEL,
  WIKI_TRAINING_WORK_CONTEXT_LABEL,
  type WikiTrainingAudience,
  type WikiTrainingContentMapItem,
  type WikiTrainingMapReviewStatus,
  type WikiTrainingPriority,
  type WikiTrainingProductScope,
  type WikiTrainingPublishFormat,
  type WikiTrainingPublishQueueItem,
  type WikiTrainingPublishReadiness,
  type WikiTrainingPublishWave,
  type WikiTrainingReviewDecision,
} from "@/lib/training-wiki-content-map";
import { getTrainingProgramById, TRAINING_SECTION_LABEL, type TrainingSectionKey } from "@/lib/training-data";

const ALL = "all" as const;

type SectionFilterValue = typeof ALL | TrainingSectionKey | "other";

function programShortLabel(programId: string): string {
  return getTrainingProgramById(programId)?.title ?? programId;
}

function mergeDecisions(
  base: WikiTrainingContentMapItem[],
  overrides: Record<string, WikiTrainingReviewDecision>,
): WikiTrainingContentMapItem[] {
  return base.map((item) => ({
    ...item,
    reviewMeta: {
      ...item.reviewMeta,
      decision: overrides[item.id] ?? item.reviewMeta.decision,
    },
  }));
}

export default function TrainingWikiMapPage() {
  const baseMap = useMemo(() => getWikiTrainingContentMap(), []);
  const summary = useMemo(() => getWikiTrainingContentMapSummary(), []);
  const gaps = useMemo(() => getWikiTrainingContentGaps(), []);
  const programIds = useMemo(() => getWikiTrainingAvailableProgramIds(), []);
  const audienceRolesCovered = useMemo(() => getWikiTrainingMapAudienceRolesCoveredCount(), []);

  const [decisionOverrides, setDecisionOverrides] = useState<Record<string, WikiTrainingReviewDecision>>({});
  const [waveOverrides, setWaveOverrides] = useState<Record<string, WikiTrainingPublishWave>>({});

  const effectiveMap = useMemo(() => mergeDecisions(baseMap, decisionOverrides), [baseMap, decisionOverrides]);

  const setDecision = useCallback((id: string, decision: WikiTrainingReviewDecision) => {
    setDecisionOverrides((prev) => ({ ...prev, [id]: decision }));
  }, []);

  const setWave = useCallback((sourceItemId: string, wave: WikiTrainingPublishWave) => {
    setWaveOverrides((prev) => ({ ...prev, [sourceItemId]: wave }));
  }, []);

  const basePublishQueue = useMemo(() => getWikiTrainingPublishQueue(effectiveMap), [effectiveMap]);
  const displayPublishQueue = useMemo(
    () =>
      basePublishQueue.map((q) => ({
        ...q,
        wave: waveOverrides[q.sourceItemId] ?? q.wave,
      })),
    [basePublishQueue, waveOverrides],
  );

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

  const filteredOverview = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseMap.filter((item) => {
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
  }, [baseMap, search, priority, audience, section, productScope, reviewStatus, program]);

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

      <Tabs defaultValue="overview" className="min-w-0 space-y-6" data-testid="tabs-wiki-map-mode">
        <TabsList className="flex h-auto min-h-10 w-full min-w-0 flex-wrap justify-start gap-1 p-1 sm:w-auto">
          <TabsTrigger value="overview" className="min-w-0 flex-1 px-3 sm:flex-none" data-testid="tab-wiki-map-overview">
            Карта
          </TabsTrigger>
          <TabsTrigger value="review" className="min-w-0 flex-1 px-3 sm:flex-none" data-testid="tab-wiki-map-review">
            Ревью
          </TabsTrigger>
          <TabsTrigger value="publish" className="min-w-0 flex-1 px-3 sm:flex-none" data-testid="tab-wiki-map-publish">
            Публикация
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="min-w-0 space-y-8 focus-visible:outline-none" data-testid="section-wiki-map-overview-view">
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
                  {filteredOverview.length}
                </span>
              </p>
              <Button type="button" variant="outline" className="min-h-11 w-full font-semibold sm:w-auto" data-testid="button-wiki-map-reset-filters" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
            </div>
          </section>

          <section className="space-y-4" data-testid="section-training-wiki-map-list">
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Элементы карты</h2>
            {filteredOverview.length === 0 ? (
              <Card className="border-dashed border-border/80 bg-muted/20" data-testid="empty-wiki-map-results">
                <CardContent className="flex min-w-0 flex-col gap-3 p-6 text-center sm:text-left">
                  <p className="text-sm text-muted-foreground">По выбранным фильтрам материалов нет.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mx-auto min-h-11 w-full max-w-xs font-semibold sm:mx-0 sm:w-auto"
                    data-testid="button-wiki-map-empty-reset"
                    onClick={resetFilters}
                  >
                    Сбросить фильтры
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
                {filteredOverview.map((item) => (
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
        </TabsContent>

        <TabsContent value="review" className="min-w-0 space-y-8 focus-visible:outline-none" data-testid="section-wiki-map-review-view">
          <WikiReviewPanel items={effectiveMap} onSetDecision={setDecision} />
        </TabsContent>

        <TabsContent value="publish" className="min-w-0 space-y-8 focus-visible:outline-none" data-testid="section-wiki-map-publish-view">
          <p className="max-w-3xl text-sm text-muted-foreground">
            Очередь показывает, какие материалы можно переносить в обучение первой волной, а какие требуют программы, связи с каталогом или переписывания.
          </p>
          <WikiPublishPanel queue={displayPublishQueue} programIds={programIds} onSetWave={setWave} />
        </TabsContent>
      </Tabs>

      <FloatingBackButton href="/training" label="К обучению" testId="floating-back-to-training" ariaLabel="К обучению" />
    </div>
  );
}

type RiskFilter = typeof ALL | "risk_only";

function WikiReviewPanel({
  items,
  onSetDecision,
}: {
  items: WikiTrainingContentMapItem[];
  onSetDecision: (id: string, d: WikiTrainingReviewDecision) => void;
}) {
  const reviewSummary = useMemo(() => getWikiTrainingReviewSummary(items), [items]);

  const [revSearch, setRevSearch] = useState("");
  const [revDecision, setRevDecision] = useState<typeof ALL | WikiTrainingReviewDecision>(ALL);
  const [revPriority, setRevPriority] = useState<typeof ALL | WikiTrainingPriority>(ALL);
  const [revAudience, setRevAudience] = useState<typeof ALL | WikiTrainingAudience>(ALL);
  const [revFormat, setRevFormat] = useState<typeof ALL | WikiTrainingPublishFormat>(ALL);
  const [revRisk, setRevRisk] = useState<RiskFilter>(ALL);

  const resetRevFilters = useCallback(() => {
    setRevSearch("");
    setRevDecision(ALL);
    setRevPriority(ALL);
    setRevAudience(ALL);
    setRevFormat(ALL);
    setRevRisk(ALL);
  }, []);

  const filteredReview = useMemo(() => {
    const q = revSearch.trim().toLowerCase();
    return items.filter((item) => {
      if (q) {
        const blob = `${item.wikiTitle} ${item.safeSummary} ${item.reason} ${item.reviewMeta.reviewerNote}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (revDecision !== ALL && item.reviewMeta.decision !== revDecision) return false;
      if (revPriority !== ALL && item.priority !== revPriority) return false;
      if (revAudience !== ALL && !item.audiences.includes(revAudience)) return false;
      if (revFormat !== ALL && item.reviewMeta.recommendedFormat !== revFormat) return false;
      if (revRisk === "risk_only" && getWikiTrainingReviewRiskFlags(item).length === 0) return false;
      return true;
    });
  }, [items, revSearch, revDecision, revPriority, revAudience, revFormat, revRisk]);

  return (
    <>
      <section className="space-y-4" data-testid="section-wiki-review-kpis">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Ревью публикации</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-review-pending">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">На проверке</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{reviewSummary.pending}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-review-ready">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Готово к публикации</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{reviewSummary.ready_to_publish}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-review-rewrite">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Переписать</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{reviewSummary.rewrite}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-review-archive">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">В архив</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{reviewSummary.archive}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-review-without-program">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Без программы</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{reviewSummary.withoutProgram}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-review-checklist-score">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Средний чек-лист</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{reviewSummary.avgChecklistPercent}%</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6" data-testid="section-wiki-review-filters">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Фильтры ревью</h2>
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="input-wiki-review-search">
              Поиск
            </label>
            <Input
              id="input-wiki-review-search"
              value={revSearch}
              onChange={(e) => setRevSearch(e.target.value)}
              placeholder="Заголовок, описание, причина…"
              className="h-11 min-h-[44px] w-full min-w-0"
              data-testid="input-wiki-review-search"
            />
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Решение</span>
            <Select value={revDecision} onValueChange={(v) => setRevDecision(v as typeof ALL | WikiTrainingReviewDecision)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-review-decision">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все</SelectItem>
                <SelectItem value="pending">{WIKI_REVIEW_DECISION_LABEL.pending}</SelectItem>
                <SelectItem value="ready_to_publish">{WIKI_REVIEW_DECISION_LABEL.ready_to_publish}</SelectItem>
                <SelectItem value="rewrite">{WIKI_REVIEW_DECISION_LABEL.rewrite}</SelectItem>
                <SelectItem value="archive">{WIKI_REVIEW_DECISION_LABEL.archive}</SelectItem>
                <SelectItem value="do_not_import">{WIKI_REVIEW_DECISION_LABEL.do_not_import}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Приоритет</span>
            <Select value={revPriority} onValueChange={(v) => setRevPriority(v as typeof ALL | WikiTrainingPriority)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-review-priority">
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
            <Select value={revAudience} onValueChange={(v) => setRevAudience(v as typeof ALL | WikiTrainingAudience)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-review-audience">
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
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Формат публикации</span>
            <Select value={revFormat} onValueChange={(v) => setRevFormat(v as typeof ALL | WikiTrainingPublishFormat)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-review-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все</SelectItem>
                {(Object.keys(WIKI_PUBLISH_FORMAT_LABEL) as WikiTrainingPublishFormat[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {WIKI_PUBLISH_FORMAT_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Риски</span>
            <Select value={revRisk} onValueChange={(v) => setRevRisk(v as RiskFilter)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-review-risk">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все</SelectItem>
                <SelectItem value="risk_only">Только с рисками</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Найдено:{" "}
            <span className="font-semibold tabular-nums text-foreground" data-testid="text-wiki-review-results-count">
              {filteredReview.length}
            </span>
          </p>
          <Button type="button" variant="outline" className="min-h-11 w-full font-semibold sm:w-auto" data-testid="button-wiki-review-reset-filters" onClick={resetRevFilters}>
            Сбросить фильтры
          </Button>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-wiki-review-list">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Материалы</h2>
        {filteredReview.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-muted/20" data-testid="empty-wiki-review-results">
            <CardContent className="flex min-w-0 flex-col gap-3 p-6 text-center sm:text-left">
              <p className="text-sm text-muted-foreground">По выбранным фильтрам материалов нет.</p>
              <Button
                type="button"
                variant="secondary"
                className="mx-auto min-h-11 w-full max-w-xs font-semibold sm:mx-0 sm:w-auto"
                data-testid="button-wiki-review-empty-reset"
                onClick={resetRevFilters}
              >
                Сбросить фильтры
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3">
            {filteredReview.map((item) => (
              <WikiReviewItemCard key={item.id} item={item} onSetDecision={onSetDecision} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function WikiPublishPanel({
  queue,
  programIds,
  onSetWave,
}: {
  queue: WikiTrainingPublishQueueItem[];
  programIds: string[];
  onSetWave: (sourceItemId: string, wave: WikiTrainingPublishWave) => void;
}) {
  const publishSummary = useMemo(() => getWikiTrainingPublishQueueSummary(queue), [queue]);

  const [pubSearch, setPubSearch] = useState("");
  const [pubWave, setPubWave] = useState<typeof ALL | WikiTrainingPublishWave>(ALL);
  const [pubReadiness, setPubReadiness] = useState<typeof ALL | WikiTrainingPublishReadiness>(ALL);
  const [pubFormat, setPubFormat] = useState<typeof ALL | WikiTrainingPublishFormat>(ALL);
  const [pubProgram, setPubProgram] = useState<typeof ALL | string>(ALL);
  const [pubAudience, setPubAudience] = useState<typeof ALL | WikiTrainingAudience>(ALL);

  const resetPubFilters = useCallback(() => {
    setPubSearch("");
    setPubWave(ALL);
    setPubReadiness(ALL);
    setPubFormat(ALL);
    setPubProgram(ALL);
    setPubAudience(ALL);
  }, []);

  const filteredPublish = useMemo(() => {
    const q = pubSearch.trim().toLowerCase();
    return queue.filter((row) => {
      if (q) {
        const blob = `${row.wikiTitle} ${row.reason} ${row.nextAction} ${row.blockers.join(" ")}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (pubWave !== ALL && row.wave !== pubWave) return false;
      if (pubReadiness !== ALL && row.readiness !== pubReadiness) return false;
      if (pubFormat !== ALL && row.recommendedFormat !== pubFormat) return false;
      if (pubAudience !== ALL && !row.audiences.includes(pubAudience)) return false;
      if (pubProgram !== ALL && !row.targetProgramIds.includes(pubProgram)) return false;
      return true;
    });
  }, [queue, pubSearch, pubWave, pubReadiness, pubFormat, pubProgram, pubAudience]);

  return (
    <>
      <section className="space-y-4" data-testid="section-wiki-publish-kpis">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Очередь публикации</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-publish-wave-1">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Первая волна</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{publishSummary.wave_1}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-publish-wave-2">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Вторая волна</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{publishSummary.wave_2}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-publish-needs-program">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Требует программы</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{publishSummary.needs_program}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-publish-needs-catalog">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Требует связи с каталогом</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{publishSummary.needs_catalog_link}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-publish-needs-rewrite">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Переписать</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{publishSummary.needs_rewrite}</p>
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/70 shadow-xs" data-testid="card-wiki-publish-blocked">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Заблокировано</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <p className="text-3xl font-semibold tabular-nums text-foreground">{publishSummary.blockedReadiness}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6" data-testid="section-wiki-publish-filters">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Фильтры очереди</h2>
        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="input-wiki-publish-search">
              Поиск
            </label>
            <Input
              id="input-wiki-publish-search"
              value={pubSearch}
              onChange={(e) => setPubSearch(e.target.value)}
              placeholder="Заголовок, причина, действие…"
              className="h-11 min-h-[44px] w-full min-w-0"
              data-testid="input-wiki-publish-search"
            />
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Волна</span>
            <Select value={pubWave} onValueChange={(v) => setPubWave(v as typeof ALL | WikiTrainingPublishWave)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-publish-wave">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все</SelectItem>
                <SelectItem value="wave_1">{WIKI_PUBLISH_WAVE_LABEL.wave_1}</SelectItem>
                <SelectItem value="wave_2">{WIKI_PUBLISH_WAVE_LABEL.wave_2}</SelectItem>
                <SelectItem value="later">{WIKI_PUBLISH_WAVE_LABEL.later}</SelectItem>
                <SelectItem value="blocked">{WIKI_PUBLISH_WAVE_LABEL.blocked}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Готовность</span>
            <Select value={pubReadiness} onValueChange={(v) => setPubReadiness(v as typeof ALL | WikiTrainingPublishReadiness)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-publish-readiness">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все</SelectItem>
                <SelectItem value="ready">{WIKI_PUBLISH_READINESS_LABEL.ready}</SelectItem>
                <SelectItem value="needs_program">{WIKI_PUBLISH_READINESS_LABEL.needs_program}</SelectItem>
                <SelectItem value="needs_catalog_link">{WIKI_PUBLISH_READINESS_LABEL.needs_catalog_link}</SelectItem>
                <SelectItem value="needs_rewrite">{WIKI_PUBLISH_READINESS_LABEL.needs_rewrite}</SelectItem>
                <SelectItem value="blocked">{WIKI_PUBLISH_READINESS_LABEL.blocked}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Формат</span>
            <Select value={pubFormat} onValueChange={(v) => setPubFormat(v as typeof ALL | WikiTrainingPublishFormat)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-publish-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Все</SelectItem>
                {(Object.keys(WIKI_PUBLISH_FORMAT_LABEL) as WikiTrainingPublishFormat[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {WIKI_PUBLISH_FORMAT_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Программа</span>
            <Select value={pubProgram} onValueChange={(v) => setPubProgram(v as typeof ALL | string)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-publish-program">
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
          <div className="min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Роль</span>
            <Select value={pubAudience} onValueChange={(v) => setPubAudience(v as typeof ALL | WikiTrainingAudience)}>
              <SelectTrigger className="h-11 min-h-[44px] w-full min-w-0" data-testid="select-wiki-publish-audience">
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
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Найдено:{" "}
            <span className="font-semibold tabular-nums text-foreground" data-testid="text-wiki-publish-results-count">
              {filteredPublish.length}
            </span>
          </p>
          <Button type="button" variant="outline" className="min-h-11 w-full font-semibold sm:w-auto" data-testid="button-wiki-publish-reset-filters" onClick={resetPubFilters}>
            Сбросить фильтры
          </Button>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-wiki-publish-list">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Материалы в очереди</h2>
        {filteredPublish.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-muted/20" data-testid="empty-wiki-publish-results">
            <CardContent className="flex min-w-0 flex-col gap-3 p-6 text-center sm:text-left">
              <p className="text-sm text-muted-foreground">По выбранным фильтрам материалов нет.</p>
              <Button
                type="button"
                variant="secondary"
                className="mx-auto min-h-11 w-full max-w-xs font-semibold sm:mx-0 sm:w-auto"
                data-testid="button-wiki-publish-empty-reset"
                onClick={resetPubFilters}
              >
                Сбросить фильтры
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3">
            {filteredPublish.map((row) => (
              <WikiPublishItemCard key={row.id} row={row} onSetWave={onSetWave} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function WikiPublishItemCard({
  row,
  onSetWave,
}: {
  row: WikiTrainingPublishQueueItem;
  onSetWave: (sourceItemId: string, wave: WikiTrainingPublishWave) => void;
}) {
  const firstProgramId = row.targetProgramIds[0];
  return (
    <Card className="min-w-0 overflow-hidden border-border/70 shadow-xs" data-testid={`card-wiki-publish-item-${row.id}`}>
      <CardHeader className="min-w-0 space-y-2 pb-2 pt-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <CardTitle className="min-w-0 text-base leading-snug">{row.wikiTitle}</CardTitle>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Badge variant="secondary" className="font-semibold tabular-nums">
              {row.priority}
            </Badge>
            <Badge variant="outline" className="text-xs font-medium">
              {WIKI_PUBLISH_WAVE_LABEL[row.wave]}
            </Badge>
            <Badge variant="outline" className="text-xs font-medium">
              {WIKI_PUBLISH_READINESS_LABEL[row.readiness]}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Решение ревью: <span className="font-medium text-foreground">{WIKI_REVIEW_DECISION_LABEL[row.decision]}</span> · Формат:{" "}
          <span className="font-medium text-foreground">{WIKI_PUBLISH_FORMAT_LABEL[row.recommendedFormat]}</span> · Чек-лист:{" "}
          <span className="tabular-nums font-medium text-foreground">{row.checklistPercent}%</span>
        </p>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3 pb-4 pt-0">
        {row.blockers.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {row.blockers.map((b) => (
              <Badge key={b} variant="secondary" className="max-w-full whitespace-normal text-left text-[11px] font-normal">
                {b}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">{row.reason}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Следующий шаг:</span> {row.nextAction}
        </p>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Программы</p>
          <p className="mt-1 break-words text-xs text-foreground">
            {row.targetProgramIds.length > 0 ? row.targetProgramIds.map(programShortLabel).join(" · ") : "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {row.audiences.map((a) => (
            <Badge key={a} variant="outline" className="text-[11px] font-normal">
              {WIKI_TRAINING_AUDIENCE_LABEL[a]}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Категория: <span className="font-medium text-foreground">{WIKI_TRAINING_PRODUCT_SCOPE_LABEL[row.productScope]}</span>
        </p>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Сценарии</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {row.workContexts.map((w) => (
              <Badge key={w} variant="secondary" className="rounded-md text-[11px] font-normal">
                {WIKI_TRAINING_WORK_CONTEXT_LABEL[w]}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="default"
            className="min-h-11 w-full font-semibold sm:w-auto"
            data-testid={`button-wiki-publish-mark-wave-1-${row.id}`}
            onClick={() => onSetWave(row.sourceItemId, "wave_1")}
          >
            В первую волну
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full font-semibold sm:w-auto"
            data-testid={`button-wiki-publish-mark-wave-2-${row.id}`}
            onClick={() => onSetWave(row.sourceItemId, "wave_2")}
          >
            Во вторую волну
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full border-border font-semibold sm:w-auto"
            data-testid={`button-wiki-publish-mark-later-${row.id}`}
            onClick={() => onSetWave(row.sourceItemId, "later")}
          >
            Отложить
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full font-semibold sm:w-auto"
            data-testid={`button-wiki-publish-mark-blocked-${row.id}`}
            onClick={() => onSetWave(row.sourceItemId, "blocked")}
          >
            Заблокировать
          </Button>
        </div>
        <div className="flex min-w-0 flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:flex-wrap">
          {firstProgramId ? (
            <Button asChild variant="secondary" size="sm" className="min-h-10 w-full font-semibold sm:w-auto" data-testid={`button-wiki-publish-open-program-${row.id}`}>
              <Link href={`/training/programs/${firstProgramId}`}>К программе</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm" className="min-h-10 w-full border-border bg-card font-semibold sm:w-auto" data-testid={`button-wiki-publish-open-training-${row.id}`}>
            <Link href="/training">К обучению</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistRow({ ok, label, testId }: { ok: boolean; label: string; testId: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2 text-xs" data-testid={testId}>
      {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

function WikiReviewItemCard({
  item,
  onSetDecision,
}: {
  item: WikiTrainingContentMapItem;
  onSetDecision: (id: string, d: WikiTrainingReviewDecision) => void;
}) {
  const firstProgramId = item.targetProgramIds[0];
  const score = getWikiTrainingReviewChecklistScore(item);
  const risks = getWikiTrainingReviewRiskFlags(item);
  const c = item.reviewMeta.checklist;

  return (
    <Card className="min-w-0 overflow-hidden border-border/70 shadow-xs" data-testid={`card-wiki-review-item-${item.id}`}>
      <CardHeader className="min-w-0 space-y-2 pb-2 pt-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <CardTitle className="min-w-0 text-base leading-snug">{item.wikiTitle}</CardTitle>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Badge variant="secondary" className="font-semibold tabular-nums">
              {item.priority}
            </Badge>
            <Badge variant="outline" className="text-xs font-medium">
              {WIKI_REVIEW_DECISION_LABEL[item.reviewMeta.decision]}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Исходный статус карты: <span className="font-medium text-foreground">{WIKI_MAP_REVIEW_LABEL[item.reviewStatus]}</span> · Формат:{" "}
          <span className="font-medium text-foreground">{WIKI_PUBLISH_FORMAT_LABEL[item.reviewMeta.recommendedFormat]}</span> · Чек-лист:{" "}
          <span className="tabular-nums font-medium text-foreground">
            {score.score}/{score.total} ({score.percent}%)
          </span>
        </p>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 pb-4 pt-0">
        {risks.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {risks.map((r) => (
              <Badge key={r} variant="destructive" className="max-w-full whitespace-normal text-left text-[11px] font-normal">
                {r}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground">{item.safeSummary}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Зачем:</span> {item.reason}
        </p>
        <div className="min-w-0 rounded-lg border border-border/60 bg-muted/15 p-3">
          <p className="text-xs font-semibold text-foreground">Чек-лист качества</p>
          <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
            <ChecklistRow ok={c.noClosedData} label="Нет закрытых данных" testId={`check-wiki-review-no-closed-data-${item.id}`} />
            <ChecklistRow ok={c.noInternalLinks} label="Нет внутренних ссылок" testId={`check-wiki-review-no-internal-links-${item.id}`} />
            <ChecklistRow ok={c.actualForCurrentCatalog} label="Актуально для каталога" testId={`check-wiki-review-actual-catalog-${item.id}`} />
            <ChecklistRow ok={c.usefulForManager} label="Полезно менеджеру" testId={`check-wiki-review-useful-manager-${item.id}`} />
            <ChecklistRow ok={c.linkedToProgram} label="Привязано к программе" testId={`check-wiki-review-linked-program-${item.id}`} />
            <ChecklistRow
              ok={c.linkedToProductOrScenario}
              label="Привязано к товару или сценарию"
              testId={`check-wiki-review-linked-product-scenario-${item.id}`}
            />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Программы</p>
          <p className="mt-1 break-words text-xs text-foreground">
            {item.targetProgramIds.length > 0 ? item.targetProgramIds.map(programShortLabel).join(" · ") : "—"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Категория: <span className="font-medium text-foreground">{WIKI_TRAINING_PRODUCT_SCOPE_LABEL[item.productScope]}</span>
          </p>
        </div>
        {item.migrationNotes.length > 0 ? (
          <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
            {item.migrationNotes.map((note, i) => (
              <li key={`${item.id}-rm-${i}`}>{note}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="default"
            className="min-h-11 w-full font-semibold sm:w-auto"
            data-testid={`button-wiki-review-mark-ready-${item.id}`}
            onClick={() => onSetDecision(item.id, "ready_to_publish")}
          >
            Готово
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 w-full font-semibold sm:w-auto"
            data-testid={`button-wiki-review-mark-rewrite-${item.id}`}
            onClick={() => onSetDecision(item.id, "rewrite")}
          >
            Переписать
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full border-border font-semibold sm:w-auto"
            data-testid={`button-wiki-review-mark-archive-${item.id}`}
            onClick={() => onSetDecision(item.id, "archive")}
          >
            В архив
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full font-semibold sm:w-auto"
            data-testid={`button-wiki-review-mark-do-not-import-${item.id}`}
            onClick={() => onSetDecision(item.id, "do_not_import")}
          >
            Не переносить
          </Button>
        </div>
        <div className="flex min-w-0 flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:flex-wrap">
          {firstProgramId ? (
            <Button asChild variant="secondary" size="sm" className="min-h-10 w-full font-semibold sm:w-auto" data-testid={`button-wiki-review-open-program-${item.id}`}>
              <Link href={`/training/programs/${firstProgramId}`}>К программе</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm" className="min-h-10 w-full border-border bg-card font-semibold sm:w-auto" data-testid={`button-wiki-review-open-training-${item.id}`}>
            <Link href="/training">К обучению</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
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
