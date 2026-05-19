import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import { ExternalLink, ListChecks, Map, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import { buildHashPath } from "@/lib/hash-route-utils";
import {
  buildBitrix24OpenTandoorUrl,
  createBitrix24TaskDraft,
  getBitrix24ContextFromUrl,
  useBitrix24EmbeddedFlag,
} from "@/lib/bitrix24-integration";

function withEmbedded(path: string): string {
  return buildHashPath(path, { embedded: "bitrix24" });
}

export default function Bitrix24PocPage() {
  const embedded = useBitrix24EmbeddedFlag();
  const ctx = getBitrix24ContextFromUrl();
  const [taskHint, setTaskHint] = useState<string | null>(null);
  const [taskBusy, setTaskBusy] = useState(false);

  const sampleDealerId = DEALER_BASE_ROWS[0]?.id ?? "001";

  const onCreateTestTask = useCallback(async () => {
    setTaskBusy(true);
    setTaskHint(null);
    try {
      const res = await createBitrix24TaskDraft({
        title: "Тестовая задача из Тандор (POC Bitrix24)",
        description: "Черновик без отправки в Bitrix24.",
      });
      if (res.ok) {
        const lines = [res.message];
        if (res.taskId != null && String(res.taskId).length > 0) {
          lines.push(`ID задачи в Bitrix24: ${res.taskId}`);
        }
        setTaskHint(lines.join("\n"));
      } else {
        setTaskHint(res.message);
      }
    } finally {
      setTaskBusy(false);
    }
  }, []);

  const openFullAppUrl = useMemo(() => buildBitrix24OpenTandoorUrl("/dealer-base"), []);

  return (
    <div
      className={cn("mx-auto w-full max-w-2xl space-y-5", embedded && "max-w-full sm:max-w-2xl")}
      data-testid="page-bitrix24-poc"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Тандор в Bitrix24</p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Рабочее место Тандор</h1>
        <p className="text-sm text-muted-foreground">POC интеграции Bitrix24</p>
        {ctx.portalDomain ? (
          <p className="text-xs text-muted-foreground">
            Обнаружен параметр портала в URL: <span className="font-mono text-foreground">{ctx.portalDomain}</span>
          </p>
        ) : null}
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-base">Быстрые переходы</CardTitle>
          <CardDescription className="text-xs">Разделы демо-ЛК (сохраняется режим встраивания при наличии маркера в URL).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button asChild variant="default" className="min-h-10 w-full justify-start gap-2 sm:w-auto sm:min-w-[12rem]">
            <Link href={withEmbedded("/dealer-base")}>
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              Открыть клиентскую базу
            </Link>
          </Button>
          <Button asChild variant="secondary" className="min-h-10 w-full justify-start gap-2 sm:w-auto sm:min-w-[12rem]">
            <Link href={withEmbedded("/tasks")}>
              <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
              Открыть задачи
            </Link>
          </Button>
          <Button asChild variant="secondary" className="min-h-10 w-full justify-start gap-2 sm:w-auto sm:min-w-[12rem]">
            <Link href={withEmbedded("/dealer-base")}>
              <Map className="h-4 w-4 shrink-0" aria-hidden />
              Открыть маршруты
            </Link>
          </Button>
          <Button asChild variant="secondary" className="min-h-10 w-full justify-start gap-2 sm:w-auto sm:min-w-[12rem]">
            <Link href={withEmbedded("/analytics-workspace")}>
              <Target className="h-4 w-4 shrink-0" aria-hidden />
              Открыть KPI
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-dashed border-amber-300/80 bg-amber-50/40 shadow-sm dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Тестовый клиент</CardTitle>
          <CardDescription className="text-xs">Переход в карточку первого клиента из демо-базы.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="min-h-10 w-full font-semibold sm:w-auto">
            <Link href={withEmbedded(`/dealers/${sampleDealerId}`)}>Открыть тестового клиента</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base">Создание задачи в Bitrix24</CardTitle>
          <CardDescription className="text-xs">
            Запрос уходит на сервер Тандор; webhook хранится только в переменных окружения (например, на Vercel).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-10 w-full font-semibold sm:w-auto"
            disabled={taskBusy}
            data-testid="button-bitrix24-create-task"
            onClick={() => void onCreateTestTask()}
          >
            {taskBusy ? "Создание…" : "Создать тестовую задачу в Bitrix24"}
          </Button>
          {taskHint ? (
            <p
              className="whitespace-pre-line rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground"
              role="status"
            >
              {taskHint}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Ссылка для вставки в Bitrix24 (полный URL с маркером встраивания):{" "}
            <a
              className="inline-flex items-center gap-1 break-all font-mono text-[11px] text-primary underline-offset-2 hover:underline"
              href={openFullAppUrl}
              target="_blank"
              rel="noreferrer"
            >
              {openFullAppUrl}
              <ExternalLink className="inline h-3 w-3 shrink-0" aria-hidden />
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
