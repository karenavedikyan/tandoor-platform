import { Link } from "wouter";
import { ArrowRight, Building2, Database, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CURRENT_PREVIEW_STAGE,
  MODULE_VISIBILITY,
  getModuleStatusLabel,
  getModuleStatusTone,
  type ModuleVisibilityStatus,
} from "@/lib/preview-config";
import { cn } from "@/lib/utils";

function StatusBadge({ status, testId }: { status: ModuleVisibilityStatus; testId?: string }) {
  const tone = getModuleStatusTone(status);
  const label = getModuleStatusLabel(status);
  const cls =
    tone === "lime"
      ? "border-[#7DC400]/40 bg-[#7DC400]/20 text-foreground"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "blue"
          ? "border-sky-200 bg-sky-50 text-sky-900"
          : "border-neutral-200 bg-neutral-100 text-neutral-700";
  return (
    <Badge variant="outline" className={cn("font-medium", cls)} data-testid={testId ?? `badge-status-${status}`}>
      {label}
    </Badge>
  );
}

const ROADMAP_STEPS = [
  "Архитектура и безопасность",
  "Единая карточка дилера",
  "Импорт и сверка клиентской базы",
  "ЛК менеджера продаж",
  "ЛК регионального менеджера",
  "Панель руководителя",
  "ЛК дилера и внешние сценарии",
  "База знаний и обучение",
  "Расширение на другие отделы",
] as const;

const DATA_SOURCES = [
  {
    id: "one-c",
    title: "1С",
    body: "Товары, цены, остатки, заказы, отгрузки, дебиторка.",
    testId: "card-data-source-one-c",
  },
  {
    id: "bitrix-site",
    title: "Bitrix-сайт",
    body: "Каталог, ЛК дилера, заказы, рекламации, документы.",
    testId: "card-data-source-bitrix-site",
  },
  {
    id: "bitrix24",
    title: "Bitrix24",
    body: "CRM, сделки, коммуникации, задачи.",
    testId: "card-data-source-bitrix24",
  },
  {
    id: "excel",
    title: "Excel",
    body: "Рабочие таблицы и исторические загрузки.",
    testId: "card-data-source-excel",
  },
  {
    id: "google",
    title: "Google Документы / Таблицы",
    body: "Текущие доски, таблицы и материалы до миграции.",
    testId: "card-data-source-google",
  },
  {
    id: "platform",
    title: "Tandoor Platform",
    body: "Новый операционный слой.",
    testId: "card-data-source-platform",
  },
] as const;

const PLATFORM_MODULES: {
  id: string;
  title: string;
  description: string;
  moduleKey: keyof typeof MODULE_VISIBILITY | "sales_manager_ui" | "documents";
  testId: string;
}[] = [
  {
    id: "client-base",
    title: "Единая клиентская база",
    description: "Нормализация и сверка контрагентов из разных источников.",
    moduleKey: "client_base",
    testId: "card-platform-module-client-base",
  },
  {
    id: "dealer-card",
    title: "Карточка дилера",
    description: "Центральная сущность: точки, контакты, ответственные, качество данных.",
    moduleKey: "dealer_card",
    testId: "card-platform-module-dealer-card",
  },
  {
    id: "sales-manager",
    title: "ЛК менеджера продаж",
    description: "Рабочий стол, задачи и сопровождение дилеров.",
    moduleKey: "sales_tasks",
    testId: "card-platform-module-sales-manager",
  },
  {
    id: "regional-manager",
    title: "ЛК регионального менеджера",
    description: "Витрины, визиты, отчёты по региону.",
    moduleKey: "regional_manager",
    testId: "card-platform-module-regional-manager",
  },
  {
    id: "leadership",
    title: "Панель руководителя",
    description: "KPI, контроль команды и отклонения.",
    moduleKey: "sales_department",
    testId: "card-platform-module-leadership",
  },
  {
    id: "claims",
    title: "Рекламации",
    description: "Сквозной сервисный контур.",
    moduleKey: "claims",
    testId: "card-platform-module-claims",
  },
  {
    id: "orders-debt",
    title: "Заказы и дебиторка",
    description: "Исполнение и финансовая дисциплина.",
    moduleKey: "orders",
    testId: "card-platform-module-orders-debt",
  },
  {
    id: "knowledge-learning",
    title: "База знаний и обучение",
    description: "Wiki, материалы для дилеров и менеджеров.",
    moduleKey: "knowledge_base",
    testId: "card-platform-module-knowledge-learning",
  },
  {
    id: "documents",
    title: "Документы",
    description: "Единый доступ к договорам и актам.",
    moduleKey: "documents",
    testId: "card-platform-module-documents",
  },
  {
    id: "admin",
    title: "Администрирование и права",
    description: "Роли, аудит и настройка видимости модулей.",
    moduleKey: "admin",
    testId: "card-platform-module-admin",
  },
];

