import { useState, type ReactNode } from "react";
import { Building2, ChevronDown, ChevronUp, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { cn } from "@/lib/utils";

function StaticField({
  label,
  value,
  testId,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  testId?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1 rounded-lg border border-border/70 bg-muted/20 p-3", className)} data-testid={testId}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
        <p className={cn("break-words text-sm font-medium leading-snug text-foreground")}>{value}</p>
      </div>
    </div>
  );
}

type Props = {
  row: DealerRow;
  categoryLabel: string;
};

export function DealerStaticProfileSection({ row, categoryLabel }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const address = row.releaseAddress?.trim() || "—";
  const statusLabel = row.status.slice(0, 1).toUpperCase() + row.status.slice(1);

  const extra: ReactNode = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StaticField label="Код" value={row.releaseCode ?? "—"} />
      <StaticField label="Внутренний id" value={row.id} />
      {row.clientTypeLabel ? <StaticField label="Тип в данных" value={row.clientTypeLabel} /> : null}
      <StaticField label="Холдинг / сеть" value={row.holding} />
      <StaticField label="Юрлицо / наименование" value={row.legalEntity} />
      <StaticField label="Формат" value={row.format} />
      <StaticField label="Торговых точек" value={String(row.outlets)} />
      <StaticField label="Руководитель" value={row.responsibles.director} />
      <StaticField label="Ассистент" value={row.responsibles.assistant} />
      <StaticField label="Тандор клуб" value={row.terms.tandoorClub} />
      <StaticField label="Спец. условия" value={row.terms.special} />
      <StaticField label="Тип оплаты" value={row.terms.payment} />
      <StaticField label="ЭДО" value={row.terms.edo} />
      <StaticField label="Лимит / условия" value={row.terms.limit} />
      <StaticField label="Бонусы" value={row.terms.bonuses} />
    </div>
  );

  return (
    <section
      id="dealer-section-static-profile"
      data-testid="section-dealer-static-profile"
      className="scroll-mt-28 space-y-3 sm:scroll-mt-32"
    >
      <div className="flex items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Паспорт клиента</h2>
          <p className="text-sm text-muted-foreground">Справочные реквизиты и контакты — реже меняются в ежедневной работе.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 shrink-0 font-semibold sm:hidden"
          data-testid="button-dealer-static-profile-toggle"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? (
            <>
              Свернуть
              <ChevronUp className="ml-1 h-4 w-4" aria-hidden />
            </>
          ) : (
            <>
              Паспорт
              <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
      </div>

      <div className={cn("sm:block", mobileOpen ? "max-sm:block" : "max-sm:hidden")}>
        <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
          <CardHeader className="hidden pb-0 pt-5 sm:block">
            <CardDescription>Статичные данные</CardDescription>
            <CardTitle className="text-base">Реквизиты и контакты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-4 sm:p-6 sm:pt-2">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <StaticField label="Адрес" value={address} icon={MapPin} testId="text-dealer-static-profile-address" />
              <StaticField label="Город" value={row.city} />
              <StaticField label="Категория" value={categoryLabel} />
              <StaticField label="Статус" value={statusLabel} />
              <StaticField label="Менеджер" value={row.manager} testId="text-dealer-static-profile-manager" />
              <StaticField label="РОП" value={row.regionalManager} testId="text-dealer-static-profile-rop" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <StaticField label="ЛПР" value={row.contacts.lpr} icon={Building2} />
              <StaticField label="Собственник / закупщик" value={row.contacts.buyer} />
              <StaticField label="Телефон" value={row.contacts.phone} icon={Phone} />
              <StaticField label="Email" value={row.contacts.email} />
              <StaticField
                label="Предпочтительный канал"
                value={row.contacts.channel}
                className="sm:col-span-2"
              />
            </div>
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Дополнительно</p>
              {extra}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
