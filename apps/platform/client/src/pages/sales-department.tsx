import { Link } from "wouter";
import {
  ArrowRightCircle,
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  Database,
  ClipboardCheck,
  Clock3,
  FlagTriangleRight,
  LineChart,
  MapPinned,
  Network,
  Route,
  ShieldCheck,
  Target,
  UserCog,
  Users,
  UserSquare2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { SalesTask, ShowcaseGoal } from "@/lib/api-types";

type RoleCard = {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
};

const roleCards: RoleCard[] = [
  {
    title: "Руководитель отдела продаж",
    description: "Видит весь отдел, команды, дилеров, задачи, цели и KPI.",
    icon: BriefcaseBusiness,
    testId: "card-role-sales-head",
  },
  {
    title: "Руководитель команды",
    description: "Управляет командой менеджеров, ассистентов и региональных менеджеров.",
    icon: Users,
    testId: "card-role-team-head",
  },
  {
    title: "Руководитель региональных менеджеров",
    description: "Контролирует маршруты, визиты, отчеты дистрибуции и покрытие ТТ.",
    icon: MapPinned,
    testId: "card-role-regional-head",
  },
  {
    title: "Менеджер продаж",
    description: "Ведет дилеров, заказы, коммерческие условия и задачи по витринам.",
    icon: LineChart,
    testId: "card-role-sales-manager",
  },
  {
    title: "Ассистент продаж",
    description: "Помогает с документами, статусами, напоминаниями и операционными задачами.",
    icon: ClipboardCheck,
    testId: "card-role-sales-assistant",
  },
  {
    title: "Региональный менеджер",
    description: "Посещает ТТ, заполняет отчеты дистрибуции и формирует цели для продаж.",
    icon: Route,
    testId: "card-role-regional-manager",
  },
];

const kpis = [
  { label: "Дилеры", value: 3, icon: Users },
  { label: "Торговые точки", value: 5, icon: Network },
  { label: "Активные задачи", value: 8, icon: ClipboardCheck },
  { label: "Цели по витринам", value: 5, icon: Target },
  { label: "Визиты РМ", value: 7, icon: MapPinned },
  { label: "Отчеты дистрибуции", value: 4, icon: ShieldCheck },
];

const workflowSteps = [
  "Маршрут РМ",
  "Визит в ТТ",
  "Отчет дистрибуции",
  "Цель по витрине",
  "Задача продажам",
  "Повторная проверка",
];

export default function SalesDepartmentPage() {
  const goalsQuery = useQuery<ShowcaseGoal[]>({
    queryKey: ["/api/sales/showcase-goals"],
  });
  const tasksQuery = useQuery<SalesTask[]>({
    queryKey: ["/api/sales/tasks"],
  });
  const activeGoals = (goalsQuery.data ?? []).filter(
    (goal) => goal.goalStatus === "new" || goal.goalStatus === "in_progress" || goal.goalStatus === "agreed",
  );
  const modelsTarget = (goalsQuery.data ?? []).reduce((sum, goal) => sum + goal.targetModelsCount, 0);
  const modelsDone = (goalsQuery.data ?? []).reduce((sum, goal) => sum + goal.completedModelsCount, 0);

  return (
    <div className="space-y-6" data-testid="page-sales-department">
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">ЛК отдела продаж</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Единая работа с дилерами: продажи, маршруты, визиты и цели по витринам
        </p>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wide">Роли отдела продаж</CardTitle>
          <CardDescription>Единая структура ролей для следующего этапа развития ЛК.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {roleCards.map((role) => (
              <div
                key={role.title}
                className="rounded-[14px] border border-border/80 bg-[#f5f5f5] p-4"
                data-testid={role.testId}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">{role.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{role.description}</p>
                  </div>
                  <role.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                </div>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Скоро</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wide">Общая картина</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-[14px] border border-border/80 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <kpi.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-2 text-2xl font-bold text-foreground">{kpi.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="card-team-south">
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wide">Команда Юг</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-primary" />
            <span className="font-medium">Ольга Соколова</span> — руководитель отдела продаж
          </p>
          <p className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-medium">Дмитрий Романов</span> — руководитель команды
          </p>
          <p className="flex items-center gap-2">
            <MapPinned className="h-4 w-4 text-primary" />
            <span className="font-medium">Мария Лебедева</span> — руководитель региональных менеджеров
          </p>
          <p className="flex items-center gap-2">
            <LineChart className="h-4 w-4 text-primary" />
            <span className="font-medium">Анна Кравченко</span> — менеджер продаж
          </p>
          <p className="flex items-center gap-2">
            <UserSquare2 className="h-4 w-4 text-primary" />
            <span className="font-medium">Сергей Волков</span> — ассистент продаж
          </p>
          <p className="flex items-center gap-2">
            <Route className="h-4 w-4 text-primary" />
            <span className="font-medium">Игорь Мельников</span> — региональный менеджер
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="workflow-sales-department">
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wide">Сквозной процесс работы с дилером</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <div key={step} className="flex items-center gap-2 rounded-[14px] border border-border/80 bg-[#f5f5f5] p-3">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-foreground">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-foreground">{step}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 shadow-sm"
        data-testid="section-sales-goals-and-tasks"
      >
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wide">
            Цели и задачи по витринам
          </CardTitle>
          <CardDescription>
            Связка отчета дистрибуции РМ и работы отдела продаж по дилерам.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[14px] border border-border/80 bg-white p-4">
              <p className="text-xs text-muted-foreground">Активные цели</p>
              <p className="mt-2 text-2xl font-bold">{activeGoals.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">показываем до 3 целей в фокусе</p>
            </div>
            <div className="rounded-[14px] border border-border/80 bg-white p-4">
              <p className="text-xs text-muted-foreground">Задачи отдела продаж</p>
              <p className="mt-2 text-2xl font-bold">{(tasksQuery.data ?? []).length}</p>
              <p className="mt-1 text-xs text-muted-foreground">показываем до 5 ближайших</p>
            </div>
            <div className="rounded-[14px] border border-border/80 bg-white p-4">
              <p className="text-xs text-muted-foreground">Прогресс моделей</p>
              <p className="mt-2 text-2xl font-bold">
                {modelsDone}/{modelsTarget}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">выставлено / к выставлению</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[14px] border border-border/80 bg-[#f5f5f5] p-3">
              <p className="text-xs font-semibold text-muted-foreground">Активные цели (топ-3)</p>
              <ul className="mt-2 space-y-2 text-sm">
                {activeGoals.slice(0, 3).map((goal) => (
                  <li key={goal.id} className="rounded-lg border border-border/70 bg-white p-2">
                    <p className="font-medium">{goal.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {goal.completedModelsCount}/{goal.targetModelsCount} моделей · до {goal.dueDate}
                    </p>
                  </li>
                ))}
                {activeGoals.length === 0 && (
                  <li className="rounded-lg border border-dashed border-border/70 bg-white p-2 text-xs text-muted-foreground">
                    Активных целей пока нет.
                  </li>
                )}
              </ul>
            </div>
            <div className="rounded-[14px] border border-border/80 bg-[#f5f5f5] p-3">
              <p className="text-xs font-semibold text-muted-foreground">Задачи продаж (топ-5)</p>
              <ul className="mt-2 space-y-2 text-sm">
                {(tasksQuery.data ?? []).slice(0, 5).map((task) => (
                  <li key={task.id} className="rounded-lg border border-border/70 bg-white p-2">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      <Clock3 className="mr-1 inline h-3 w-3" />
                      срок {task.dueDate}
                    </p>
                  </li>
                ))}
                {(tasksQuery.data ?? []).length === 0 && (
                  <li className="rounded-lg border border-dashed border-border/70 bg-white p-2 text-xs text-muted-foreground">
                    Задач пока нет.
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              asChild
              variant="outline"
              className="h-11 justify-between rounded-xl bg-white"
              data-testid="button-open-showcase-goals"
            >
              <Link href="/sales/showcase-goals">
                Открыть цели по витринам
                <ArrowRightCircle className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 justify-between rounded-xl bg-white"
              data-testid="button-open-sales-tasks"
            >
              <Link href="/sales/tasks">
                Открыть задачи отдела продаж
                <ArrowRightCircle className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 shadow-sm"
        data-testid="section-sales-leadership-entry"
      >
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wide">
            Управленческий контроль
          </CardTitle>
          <CardDescription>
            Сводная панель для руководителя отдела продаж: цели, задачи, маршруты РМ, рисковые
            дилеры и просрочки.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[14px] border border-border/80 bg-[#f5f5f5] p-3 text-sm text-muted-foreground">
            Управленческая панель объединяет KPI по дилерам, активности РМ, нагрузке команды,
            просрочкам и зонам риска для принятия быстрых решений.
          </div>
          <Button
            asChild
            className="h-11 justify-between rounded-xl"
            data-testid="button-open-sales-leadership"
          >
            <Link href="/sales/leadership">
              Панель руководителя
              <BarChart3 className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 shadow-sm"
        data-testid="section-sales-manager-workspace-entry"
      >
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wide">
            Рабочий стол менеджера
          </CardTitle>
          <CardDescription>
            Ежедневный фокус менеджера продаж: дилеры, задачи, цели по витринам, просрочки и
            сигналы от РМ.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[14px] border border-border/80 bg-[#f5f5f5] p-3 text-sm text-muted-foreground">
            Операционный экран менеджера продаж с фокусом на ежедневные действия, follow-up по
            дилерам и обработку сигналов после визитов регионального менеджера.
          </div>
          <Button
            asChild
            className="h-11 justify-between rounded-xl"
            data-testid="button-open-sales-manager-workspace"
          >
            <Link href="/sales/manager-workspace">
              Открыть рабочий стол
              <ClipboardList className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 shadow-sm"
        data-testid="section-sales-client-import-entry"
      >
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wide">
            Импорт клиентской базы
          </CardTitle>
          <CardDescription>
            Загрузка дилеров из 1С, Битрикс24 и Excel с проверкой дублей, ошибок и распределением по
            ответственным.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[14px] border border-border/80 bg-[#f5f5f5] p-3 text-sm text-muted-foreground">
            В demo-режиме доступен сценарий проверки файла и предпросмотра импорта перед загрузкой в
            единую клиентскую базу дилеров.
          </div>
          <Button
            asChild
            className="h-11 justify-between rounded-xl"
            data-testid="button-open-client-import"
          >
            <Link href="/sales/client-import">
              Импорт клиентской базы
              <Database className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase tracking-wide">Быстрые действия</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-open-dealers">
            <Link href="/dealers">
              Открыть клиентскую базу
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-open-regional-route">
            <Link href="/regional-manager/route">
              Открыть маршрут РМ
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-open-orders">
            <Link href="/orders">
              Открыть заказы
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 justify-between rounded-xl bg-white"
            data-testid="button-quick-client-import"
          >
            <Link href="/sales/client-import">
              Импорт клиентской базы
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 justify-between rounded-xl bg-white"
            data-testid="button-quick-showcase-goals"
          >
            <Link href="/sales/showcase-goals">
              Цели по витринам
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 justify-between rounded-xl bg-white"
            data-testid="button-quick-sales-tasks"
          >
            <Link href="/sales/tasks">
              Задачи продаж
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 justify-between rounded-xl bg-white"
            data-testid="button-quick-sales-manager-workspace"
          >
            <Link href="/sales/manager-workspace">
              Рабочий стол менеджера
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 justify-between rounded-xl bg-white"
            data-testid="button-quick-sales-leadership"
          >
            <Link href="/sales/leadership">
              Панель руководителя
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-open-catalog">
            <Link href="/catalog">
              Открыть каталог
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-border/80 bg-[#f5f5f5] p-4 text-xs text-muted-foreground">
        Следующий этап: детализированные рабочие кабинеты по ролям, отчеты, маршруты и план-факт метрики.
      </div>
    </div>
  );
}