export default function PreviewHome() {
  return (
    <div className="space-y-12 sm:space-y-16" data-testid="page-preview-home">
      <section
        className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-10"
        data-testid="section-preview-hero"
      >
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Tandoor Platform</h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Единая платформа для работы с дилерами, менеджерами, региональными командами и руководителями.
          </p>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Мы объединяем данные из 1С, Bitrix, Bitrix24, Excel и Google-источников в единую операционную систему
            Tandoor.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              className="min-h-11 bg-[#7DC400] text-black hover:bg-[#6cad00] border border-[#6cad00]/40"
              data-testid="button-open-current-stage"
            >
              <Link href="/dealer-card-foundation">
                Открыть первый этап
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild className="min-h-11 border-neutral-200 bg-white" data-testid="button-open-platform-architecture">
              <Link href="/platform-architecture">Посмотреть архитектуру</Link>
            </Button>
          </div>
        </div>
      </section>

      <section data-testid="section-current-preview-stage">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Текущий этап</h2>
        <Card
          className="mt-4 border-neutral-200/80 bg-white shadow-sm"
          data-testid="card-current-stage-dealer-card"
        >
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg sm:text-xl">{CURRENT_PREVIEW_STAGE.title}</CardTitle>
              <StatusBadge status={CURRENT_PREVIEW_STAGE.status} testId="badge-current-stage-status" />
            </div>
            <CardDescription className="text-base text-muted-foreground">{CURRENT_PREVIEW_STAGE.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Что будет видно</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                <li>источники данных;</li>
                <li>связи с внешними системами;</li>
                <li>торговые точки;</li>
                <li>контакты;</li>
                <li>ответственные;</li>
                <li>качество данных;</li>
                <li>дубли;</li>
                <li>активность из ЛК дилера.</li>
              </ul>
            </div>
            <Button
              asChild
              className="bg-[#7DC400] text-black hover:bg-[#6cad00] border border-[#6cad00]/40"
              data-testid="button-open-dealer-card-foundation"
            >
              <Link href="/dealer-card-foundation">
                Перейти к карточке дилера
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section data-testid="section-data-sources">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-[#5a9e00]" aria-hidden />
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Текущие системы и источники данных</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {DATA_SOURCES.map((src) => (
            <Card key={src.id} className="border-neutral-200/80 bg-white shadow-sm" data-testid={src.testId}>
              <CardHeader>
                <CardTitle className="text-base">{src.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{src.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section data-testid="section-platform-modules">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[#5a9e00]" aria-hidden />
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Будущие модули</h2>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Плитки отражают дорожную карту. Внутренние прототипы не ведут в демо-разделы — только отображают статус.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_MODULES.map((m) => {
            const status = MODULE_VISIBILITY[m.moduleKey] ?? "planned";
            const isClickable = status === "preview" || status === "beta" || status === "production";
            const inner = (
              <>
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{m.title}</CardTitle>
                    <StatusBadge status={status} testId={`${m.testId}-status`} />
                  </div>
                  <CardDescription>{m.description}</CardDescription>
                </CardHeader>
              </>
            );
            return (
              <Card
                key={m.id}
                data-testid={m.testId}
                className={cn(
                  "border-neutral-200/80 bg-white shadow-sm transition-shadow",
                  isClickable ? "hover:shadow-md" : "opacity-95",
                )}
              >
                {isClickable && m.moduleKey === "dealer_card" ? (
                  <Link href="/dealer-card-foundation" className="block no-underline text-inherit">
                    {inner}
                  </Link>
                ) : (
                  <div className="block cursor-default">{inner}</div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <section data-testid="section-roadmap-preview">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[#5a9e00]" aria-hidden />
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Как мы двигаемся</h2>
        </div>
        <ol className="mt-4 space-y-3 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm sm:p-6">
          {ROADMAP_STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm sm:text-base">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7DC400]/20 text-xs font-semibold text-foreground">
                {i + 1}
              </span>
              <span className="pt-0.5 text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm sm:p-8"
        data-testid="section-preview-disclaimer"
      >
        <h2 className="text-lg font-semibold text-foreground">Почему часть разделов скрыта</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Внутри проекта уже есть MVP-прототипы кабинетов и процессов. Они сохраняются как внутренний каркас, но не
          показываются тестировщикам до готовности, чтобы не создавать впечатление рабочей production-системы.
        </p>
      </section>
    </div>
  );
}
