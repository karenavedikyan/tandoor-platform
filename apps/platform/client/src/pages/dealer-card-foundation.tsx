import type { ComponentProps, ComponentType, ReactNode } from "react";
import { Link, useParams } from "wouter";
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
import { getDealerById, type DealerRow, type DealerCategory, type DealerStatus } from "@/lib/dealer-base-mock-data";

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

function statusBadgeClass(status: DealerStatus) {
  if (status === "требует внимания") return "border-amber-300 bg-amber-50 text-amber-950";
  if (status === "потенциальный") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "приостановлен") return "border-neutral-200 bg-muted text-muted-foreground";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function categoryBadgeClass(cat: DealerCategory) {
  if (cat === "TOP") return "border-primary/40 bg-primary/15 text-foreground font-semibold";
  return "border-border bg-muted/60 text-foreground";
}

function DealerNotFound() {
  return (
    <div className="mx-auto max-w-md space-y-6 py-8" data-testid="page-dealer-not-found">
      <Card className="rounded-2xl border border-border bg-card shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Дилер не найден</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Проверьте номер клиента или вернитесь к клиентской базе.</p>
          <Button asChild className="w-full min-h-11 font-semibold" data-testid="button-back-to-dealer-base">
            <Link href="/dealer-base">К клиентской базе</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DealerCardContent({ row }: { row: DealerRow }) {
  const d = row.distributionDetail;
  const catLabel = row.category === "TOP" ? "TOP / ключевой клиент" : row.category;

  return (
    <div className="space-y-6 sm:space-y-8" data-testid="page-dealer-card-foundation">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Button asChild variant="outline" className="min-h-11 w-full shrink-0 border-border bg-card sm:w-auto" data-testid="button-back-to-dealer-base">
          <Link href="/dealer-base">К клиентской базе</Link>
        </Button>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative pl-3 sm:pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusBadgeClass(row.status))}>
              {row.status}
            </Badge>
            <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", categoryBadgeClass(row.category))}>
              {row.category}
            </Badge>
            <Badge variant="outline" className="rounded-full border-border bg-muted/50 px-2.5 py-0.5 font-medium text-muted-foreground">
              Активность: {row.lastActivity}
            </Badge>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{row.name}</h1>
          <p className="mt-1 text-base font-medium text-muted-foreground sm:text-lg">
            № {row.id} · {row.city}, {row.region}
          </p>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">Сводная информация по клиенту и торговым точкам</p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <section className="lg:col-span-5" data-testid="section-dealer-summary">
          <SectionTitle subtitle="Ключевые реквизиты и классификация.">Сводка дилера</SectionTitle>
          <SurfaceCard className="mt-3">
            <CardContent className="pt-5">
              <FieldRow label="№" value={row.id} />
              <FieldRow label="Название клиента" value={row.name} icon={Building2} />
              <FieldRow label="Категория клиента" value={catLabel} />
              <FieldRow label="Статус" value={row.status.slice(0, 1).toUpperCase() + row.status.slice(1)} />
              <FieldRow label="Холдинг / сеть" value={row.holding} />
              <FieldRow label="Юрлицо" value={row.legalEntity} />
              <FieldRow label="Регион / город" value={`${row.city}, ${row.region}`} icon={MapPin} />
              <FieldRow label="Формат" value={row.format} />
              <FieldRow label="Торговых точек" value={String(row.outlets)} />
            </CardContent>
          </SurfaceCard>
        </section>

        <section className="lg:col-span-7" data-testid="section-dealer-responsibles">
          <SectionTitle subtitle="Кто ведёт клиента и к кому обращаться.">Ответственные</SectionTitle>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { role: "Руководитель", name: row.responsibles.director, zone: "Стратегия и контроль команды" },
              { role: "Менеджер продаж", name: row.responsibles.salesManager, zone: "Сопровождение договорённостей и заказов" },
              { role: "Региональный менеджер", name: row.responsibles.regionalManager, zone: "Визиты, витрины, отчёты по региону" },
              { role: "Ассистент", name: row.responsibles.assistant, zone: "Подготовка материалов и координация" },
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
          <SectionTitle subtitle="Торговые точки клиента.">Торговые точки</SectionTitle>
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
        <div className="space-y-4">
          {row.tradePoints.map((tp, idx) => (
            <SurfaceCard key={`${row.id}-tp-${idx}`}>
              <CardHeader className="flex flex-row items-center gap-2 pb-0 pt-5">
                <Store className="h-5 w-5 text-primary" aria-hidden />
                <CardTitle className="text-base font-semibold">{tp.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-2">
                <FieldRow label="Адрес" value={tp.address} icon={MapPin} />
                <FieldRow label="Формат точки" value={tp.format} />
                <FieldRow label="Оборудование" value={tp.equipment} />
                <FieldRow label="Работа в склад фурнитура/двери" value={tp.warehouseNote} />
                <FieldRow label="Дата последнего обновления" value={tp.updatedAt} />
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
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section data-testid="section-dealer-terms">
          <SectionTitle subtitle="Условия сотрудничества.">Условия работы</SectionTitle>
          <SurfaceCard className="mt-3">
            <CardContent className="pt-5">
              <FieldRow label="Тандор клуб" value={row.terms.tandoorClub} icon={Handshake} />
              <FieldRow label="Спец. условия" value={row.terms.special} />
              <FieldRow label="Тип оплаты" value={row.terms.payment} />
              <FieldRow label="ЭДО" value={row.terms.edo} />
              <FieldRow label="Лимит / индивидуальные условия" value={row.terms.limit} />
              <FieldRow label="Бонусы / мотивация продавцов" value={row.terms.bonuses} />
            </CardContent>
          </SurfaceCard>
        </section>

        <section data-testid="section-dealer-sales">
          <SectionTitle subtitle="Средние показатели за квартал.">Продажи</SectionTitle>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-2">
            <KpiTile label="За квартал" value={row.salesKpis.quarterRub} />
            <KpiTile label="МК, шт." value={row.salesKpis.mkUnits} />
            <KpiTile label="ВХ, шт." value={row.salesKpis.vhUnits} />
            <KpiTile label="Фурнитура" value={row.salesKpis.furnitureRub} />
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            Последняя активность: {row.lastActivity}
          </p>
        </section>
      </div>

      <section data-testid="section-dealer-distribution">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle subtitle={`По данным последней проверки, ${row.distributionDetail.checkDate}.`}>Дистрибуция</SectionTitle>
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
            { label: "МК", pct: row.distributionDetail.mk },
            { label: "ВХ", pct: row.distributionDetail.vh },
            { label: "Общая дистрибуция", pct: row.distributionDetail.total },
          ].map((dist) => (
            <SurfaceCard key={dist.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" aria-hidden />
                  <CardTitle className="text-sm font-semibold">{dist.label}</CardTitle>
                </div>
                <span className="text-lg font-bold tabular-nums text-foreground">{dist.pct}%</span>
              </CardHeader>
              <CardContent className="pb-5">
                <Progress value={dist.pct} className="h-2.5 bg-muted" />
              </CardContent>
            </SurfaceCard>
          ))}
        </div>
      </section>

      <section data-testid="section-dealer-showcases">
        <SectionTitle subtitle="Витрина и оборудование.">Витрины и оборудование</SectionTitle>
        <SurfaceCard className="mt-3">
          <CardContent className="space-y-1 pt-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <LayoutGrid className="h-4 w-4 text-primary" aria-hidden />
              Состояние витрины и оборудования
            </div>
            <FieldRow label="Установленное оборудование" value={row.showcase.equipment} />
            <FieldRow label="Что нужно добавить" value={row.showcase.todo} />
            <FieldRow label="Статус витрины" value={row.showcase.status} />
            <FieldRow label="Связь с целями отдела продаж" value={row.showcase.goalLink} />
            <FieldRow label="Сводный показатель" value={`${row.distribution}% (обзор)`} />
          </CardContent>
        </SurfaceCard>
      </section>

      <section data-testid="section-dealer-contacts">
        <SectionTitle subtitle="ЛПР и каналы связи.">Контакты и ЛПР</SectionTitle>
        <SurfaceCard className="mt-3">
          <CardContent className="space-y-1 pt-5">
            <FieldRow label="ЛПР" value={row.contacts.lpr} />
            <FieldRow label="Собственник / закупщик" value={row.contacts.buyer} />
            <FieldRow label="Телефон" value={row.contacts.phone} icon={Phone} />
            <FieldRow label="Email" value={row.contacts.email} />
            <FieldRow label="Предпочтительный канал связи" value={row.contacts.channel} />
          </CardContent>
        </SurfaceCard>
      </section>

      <section data-testid="section-dealer-competitors">
        <SectionTitle subtitle="Обзор конкурентной среды.">Конкуренты</SectionTitle>
        <SurfaceCard className="mt-3">
          <CardContent className="space-y-1 pt-5">
            <FieldRow label="Конкуренты в торговой точке" value={row.competitors.list} />
            <FieldRow label="Сильные позиции конкурентов" value={row.competitors.strengths} />
            <FieldRow label="Комментарий менеджера" value={row.competitors.mgrComment} />
            <FieldRow label="Комментарий регионального менеджера" value={row.competitors.rmComment} />
          </CardContent>
        </SurfaceCard>
      </section>

      <section data-testid="section-dealer-problems">
        <SectionTitle subtitle="Текущие вопросы по клиенту.">Проблемы и комментарии</SectionTitle>
        <SurfaceCard
          className={cn(
            "mt-3 border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-card",
            !row.hasProblem && "border-border from-muted/30",
          )}
        >
          <CardContent className="space-y-4 pt-5">
            {row.hasProblem ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-amber-300/80 bg-amber-100/60 font-medium text-amber-950">
                  <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
                  Требует внимания
                </Badge>
              </div>
            ) : (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 font-medium text-emerald-900">
                Без критичных замечаний
              </Badge>
            )}
            <p className={cn("text-sm font-semibold leading-relaxed sm:text-base", row.hasProblem ? "text-red-700" : "text-foreground")}>
              {row.issues.summary}
            </p>
            <div className="grid gap-4 rounded-xl bg-card/80 p-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Кто зафиксировал</p>
                <p className="mt-1 text-sm font-medium text-foreground">{row.issues.who}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Дата</p>
                <p className="mt-1 text-sm font-medium text-foreground">{row.issues.date}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Следующий шаг</p>
                <p className="mt-1 text-sm font-medium text-foreground">{row.nextAction}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Статус</p>
                <p className="mt-1 text-sm font-medium text-foreground">{row.issues.state}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Комментарий: {row.comment}</p>
          </CardContent>
        </SurfaceCard>
      </section>
    </div>
  );
}

export function DealerCardPage() {
  const params = useParams<{ id: string }>();
  const rawId = params.id ?? "";
  const row = getDealerById(rawId);
  if (!row) {
    return <DealerNotFound />;
  }
  return <DealerCardContent row={row} />;
}

/** Маршрут `/dealer-card-foundation` — карточка клиента №001. */
export default function DealerCardFoundation() {
  const row = getDealerById("001");
  if (!row) return <DealerNotFound />;
  return <DealerCardContent row={row} />;
}
