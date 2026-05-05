import type { ComponentProps, ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  Camera,
  Handshake,
  LayoutGrid,
  MapPin,
  Phone,
  PieChart,
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

/** Публичная карточка дилера: рабочий интерфейс, нейтральные заполнители без персональных данных. */

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

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md">
      <CardHeader className="space-y-1 pb-2 pt-5">
        <CardDescription className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tracking-tight text-foreground sm:text-[26px]">{value}</CardTitle>
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
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative pl-3 sm:pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-900">
              Активный
            </Badge>
            <Badge variant="outline" className="rounded-full border-amber-200/90 bg-amber-50 px-2.5 py-0.5 font-medium text-amber-950">
              TOP
            </Badge>
            <Badge variant="outline" className="rounded-full border-border bg-muted/50 px-2.5 py-0.5 font-medium text-muted-foreground">
              Обновлено 01.05.2026
            </Badge>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Единая карточка дилера</h1>
          <p className="mt-1 text-base font-medium text-muted-foreground sm:text-lg">Сводная информация по клиенту и торговым точкам</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <section className="lg:col-span-5" data-testid="section-dealer-summary">
          <SectionTitle subtitle="Ключевые реквизиты и классификация.">Сводка дилера</SectionTitle>
          <SurfaceCard className="mt-3">
            <CardContent className="pt-5">
              <FieldRow label="№" value="001" />
              <FieldRow label="Название клиента" value="Дилер №001" icon={Building2} />
              <FieldRow label="Категория клиента" value="TOP / ключевой клиент" />
              <FieldRow label="Статус" value="Активный" />
              <FieldRow label="Холдинг / сеть" value="Группа компаний «Юг»" />
              <FieldRow label="Юрлицо" value="ООО «Торговый партнёр»" />
              <FieldRow label="Регион / город" value="Южный регион" icon={MapPin} />
            </CardContent>
          </SurfaceCard>
        </section>

        <section className="lg:col-span-7" data-testid="section-dealer-responsibles">
          <SectionTitle subtitle="Кто ведёт клиента и к кому обращаться.">Ответственные</SectionTitle>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { role: "Руководитель", name: "Иванов И.И.", zone: "Стратегия и контроль команды" },
              { role: "Менеджер продаж", name: "Петров П.П.", zone: "Сопровождение договорённостей и заказов" },
              { role: "Региональный менеджер", name: "Сидорова С.С.", zone: "Визиты, витрины, отчёты по региону" },
              { role: "Ассистент", name: "Кузнецова К.К.", zone: "Подготовка материалов и координация" },
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
          <SectionTitle subtitle="Основная торговая точка.">Торговые точки</SectionTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="h-10 shrink-0 self-start border-border bg-card sm:self-auto"
            data-testid="button-dealer-open-trade-point"
            title="Список точек"
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
            <FieldRow label="Адрес" value="ул. Примерная, д. 1, г. Краснодар" icon={MapPin} />
            <FieldRow label="Формат точки" value="Монобрендовый салон" />
            <FieldRow label="Оборудование" value="Стенд МК, образцы ВХ" />
            <FieldRow label="Работа в склад фурнитура/двери" value="Да, по согласованному графику" />
            <FieldRow label="Дата последнего обновления" value="15.04.2026" />
            <Separator className="my-4 bg-border" />
            <div className="rounded-xl border border-dashed border-border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <Camera className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Фото ТТ снаружи и внутри</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Фотографии не прикреплены</p>
                </div>
              </div>
            </div>
          </CardContent>
        </SurfaceCard>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section data-testid="section-dealer-terms">
          <SectionTitle subtitle="Условия сотрудничества.">Условия работы</SectionTitle>
          <SurfaceCard className="mt-3">
            <CardContent className="pt-5">
              <FieldRow label="Тандор клуб" value="Участник" icon={Handshake} />
              <FieldRow label="Спец. условия" value="Индивидуальная скидка по согласованию" />
              <FieldRow label="Тип оплаты" value="Отсрочка 14 дней" />
              <FieldRow label="ЭДО" value="Диадок / аналог" />
              <FieldRow label="Лимит / индивидуальные условия" value="Лимит 2,0 млн ₽" />
              <FieldRow label="Бонусы / мотивация продавцов" value="Квартальная программа" />
            </CardContent>
          </SurfaceCard>
        </section>

        <section data-testid="section-dealer-sales">
          <SectionTitle subtitle="Средние показатели за квартал.">Продажи</SectionTitle>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-2">
            <KpiTile label="За квартал" value="1,2 млн ₽" />
            <KpiTile label="МК, шт." value="450" />
            <KpiTile label="ВХ, шт." value="150" />
            <KpiTile label="Фурнитура" value="150 тыс. ₽" />
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            Последняя активность: 01.05.2026
          </p>
        </section>
      </div>

      <section data-testid="section-dealer-distribution">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle subtitle="По данным последней проверки, 20.04.2026.">Дистрибуция</SectionTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            className="h-10 shrink-0 self-start border-border bg-card sm:self-auto"
            data-testid="button-dealer-open-distribution"
            title="Подробнее"
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
        <SectionTitle subtitle="Витрина и оборудование в точке.">Витрины и оборудование</SectionTitle>
        <SurfaceCard className="mt-3">
          <CardContent className="space-y-1 pt-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <LayoutGrid className="h-4 w-4 text-primary" aria-hidden />
              Состояние витрины и оборудования
            </div>
            <FieldRow label="Установленное оборудование" value="Стенд МК, план ВХ Q2" />
            <FieldRow label="Что нужно добавить" value="Доп. образцы фурнитуры" />
            <FieldRow label="Статус витрины" value="В работе — 80%" />
            <FieldRow label="Связь с целями отдела продаж" value="Цель по МК на квартал" />
          </CardContent>
        </SurfaceCard>
      </section>

      <section data-testid="section-dealer-contacts">
        <SectionTitle subtitle="ЛПР и каналы связи.">Контакты и ЛПР</SectionTitle>
        <SurfaceCard className="mt-3">
          <CardContent className="space-y-1 pt-5">
            <FieldRow label="ЛПР" value="Директор точки" />
            <FieldRow label="Собственник / закупщик" value="Закупщик" />
            <FieldRow label="Телефон" value="+7 XXX XXX-XX-XX" icon={Phone} />
            <FieldRow label="Email" value="client@company.test" />
            <FieldRow label="Предпочтительный канал связи" value="Электронная почта и мессенджер" />
          </CardContent>
        </SurfaceCard>
      </section>

      <section data-testid="section-dealer-competitors">
        <SectionTitle subtitle="Обзор конкурентной среды в точке.">Конкуренты</SectionTitle>
        <SurfaceCard className="mt-3">
          <CardContent className="space-y-1 pt-5">
            <FieldRow label="Конкуренты в торговой точке" value="Конкурент A, Конкурент B, Конкурент C" />
            <FieldRow label="Сильные позиции конкурентов" value="Цена на ВХ, быстрые поставки" />
            <FieldRow label="Комментарий менеджера" value="Держим позицию по МК, усиливаем ВХ" />
            <FieldRow label="Комментарий регионального менеджера" value="Запланирован визит для фото витрины" />
          </CardContent>
        </SurfaceCard>
      </section>

      <section data-testid="section-dealer-problems">
        <SectionTitle subtitle="Текущие вопросы по точке.">Проблемы и комментарии</SectionTitle>
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
                <p className="mt-1 text-sm font-medium text-foreground">Региональный менеджер</p>
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
    </div>
  );
}

export default function DealerCardFoundation() {
  return <DealerCardFoundationContent />;
}
