import { Link } from "wouter";
import { BarChart3, BookOpen, LayoutGrid, LineChart, Megaphone, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { ReleaseDemoRoleSwitcher } from "@/components/release-demo-role-switcher";
import { cn } from "@/lib/utils";

const DEFAULT_MANAGER = "mgr-boyko-em";
const DEMO_MANAGER_KEY = "sales-control-demo-manager-id";

function setDemoManager(id: string) {
  if (typeof window !== "undefined" && window.sessionStorage) {
    window.sessionStorage.setItem(DEMO_MANAGER_KEY, id);
  }
}

export default function SalesControlHub() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24" data-testid="page-sales-control">
      <FloatingBackButton href="/main" label="На главную" testId="button-floating-back-sales-control-hub" />
      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8"
        data-testid="section-sales-control-hero"
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative space-y-4 pl-3 sm:pl-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">План-факт продаж</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Контур планирования и контроля выполнения: планы по KPI и валовой прибыли, факт менеджеров и сводка для руководства.
              На этом этапе данные и сохранения локальные (без сервера). Роль и персона для демо задаются в шапке приложения или ниже.
            </p>
          </div>
          <div className="max-w-lg rounded-xl border border-dashed border-border/80 bg-muted/15 p-3">
            <ReleaseDemoRoleSwitcher variant="stacked" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="min-h-10 font-semibold" data-testid="button-sales-control-open-director">
              <Link href="/sales-control/director">Панель руководителя продаж</Link>
            </Button>
            <Button asChild variant="secondary" className="min-h-10 font-semibold" data-testid="button-sales-control-open-team-lead">
              <Link href="/sales-control/team-lead">Панель руководителя команды</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="min-h-10 font-semibold"
              data-testid="button-sales-control-open-manager"
              onClick={() => setDemoManager(DEFAULT_MANAGER)}
            >
              <Link href="/sales-control/manager">Панель менеджера</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold" data-testid="button-sales-control-open-plans">
              <Link href="/sales-control/plans">Сводная таблица планов</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold" data-testid="button-sales-control-open-performance">
              <Link href="/sales-control/performance">Выполнение по командам</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="rounded-2xl border border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="h-4 w-4 text-primary" aria-hidden />
              Руководитель продаж
            </CardTitle>
            <CardDescription>Сводные KPI, фильтры по командам и менеджерам, комментарии.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="default" size="sm" className="w-full sm:w-auto">
              <Link href="/sales-control/director">Открыть</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" aria-hidden />
              Руководитель команды
            </CardTitle>
            <CardDescription>Планы по семи менеджерам своей команды (по выбранной персоне руководителя команды).</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="default" size="sm" className="w-full sm:w-auto">
              <Link href="/sales-control/team-lead">Открыть</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-4 w-4 text-primary" aria-hidden />
              Менеджер
            </CardTitle>
            <CardDescription>Просмотр плана, ввод факта, комментарий руководителя (персона менеджера в демо-профиле).</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="default" size="sm" className="w-full sm:w-auto" onClick={() => setDemoManager(DEFAULT_MANAGER)}>
              <Link href="/sales-control/manager">Открыть</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" aria-hidden />
              Аналитик и маркетолог
            </CardTitle>
            <CardDescription>Сводные планы, аналитика команды и маркетинговые брифы (Release 1, без 1С).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/sales-control/performance">Выполнение</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/sales-control/plans">Планы</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/analytics-workspace">Аналитика команды</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/marketing-briefs">Брифы</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="rounded-2xl border border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-primary" aria-hidden />
              Обучение
            </CardTitle>
            <CardDescription>Материалы и поиск по разделу обучения.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/training">Открыть обучение</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4 text-primary" aria-hidden />
              Каталог
            </CardTitle>
            <CardDescription>Каталог и карточка товара с галереей.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/catalog">К каталогу</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-border/80 shadow-sm sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" aria-hidden />
              Маркетинговые брифы
            </CardTitle>
            <CardDescription>Ежемесячные брифы для команды продаж.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="default" size="sm">
              <Link href="/marketing-briefs">Открыть брифы</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className={cn("text-xs text-muted-foreground")}>
        Руководитель продаж видит все команды на панели директора; руководитель команды — свою команду; менеджер — свои планы и факт.
      </p>
    </div>
  );
}
