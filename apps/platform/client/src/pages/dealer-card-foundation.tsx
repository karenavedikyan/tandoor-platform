import type { ComponentProps, ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Camera,
  ClipboardList,
  Database,
  Handshake,
  LayoutGrid,
  MapPin,
  Phone,
  PieChart,
  Shield,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * Публичный первый этап: каркас карточки дилера по структуре sensus (отдел продаж).
 * Только demo-данные. Для `/#/` и `/#/dealer-card-foundation`.
 * Визуальные токены — из index.css (бренд Tandoor / ЛК).
 */

function SectionTitle({ children, subtitle, className }: { children: ReactNode; subtitle?: string; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">{children}</h2>
      {subtitle ? <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

function FieldRow({ label, value, icon: Icon }: { label: string; value: string; icon?: ComponentType<{ className?: string }> }) {
  return (
    <div className="flex gap-3 border-b border-border py-3 last:border-0 sm:items-start sm:gap-4">
      {Icon ? (
        <span className="mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium leading-snug text-foreground sm:text-[15px]">{value}</p>
      </div>
    </div>
  );
}

function KpiTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md">
      <CardHeader className="space-y-1 pb-2 pt-5">
        <CardDescription className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-tight text-foreground sm:text-[26px]">{value}</CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

function SurfaceCard({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & ComponentProps<typeof Card>) {
  return (
    <Card className={cn("rounded-2xl border border-border/80 bg-card shadow-md", className)} {...rest}>
      {children}
    </Card>
  );
}

export function DealerCardFoundationContent() {
  return (
    <div className="space-y-6 sm:space-y-8" data-testid="page-dealer-card-foundation">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative pl-3 sm:pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-full border-primary/35 bg-primary/12 px-2.5 py-0.5 font-semibold text-foreground"
              data-testid="badge-preview-stage"
            >
              Preview · Первый этап
            </Badge>
            <Badge variant="outline" className="rounded-full border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-900">
              Активный
            </Badge>
            <Badge variant="outline" className="rounded-full border-amber-200/90 bg-amber-50 px-2.5 py-0.5 font-medium text-amber-950">
              TOP
            </Badge>
            <Badge variant="outline" className="rounded-full border-border bg-muted/60 px-2.5 py-0.5 font-medium text-muted-foreground">
              Демо
            </Badge>
            <Badge variant="outline" className="rounded-full border-border bg-muted/40 px-2.5 py-0.5 font-medium text-muted-foreground">
              Обновлено 01.05.2026
            </Badge>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Единая карточка дилера</h1>
          <p className="mt-1 text-base font-medium text-muted-foreground sm:text-lg">Первый этап платформы Tandoor</p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Собираем единую рабочую карточку клиента: данные из 1С, Bitrix, Bitrix24, Excel и Google-таблиц, а также из
            отчетов региональных менеджеров.
          </p>
        </div>
      </section>

      {/* 1: Сводка + ответственные + ТТ — верхний рабочий блок */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <section className="lg:col-span-5" data-testid="section-dealer-summary">
          <SectionTitle subtitle="Данные обезличены. Структура по таблице отдела продаж.">Сводка дилера</SectionTitle>
          <SurfaceCard className="mt-3">
            <CardContent className="pt-5">
              <FieldRow label="№" value="001 (демо)" />
              <FieldRow label="Название клиента" value="Демо-дилер" icon={Building2} />
              <FieldRow label="Категория клиента" value="TOP / ключевой клиент" />
              <FieldRow label="Статус" value="Активный" />
              <FieldRow label="Холдинг / сеть" value="Демо-холдинг" />
              <FieldRow label="Юрлицо" value="Демо-юрлицо" />
              <FieldRow label="Регион / город" value="Демо-регион" icon={MapPin} />
            </CardContent>
          </SurfaceCard>
        </section>

        <section className="lg:col-span-7" data-testid="section-dealer-responsibles">
          <SectionTitle subtitle="Кто ведет клиента и к кому обращаться.">Ответственные</SectionTitle>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { role: "Руководитель", name: "Иванов И.И.", zone: "Стратегия и контроль команды" },
              { role: "Менеджер продаж", name: "Петров П.П.", zone: "Сопровождение договоренностей и заказов" },
              { role: "Региональный менеджер", name: "Сидорова С.С.", zone: "Визиты, витрины, отчеты по региону" },
              { role: "Ассистент / будущая роль", name: "Кузнецова К.К.", zone: "Подготовка материалов и координация" },
            ].map((p) => (
              <SurfaceCard key={p.role}>
                <CardHeader className="space-y-1 pb-2 pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" aria-hidden />
                    <CardDescription className="text-[11px] font-bold uppercase tracking-wide text-primary">
                      {p.role}
                    </CardDescription>
                  </div>
                  <CardTitle className="text-base font-semibold text-foreground">{p.name}</CardTitle>
                </CardHeader>
                <CardContent className="pb-4 text-sm leading-relaxed text-muted-foreground">{p.zone}</CardContent>
              </SurfaceCard>
            ))}
          </div>
        </section>
      </div>

      <section data-testid="section-dealer-trade-points">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle subtitle="Основная торговая точка по сенсусу.">Торговые точки</SectionTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="h-10 shrink-0 self-start border-border bg-card sm:self-auto"
            data-testid="button-dealer-open-trade-point"
            title="Список точек будет доступен после подключения данных"
          >
            Все точки
          </Button>
        </div>
        <SurfaceCard className="mt-3">
          <CardHeader className="flex flex-row items-center gap-2 pb-0 pt-5">
            <Store className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle className="text-base font-semibold">Торговая точка №1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-2">
            <FieldRow label="Адрес" value="ул. Примерная, д. 1, Демо-регион" icon={MapPin} />
            <FieldRow label="Формат точки" value="Монобрендовый салон" />
            <FieldRow label="Оборудование" value="Стенд МК, образцы ВХ" />
            <FieldRow label="Работа в склад фурнитура/двери" value="Да, по согласованному графику" />
            <FieldRow label="Дата последнего обновления" value="15.04.2026 (демо)" />
            <Separator className="my-4 bg-border" />
            <div className="rounded-xl border border-dashed border-border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <Camera className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Фото ТТ снаружи и внутри</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Фото будет загружаться из отчета регионального менеджера
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </SurfaceCard>
      </section>

      {/* Операционные */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section data-testid="section-dealer-terms">
          <SectionTitle subtitle="Условия сотрудничества в одном месте.">Условия работы</SectionTitle>
          <SurfaceCard className="mt-3">
            <CardContent className="pt-5">
              <FieldRow label="Тандор клуб" value="Участник (демо)" icon={Handshake} />
              <FieldRow label="Спец. условия" value="Индивидуальная скидка по согласованию" />
              <FieldRow label="Тип оплаты" value="Отсрочка 14 дней (демо)" />
              <FieldRow label="ЭДО" value="Диадок / аналог (демо)" />
              <FieldRow label="Лимит / индивидуальные условия" value="Лимит 2,0 млн ₽ (демо)" />
              <FieldRow label="Бонусы / мотивация продавцов" value="Квартальная программа (демо)" />
            </CardContent>
          </SurfaceCard>
        </section>

        <section data-testid="section-dealer-sales">
          <SectionTitle subtitle="Средние показатели за квартал — демо-значения.">Продажи</SectionTitle>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-2">
            <KpiTile label="За квартал" value="1,2 млн ₽" hint="Обновление: демо" />
            <KpiTile label="МК, шт." value="450" />
            <KpiTile label="ВХ, шт." value="150" />
            <KpiTile label="Фурнитура" value="150 тыс. ₽" />
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            Последняя активность: 01.05.2026 (демо)
          </p>
        </section>
      </div>

      <section data-testid="section-dealer-distribution">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle subtitle="По данным отчета регионального менеджера. Проверка: 20.04.2026 (демо).">
            Дистрибуция
          </SectionTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="h-10 shrink-0 self-start border-border bg-card sm:self-auto"
            data-testid="button-dealer-open-distribution"
            title="Детализация появится после подключения отчетов"
          >
            Подробнее
          </Button>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {[
            { label: "МК", pct: 63 },
            { label: "ВХ", pct: 53 },
            { label: "Общая дистрибуция", pct: 59 },
          ].map((d) => (
            <SurfaceCard key={d.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" aria-hidden />
                  <CardTitle className="text-sm font-semibold">{d.label}</CardTitle>
                </div>
                <span className="text-lg font-bold tabular-nums text-foreground">{d.pct}%</span>
              </CardHeader>
              <CardContent className="pb-5">
                <Progress value={d.pct} className="h-2.5 bg-muted" />
              </CardContent>
            </SurfaceCard>
          ))}
        </div>
      </section>

      <section data-testid="section-dealer-showcases">
        <SectionTitle subtitle="Связь с целями отдела продаж по данным региональных менеджеров.">
          Витрины и оборудование
        </SectionTitle>
        <SurfaceCard className="mt-3">
          <CardContent className="space-y-1 pt-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <LayoutGrid className="h-4 w-4 text-primary" aria-hidden />
              Состояние витрины и оборудования
            </div>
            <FieldRow label="Установленное оборудование" value="Стенд МК, план ВХ Q2 (демо)" />
            <FieldRow label="Что нужно добавить" value="Доп. образцы фурнитуры (демо)" />
            <FieldRow label="Статус витрины" value="В работе — 80% (демо)" />
            <FieldRow label="Связь с целями отдела продаж" value="Цель по МК на квартал (демо)" />
            <p className="mt-4 rounded-xl border border-border bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              На основании отчетов регионального менеджера здесь будут формироваться цели по витринам.
            </p>
          </CardContent>
        </SurfaceCard>
      </section>

      {/* Контекстные */}
      <section data-testid="section-dealer-contacts">
        <SectionTitle subtitle="ЛПР и каналы связи — только демо-значения.">Контакты и ЛПР</SectionTitle>
        <SurfaceCard className="mt-3">
          <CardContent className="space-y-1 pt-5">
            <FieldRow label="ЛПР" value="Директор точки (демо)" />
            <FieldRow label="Собственник / закупщик" value="Закупщик (демо)" />
            <FieldRow label="Телефон" value="+7 XXX XXX-XX-XX" icon={Phone} />
            <FieldRow label="Email" value="demo@example.com" />
            <FieldRow label="Предпочтительный канал связи" value="Email и мессенджер" />
          </CardContent>
        </SurfaceCard>
      </section>

      <section data-testid="section-dealer-competitors">
        <SectionTitle subtitle="Обзор конкурентной среды в точке.">Конкуренты</SectionTitle>
        <SurfaceCard className="mt-3">
          <CardContent className="space-y-1 pt-5">
            <FieldRow label="Конкуренты в торговой точке" value="Конкурент A, Конкурент B, Конкурент C" />
            <FieldRow label="Сильные позиции конкурентов" value="Цена на ВХ, быстрые поставки (демо)" />
            <FieldRow label="Комментарий менеджера" value="Держим позицию по МК, усиливаем ВХ (демо)" />
            <FieldRow label="Комментарий регионального менеджера" value="Запланирован визит для фото витрины (демо)" />
          </CardContent>
        </SurfaceCard>
      </section>

      <section data-testid="section-dealer-problems">
        <SectionTitle subtitle="То, что нужно закрыть в первую очередь.">Проблемы и комментарии</SectionTitle>
        <SurfaceCard className="mt-3 border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-card">
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-amber-300/80 bg-amber-100/60 font-medium text-amber-950">
                <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
                Требует внимания
              </Badge>
            </div>
            <p className="text-sm font-semibold leading-relaxed text-red-700 sm:text-base">
              Необходимо проверить полноту витрины и актуальность контактных данных.
            </p>
            <div className="grid gap-4 rounded-xl bg-card/80 p-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Кто зафиксировал</p>
                <p className="mt-1 text-sm font-medium text-foreground">Региональный менеджер (демо)</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Дата</p>
                <p className="mt-1 text-sm font-medium text-foreground">28.04.2026</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Следующий шаг</p>
                <p className="mt-1 text-sm font-medium text-foreground">Визит и обновление карточки</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Статус</p>
                <p className="mt-1 text-sm font-medium text-foreground">В работе</p>
              </div>
            </div>
          </CardContent>
        </SurfaceCard>
      </section>

      <section data-testid="section-dealer-data-sources">
        <SectionTitle subtitle="Краткий обзор: откуда подтягиваются данные в карточку.">Источники данных</SectionTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            { title: "1С", text: "Продажи, отгрузки, юрлица, дебиторка" },
            { title: "Bitrix / ЛК дилера", text: "Заказы, рекламации, активность" },
            { title: "Bitrix24", text: "Задачи, коммуникации, сделки и рекламации" },
            { title: "Excel / Google", text: "Таблицы отдела продаж (сенсус и др.)" },
          ].map((s) => (
            <SurfaceCard key={s.title}>
              <CardHeader className="flex flex-row items-center gap-2 pb-2 pt-4">
                <Database className="h-4 w-4 text-primary" aria-hidden />
                <CardTitle className="text-sm font-semibold">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 text-sm leading-relaxed text-muted-foreground">{s.text}</CardContent>
            </SurfaceCard>
          ))}
          <SurfaceCard className="sm:col-span-2">
            <CardHeader className="flex flex-row items-center gap-2 pb-2 pt-4">
              <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
              <CardTitle className="text-sm font-semibold">Отчет РМ</CardTitle>
            </CardHeader>
            <CardContent className="pb-4 text-sm leading-relaxed text-muted-foreground">Визиты, фото, дистрибуция, витрины</CardContent>
          </SurfaceCard>
        </div>
      </section>

      <section
        className="rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-7"
        data-testid="section-dealer-review-focus"
      >
        <div className="flex items-start gap-3">
          <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <SectionTitle>Что проверяем на первом этапе</SectionTitle>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>достаточно ли полей для отдела продаж;</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>понятна ли структура карточки;</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>какие поля обязательные, а какие второстепенные;</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>что нужно менеджеру продаж;</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>что нужно региональному менеджеру;</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>что нужно руководителю;</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>какие данные можно синхронизировать, а какие нужно вводить вручную.</span>
              </li>
            </ul>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                disabled
                className="min-h-11 font-semibold disabled:opacity-60"
                data-testid="button-dealer-open-feedback"
                title="Форма обратной связи появится на следующем этапе"
              >
                Открыть обратную связь
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled
                className="min-h-11 border-border bg-card"
                data-testid="button-dealer-mark-field-missing"
                title="Отметка полей будет доступна после подключения данных"
              >
                Отметить недостающее поле
              </Button>
            </div>
          </div>
        </div>
      </section>

      <p className="flex items-center justify-center gap-2 px-2 text-center text-[11px] text-muted-foreground sm:text-xs" data-testid="text-preview-footer-note">
        <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
        Демонстрационный интерфейс без доступа к production-данным.
      </p>
    </div>
  );
}

export default function DealerCardFoundation() {
  return <DealerCardFoundationContent />;
}
