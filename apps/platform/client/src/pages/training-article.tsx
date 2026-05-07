import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { cn } from "@/lib/utils";
import {
  getTrainingMaterialById,
  getTrainingProgramsForMaterial,
  RELATED_TASK_CONTEXT_LABEL,
  TRAINING_AUDIENCE_LABEL,
  TRAINING_PROGRESS_STATUS_LABEL,
  TRAINING_PROGRAM_LEVEL_LABEL,
  TRAINING_ROLE_LABEL,
  TRAINING_SECTION_LABEL,
  TRAINING_STATUS_LABEL,
  TRAINING_TYPE_LABEL,
  type RelatedTaskContext,
} from "@/lib/training-data";
import { getProductById } from "@/lib/catalog-data";

function statusBadgeClass(status: "required" | "recommended" | "new" | "updated") {
  if (status === "required") return "border-primary/50 bg-primary/15 text-foreground";
  if (status === "new") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "updated") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted/60 text-foreground";
}

function contextHref(ctx: RelatedTaskContext): string {
  if (ctx === "showcase" || ctx === "hardware" || ctx === "dealer_card") return "/tasks";
  if (ctx === "orders") return "/orders";
  if (ctx === "territory") return "/territory-card";
  if (ctx === "analytics") return "/analytics";
  return "/dealer-base";
}

function TrainingArticleNotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-6 py-6" data-testid="page-training-article-not-found">
      <Card className="rounded-2xl border border-border bg-card shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Материал не найден</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Проверьте ссылку или вернитесь к списку обучения.</p>
          <Button asChild className="w-full min-h-11 font-semibold" data-testid="button-back-to-training">
            <Link href="/training">К обучению</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function TrainingArticleFound({ articleId }: { articleId: string }) {
  const material = getTrainingMaterialById(articleId);
  const [markedDone, setMarkedDone] = useState(false);
  const [inPlan, setInPlan] = useState(false);

  const programs = useMemo(() => (material ? getTrainingProgramsForMaterial(material.id) : []), [material]);

  if (!material) return <TrainingArticleNotFound />;

  return (
    <div className="space-y-6 pb-28 sm:space-y-8" data-testid="page-training-article">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card sm:w-auto" data-testid="button-back-to-training">
          <Link href="/training">К обучению</Link>
        </Button>
      </div>

      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8"
        data-testid="section-training-article-hero"
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative space-y-4 pl-3 sm:pl-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="font-medium">
              {TRAINING_SECTION_LABEL[material.section]}
            </Badge>
            <Badge variant="outline" className="font-medium">
              {TRAINING_TYPE_LABEL[material.type]}
            </Badge>
            <Badge variant="outline" className={cn("font-medium", statusBadgeClass(material.status))}>
              {TRAINING_STATUS_LABEL[material.status]}
            </Badge>
            <Badge variant="outline" className="font-medium">
              {TRAINING_PROGRESS_STATUS_LABEL[material.progressStatus]}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              Сложность: {material.difficulty === "easy" ? "лёгкая" : material.difficulty === "hard" ? "высокая" : "средняя"}
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{material.title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{material.description}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span>
              Аудитория:{" "}
              <span className="font-medium text-foreground">{material.audience.map((a) => TRAINING_AUDIENCE_LABEL[a]).join(", ")}</span>
            </span>
            <span>
              Обновлено: <span className="font-medium text-foreground">{material.updatedAt}</span>
            </span>
            <span>
              Время: <span className="font-medium text-foreground">{material.durationMinutes} мин</span>
            </span>
          </div>
          <div className="max-w-md space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Прогресс материала</span>
              <span className="font-semibold text-foreground">{material.progressPercent}%</span>
            </div>
            <Progress value={material.progressPercent} className="h-2" />
          </div>
          {material.knowledgeTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {material.knowledgeTags.map((t) => (
                <Badge key={t} variant="secondary" className="rounded-md font-normal">
                  {t}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3" data-testid="section-training-article-summary">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Кратко</h2>
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
              {material.summaryBullets.map((line, i) => (
                <li key={`${material.id}-sum-${i}`}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" data-testid="section-training-article-checklist">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Чек-лист применения</h2>
        <Card className="border-border/70 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              {material.checklist.map((line, i) => (
                <li key={`${material.id}-cl-${i}`}>{line}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" data-testid="section-training-article-content">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Содержание</h2>
        <div className="space-y-4">
          {material.contentBlocks.map((b, idx) => (
            <Card key={`${material.id}-cb-${idx}`} className="border-border/70 shadow-xs">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-base">{b.heading}</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 pt-0">
                <p className="text-sm leading-relaxed text-muted-foreground">{b.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {material.relatedProductIds.length > 0 ? (
        <section className="space-y-4" data-testid="section-training-article-related-products">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Связанные товары</h2>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {material.relatedProductIds.map((pid) => {
              const p = getProductById(pid);
              const title = p?.name ?? `Товар ${pid}`;
              return (
                <Card key={pid} className="min-w-0 border-border/70 shadow-xs">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{title}</p>
                      {p ? <p className="mt-1 font-mono text-xs text-muted-foreground">{p.article}</p> : null}
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full shrink-0 font-semibold sm:w-auto"
                      data-testid={`button-open-related-product-${pid}`}
                    >
                      <Link href={`/catalog/${pid}`}>
                        Открыть в каталоге
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      {programs.length > 0 ? (
        <section className="space-y-4" data-testid="section-training-article-related-programs">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Связанные программы</h2>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {programs.map((prog) => (
              <Card key={prog.id} className="min-w-0 border-border/70 shadow-xs">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">{prog.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {TRAINING_ROLE_LABEL[prog.role]} · {TRAINING_PROGRAM_LEVEL_LABEL[prog.level]}
                    </p>
                  </div>
                  <Button
                    asChild
                    variant="secondary"
                    size="sm"
                    className="w-full shrink-0 font-semibold sm:w-auto"
                    data-testid={`button-open-related-program-${prog.id}`}
                  >
                    <Link href={`/training/programs/${prog.id}`}>Открыть программу</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4" data-testid="section-training-article-related-context">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Связанные рабочие сценарии</h2>
        <Card className="border-border/70 shadow-xs">
          <CardContent className="flex flex-wrap gap-2 p-4 sm:p-5">
            {Array.from(new Set(material.relatedTaskContext)).map((ctx) => (
              <Button key={ctx} asChild variant="outline" size="sm" className="min-h-10 border-border bg-card font-semibold">
                <Link href={contextHref(ctx)}>{RELATED_TASK_CONTEXT_LABEL[ctx]}</Link>
              </Button>
            ))}
            <Button asChild variant="outline" size="sm" className="min-h-10 border-border bg-card font-semibold">
              <Link href="/tasks">Задачи</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="min-h-10 border-border bg-card font-semibold">
              <Link href="/dealer-base">Карточка клиента</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="min-h-10 border-border bg-card font-semibold">
              <Link href="/catalog">Каталог</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="min-h-10 border-border bg-card font-semibold">
              <Link href="/analytics">Аналитика</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {material.relatedTaskIds.length > 0 ? (
        <section className="space-y-4" data-testid="section-training-article-related-tasks">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Связанные задачи</h2>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {material.relatedTaskIds.map((tid) => (
              <Card key={tid} className="min-w-0 border-border/70 shadow-xs">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 font-mono text-sm font-medium text-foreground">Задача {tid}</p>
                  <Button asChild variant="outline" size="sm" className="w-full shrink-0 font-semibold sm:w-auto" data-testid={`button-open-related-task-${tid}`}>
                    <Link href="/tasks">
                      К задачам
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4" data-testid="section-training-article-next-actions">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Действия</h2>
        <Card className="border-border/70 shadow-xs">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant={markedDone ? "secondary" : "default"}
              className="min-h-11 w-full font-semibold sm:flex-1"
              data-testid="button-training-mark-complete"
              onClick={() => setMarkedDone((v) => !v)}
            >
              {markedDone ? "Отмечено как пройденное" : "Отметить пройденным"}
            </Button>
            <Button
              type="button"
              variant={inPlan ? "secondary" : "outline"}
              className="min-h-11 w-full border-border font-semibold sm:flex-1"
              data-testid="button-training-add-to-plan"
              onClick={() => setInPlan((v) => !v)}
            >
              {inPlan ? "В плане" : "Добавить в план"}
            </Button>
          </CardContent>
        </Card>
        <Separator className="opacity-60" />
      </section>

      <FloatingBackButton href="/training" label="К обучению" testId="floating-back-to-training" ariaLabel="К обучению" />
    </div>
  );
}

export default function TrainingArticlePage() {
  const params = useParams<{ articleId: string }>();
  const raw = params.articleId ?? "";
  if (!raw) return <TrainingArticleNotFound />;
  return <TrainingArticleFound articleId={raw} />;
}
