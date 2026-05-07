import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { cn } from "@/lib/utils";
import {
  getTrainingMaterialById,
  getTrainingMaterialsByProgram,
  getTrainingModulesByProgram,
  getTrainingProgramById,
  TRAINING_PROGRAM_LEVEL_LABEL,
  TRAINING_ROLE_LABEL,
  TRAINING_SECTION_LABEL,
  TRAINING_TYPE_LABEL,
  type TrainingMaterial,
  type TrainingProgram,
  type TrainingProgramStatus,
} from "@/lib/training-data";

function isWikiSourceMaterial(m: Pick<TrainingMaterial, "sourceType" | "wikiSource">): boolean {
  return m.sourceType === "wiki" || Boolean(m.wikiSource);
}

function programStatusLabel(s: TrainingProgramStatus): string {
  if (s === "not_started") return "Не начато";
  if (s === "in_progress") return "В работе";
  if (s === "completed") return "Завершено";
  return "Требует внимания";
}

function coverClass(tone: TrainingProgram["coverTone"]): string {
  switch (tone) {
    case "lime":
      return "border-l-primary bg-primary/5";
    case "sky":
      return "border-l-sky-500 bg-sky-500/5";
    case "amber":
      return "border-l-amber-500 bg-amber-500/5";
    case "slate":
      return "border-l-slate-500 bg-slate-500/5";
    case "violet":
      return "border-l-violet-500 bg-violet-500/5";
    default:
      return "border-l-primary bg-muted/20";
  }
}

function TrainingProgramNotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-6 py-6" data-testid="page-training-program-not-found">
      <Card className="rounded-2xl border border-border bg-card shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Программа не найдена</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Проверьте ссылку или вернитесь к учебному центру.</p>
          <Button asChild className="w-full min-h-11 font-semibold" data-testid="button-back-to-training">
            <Link href="/training">К обучению</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TrainingProgramPage() {
  const { programId } = useParams<{ programId: string }>();
  const raw = programId ?? "";
  const program = useMemo(() => getTrainingProgramById(raw), [raw]);
  const modules = useMemo(() => (program ? getTrainingModulesByProgram(program.id) : []), [program]);
  const materials = useMemo(() => (program ? getTrainingMaterialsByProgram(program.id) : []), [program]);
  const wikiMaterialsCount = useMemo(() => materials.filter((m) => isWikiSourceMaterial(m)).length, [materials]);

  const moduleMaterialIdSet = useMemo(() => {
    const s = new Set<string>();
    for (const mod of modules) {
      for (const id of mod.materialIds) {
        s.add(id);
      }
    }
    return s;
  }, [modules]);

  const materialsOutsideModules = useMemo(
    () => materials.filter((m) => !moduleMaterialIdSet.has(m.id)),
    [materials, moduleMaterialIdSet],
  );

  const extraMaterialsTitle = useMemo(() => {
    if (materialsOutsideModules.length === 0) return "";
    return materialsOutsideModules.every(isWikiSourceMaterial) ? "Материалы из Wiki" : "Дополнительные материалы программы";
  }, [materialsOutsideModules]);

  if (!raw || !program) {
    return <TrainingProgramNotFound />;
  }

  const firstMaterialId = program.materialIds[0] ?? materials[0]?.id;

  return (
    <div className="space-y-8 pb-28 sm:space-y-10" data-testid="page-training-program">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card sm:w-auto" data-testid="button-back-to-training">
          <Link href="/training">К обучению</Link>
        </Button>
      </div>

      <section
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8",
          "border-l-4",
          coverClass(program.coverTone),
        )}
        data-testid="section-training-program-hero"
      >
        <div className="relative space-y-4 pl-1 sm:pl-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{TRAINING_SECTION_LABEL[program.section]}</Badge>
            <Badge variant="outline">{TRAINING_ROLE_LABEL[program.role]}</Badge>
            <Badge variant="outline">{TRAINING_PROGRAM_LEVEL_LABEL[program.level]}</Badge>
            <Badge variant="outline">{programStatusLabel(program.status)}</Badge>
            {program.required ? (
              <Badge variant="secondary" className="font-semibold">
                Обязательная программа
              </Badge>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{program.title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{program.description}</p>
          <p className="text-sm text-muted-foreground">
            Ориентировочное время: <span className="font-semibold text-foreground">{program.durationMinutes} мин</span> ·
            материалов: <span className="font-semibold text-foreground">{program.totalMaterials}</span>
            {wikiMaterialsCount > 0 ? (
              <>
                {" "}
                · из Wiki:{" "}
                <span className="font-semibold tabular-nums text-foreground" data-testid="text-training-program-wiki-count">
                  {wikiMaterialsCount}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </section>

      <section className="space-y-3" data-testid="section-training-program-progress">
        <h2 className="text-base font-semibold text-foreground sm:text-lg">Прогресс</h2>
        <Card className="border-border/80 shadow-md">
          <CardContent className="space-y-2 p-4 sm:p-5">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Выполнено материалов</span>
              <span className="font-semibold tabular-nums text-foreground">
                {program.completedMaterials} / {program.totalMaterials}
              </span>
            </div>
            <Progress value={program.progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground">Оценка по учебному сценарию без записи во внешние системы.</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" data-testid="section-training-program-modules">
        <h2 className="text-base font-semibold text-foreground sm:text-lg">Модули и материалы</h2>
        <div className="space-y-6">
          {modules.map((mod) => (
            <Card key={mod.id} className="border-border/80 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{mod.title}</CardTitle>
                <p className="text-xs text-muted-foreground">Модуль {mod.order}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {mod.materialIds.map((mid) => {
                  const mat = getTrainingMaterialById(mid);
                  if (!mat) return null;
                  return (
                    <div
                      key={mid}
                      data-testid={`card-training-program-material-${mat.id}`}
                      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="min-w-0 font-medium text-foreground">{mat.title}</p>
                          {isWikiSourceMaterial(mat) ? (
                            <Badge
                              variant="secondary"
                              className="shrink-0 border-primary/30 bg-primary/5 text-foreground"
                              data-testid={`badge-training-program-material-source-${mat.id}`}
                            >
                              Wiki
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {TRAINING_TYPE_LABEL[mat.type]} · {mat.durationMinutes} мин · прогресс {mat.progressPercent}%
                        </p>
                      </div>
                      <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        className="w-full shrink-0 font-semibold sm:w-auto"
                        data-testid={`button-open-program-material-${mid}`}
                      >
                        <Link href={`/training/${mid}`}>Открыть материал</Link>
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
          {materialsOutsideModules.length > 0 ? (
            <Card className="border-border/80 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{extraMaterialsTitle}</CardTitle>
                <p className="text-xs text-muted-foreground">Подключены к программе; полный текст — после ревью во внутреннем контуре.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {materialsOutsideModules.map((mat) => (
                  <div
                    key={mat.id}
                    data-testid={`card-training-program-material-${mat.id}`}
                    className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="min-w-0 font-medium text-foreground">{mat.title}</p>
                        {isWikiSourceMaterial(mat) ? (
                          <Badge
                            variant="secondary"
                            className="shrink-0 border-primary/30 bg-primary/5 text-foreground"
                            data-testid={`badge-training-program-material-source-${mat.id}`}
                          >
                            Wiki
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {TRAINING_TYPE_LABEL[mat.type]} · {mat.durationMinutes} мин · прогресс {mat.progressPercent}%
                      </p>
                    </div>
                    <Button
                      asChild
                      variant="secondary"
                      size="sm"
                      className="w-full shrink-0 font-semibold sm:w-auto"
                      data-testid={`button-open-program-material-${mat.id}`}
                    >
                      <Link href={`/training/${mat.id}`}>Открыть материал</Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
          {modules.length === 0 && materials.length > 0 ? (
            <div className="grid gap-3">
              {materials.map((mat) => (
                <Card key={mat.id} className="border-border/80 shadow-md" data-testid={`card-training-program-material-${mat.id}`}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="min-w-0 font-medium text-foreground">{mat.title}</p>
                        {isWikiSourceMaterial(mat) ? (
                          <Badge
                            variant="secondary"
                            className="shrink-0 border-primary/30 bg-primary/5 text-foreground"
                            data-testid={`badge-training-program-material-source-${mat.id}`}
                          >
                            Wiki
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{TRAINING_TYPE_LABEL[mat.type]}</p>
                    </div>
                    <Button asChild variant="secondary" className="font-semibold" data-testid={`button-open-program-material-${mat.id}`}>
                      <Link href={`/training/${mat.id}`}>Открыть материал</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3" data-testid="section-training-program-outcomes">
        <h2 className="text-base font-semibold text-foreground sm:text-lg">Что даст программа</h2>
        <Card className="border-border/80 shadow-md">
          <CardContent className="p-4 sm:p-5">
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
              <li>Единый язык с клиентом по продукту и сервису.</li>
              <li>Готовые формулировки и чек-листы для визитов и звонков.</li>
              <li>Связка с каталогом и задачами в рабочем контуре платформы.</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" data-testid="section-training-program-related">
        <h2 className="text-base font-semibold text-foreground sm:text-lg">Связанные разделы</h2>
        <div className="flex flex-wrap gap-2">
          {program.relatedProductCategory && program.relatedProductCategory !== "all" ? (
            <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold">
              <Link href="/catalog">Каталог ({program.relatedProductCategory.toUpperCase()})</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold">
              <Link href="/catalog">Каталог</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold">
            <Link href="/tasks">Задачи</Link>
          </Button>
          {program.section === "sales" || program.materialIds.some((id) => id.startsWith("tr-sales")) ? (
            <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold">
              <Link href="/analytics">Аналитика</Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-3" data-testid="section-training-program-next-actions">
        <h2 className="text-base font-semibold text-foreground sm:text-lg">Следующие действия</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {firstMaterialId ? (
            <Button asChild className="min-h-11 font-semibold">
              <Link href={`/training/${firstMaterialId}`}>Продолжить обучение</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="min-h-11 border-border bg-card font-semibold">
            <Link href="/catalog">Открыть каталог</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 border-border bg-card font-semibold">
            <Link href="/tasks">Открыть задачи</Link>
          </Button>
        </div>
      </section>

      <FloatingBackButton href="/training" label="К обучению" testId="floating-back-to-training" ariaLabel="К обучению" />
    </div>
  );
}
