import { Link } from "wouter";
import { BookOpen, ClipboardList, LayoutGrid, LineChart, ListTodo, Megaphone, Rocket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { ReleaseDemoRoleSwitcher } from "@/components/release-demo-role-switcher";
import { isDemoAuthBypassEnabled, loadMockAuthSession } from "@/lib/mock-auth";

export default function ReleaseOnePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-24" data-testid="page-release-one">
      <FloatingBackButton href="/main" label="На главную" testId="button-floating-back-release-one" />
      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8"
        data-testid="section-release-one-hero"
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative space-y-4 pl-3 sm:pl-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Первый рабочий релиз</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground sm:text-base">
              Release 1 — набор функций без интеграции с 1С: команда может вести планы и факты, обучение, каталог, ручную аналитику и
              маркетинговые брифы в одном интерфейсе. Данные демо и правки хранятся локально в браузере (sessionStorage), пока не
              подключены учётные системы.
            </p>
          </div>
          {isDemoAuthBypassEnabled() && !loadMockAuthSession() ? (
            <div className="max-w-md rounded-xl border border-dashed border-border/80 bg-muted/20 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Демо-роль (без backend)</p>
              <ReleaseDemoRoleSwitcher variant="stacked" />
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl border border-border/80 shadow-sm" data-testid="card-release-module-sales-control">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
              План-факт продаж
            </CardTitle>
            <CardDescription>Команды, менеджеры, KPI, валовая прибыль, комментарии. Локальные планы и факт.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="min-h-10 w-full font-semibold sm:w-auto">
              <Link href="/sales-control">Открыть</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/80 shadow-sm" data-testid="card-release-module-catalog">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4 text-primary" aria-hidden />
              Каталог
            </CardTitle>
            <CardDescription>Каталог товаров с галереей фото в карточке товара.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="min-h-10 w-full font-semibold sm:w-auto">
              <Link href="/catalog">К каталогу</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/80 shadow-sm" data-testid="card-release-module-training">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-primary" aria-hidden />
              Обучение
            </CardTitle>
            <CardDescription>Материалы по ВХ, МК, фурнитуре, продажам и работе с возражениями; поиск на главной раздела.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="min-h-10 w-full font-semibold sm:w-auto">
              <Link href="/training">К обучению</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/80 shadow-sm" data-testid="card-release-module-analytics">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-4 w-4 text-primary" aria-hidden />
              Аналитика ручного ввода
            </CardTitle>
            <CardDescription>Восемь вкладок с таблицами и фильтрами; правки без 1С.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="min-h-10 w-full font-semibold sm:w-auto">
              <Link href="/analytics-workspace">Аналитика команды</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/80 shadow-sm" data-testid="card-release-module-marketing">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" aria-hidden />
              Маркетинговые брифы
            </CardTitle>
            <CardDescription>Ежемесячные брифы: черновик и публикация для команды.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="min-h-10 w-full font-semibold sm:w-auto">
              <Link href="/marketing-briefs">К брифам</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/80 shadow-sm sm:col-span-2" data-testid="card-release-module-clients">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" aria-hidden />
              Клиенты пилота (Excel)
            </CardTitle>
            <CardDescription>
              Полный список клиентов Release 1: РОП, менеджеры, типы, фильтры и видимость по демо-ролям. Данные подгружаются из
              сгенерированного seed (импорт из «Spisok-klientov-dlia-Karena.xlsx»).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="min-h-10 w-full font-semibold sm:w-auto">
              <Link href="/release-one/clients" data-testid="link-release-one-clients">
                Открыть клиентов пилота
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/80 shadow-sm sm:col-span-2" data-testid="card-release-module-tasks">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="h-4 w-4 text-primary" aria-hidden />
              Задачи и внимание к клиентам
            </CardTitle>
            <CardDescription>
              Клиентская база, карточки клиента и торговой точки с блоком «Обучение и внимание к персоналу», задачи по продуктовому
              обучению, карточка территории.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-10">
              <Link href="/dealer-base">Клиенты</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-10">
              <Link href="/tasks">Задачи</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-10">
              <Link href="/territory-card">Карточка территории</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Rocket className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>Классическая аналитика отдела по-прежнему в разделе «Аналитика» в меню.</span>
      </div>
    </div>
  );
}
