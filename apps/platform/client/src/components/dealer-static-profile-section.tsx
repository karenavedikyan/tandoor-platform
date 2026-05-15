import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, ChevronDown, ChevronUp, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  DEALER_LEGAL_ENTITIES_EVENT,
  getMergedDealerLegalEntities,
} from "@/lib/dealer-legal-entities";
import { getDealerEquipmentSignal, type DealerEquipmentStatus } from "@/lib/dealer-equipment-signals";
import { cn } from "@/lib/utils";

function isFilled(v: string | undefined | null): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t !== "—" && t !== "-";
}

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
  if (!isFilled(value)) return null;
  return (
    <div className={cn("min-w-0 space-y-1 rounded-md border border-border/60 bg-muted/15 p-2.5", className)} data-testid={testId}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        {Icon ? <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
        <p className="break-words text-sm font-medium leading-snug text-foreground">{value}</p>
      </div>
    </div>
  );
}

type Props = {
  row: DealerRow;
  categoryLabel: string;
};

function equipmentStatusBadgeClass(s: DealerEquipmentStatus): string {
  if (s === "ok") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  if (s === "needs_check") return "border-amber-300 bg-amber-50 text-amber-950";
  if (s === "outdated") return "border-rose-300 bg-rose-50 text-rose-950";
  return "border-slate-300 bg-slate-50 text-slate-900";
}

export function DealerStaticProfileSection({ row, categoryLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [legalTick, setLegalTick] = useState(0);

  useEffect(() => {
    const fn = () => setLegalTick((n) => n + 1);
    window.addEventListener(DEALER_LEGAL_ENTITIES_EVENT, fn);
    return () => window.removeEventListener(DEALER_LEGAL_ENTITIES_EVENT, fn);
  }, []);

  const mergedLegal = useMemo(() => getMergedDealerLegalEntities(row), [row, legalTick]);
  const legalEntitiesCount = mergedLegal.length;
  const equipmentSignal = useMemo(() => getDealerEquipmentSignal(row), [row]);

  const address = row.releaseAddress?.trim() || "";
  const statusLabel = row.status.slice(0, 1).toUpperCase() + row.status.slice(1);

  const extraFields = useMemo(
    () =>
      [
        { label: "Код", value: row.releaseCode ?? "" },
        { label: "Внутренний id", value: row.id },
        { label: "Тип в данных", value: row.clientTypeLabel ?? "" },
        { label: "Формат", value: row.format },
        { label: "Торговых точек", value: String(row.outlets) },
        { label: "Руководитель", value: row.responsibles.director },
        { label: "Ассистент", value: row.responsibles.assistant },
        { label: "Тандор клуб", value: row.terms.tandoorClub },
        { label: "Спец. условия", value: row.terms.special },
        { label: "Тип оплаты", value: row.terms.payment },
        { label: "ЭДО", value: row.terms.edo },
        { label: "Лимит / условия", value: row.terms.limit },
        { label: "Бонусы", value: row.terms.bonuses },
      ].filter((f) => isFilled(f.value)),
    [row],
  );

  const mainGrid = (
    <>
      <StaticField label="Адрес" value={address} icon={MapPin} testId="text-dealer-static-profile-address" />
      <StaticField label="Город" value={row.city} />
      <StaticField label="Категория" value={categoryLabel} />
      <StaticField label="Статус" value={statusLabel} />
      <StaticField label="Менеджер" value={row.manager} testId="text-dealer-static-profile-manager" />
      <StaticField label="РОП" value={row.regionalManager} testId="text-dealer-static-profile-rop" />
    </>
  );

  const contactGrid = (
    <>
      <StaticField label="ЛПР" value={row.contacts.lpr} icon={Building2} />
      <StaticField label="Собственник / закупщик" value={row.contacts.buyer} />
      <StaticField label="Телефон" value={row.contacts.phone} icon={Phone} />
      <StaticField label="Email" value={row.contacts.email} />
      <StaticField label="Предпочтительный канал" value={row.contacts.channel} className="sm:col-span-2" />
    </>
  );

  const hasMain = address || isFilled(row.city) || isFilled(categoryLabel) || isFilled(row.manager) || isFilled(row.regionalManager);
  const hasContacts =
    isFilled(row.contacts.lpr) ||
    isFilled(row.contacts.buyer) ||
    isFilled(row.contacts.phone) ||
    isFilled(row.contacts.email) ||
    isFilled(row.contacts.channel);

  const collapsedSummary = (
    <p className="text-sm leading-snug text-muted-foreground">
      <span className="font-medium text-foreground">Паспорт клиента:</span> адрес, контакты, реквизиты.{" "}
      <span data-testid="text-dealer-static-profile-address" className="text-foreground">
        {isFilled(address) ? address : "—"}
      </span>
      {" · "}
      <span data-testid="text-dealer-static-profile-manager" className="text-foreground">
        {isFilled(row.manager) ? row.manager : "—"}
      </span>
      {" · "}
      <span data-testid="text-dealer-static-profile-rop" className="text-foreground">
        {isFilled(row.regionalManager) ? row.regionalManager : "—"}
      </span>
      <span className="mt-1 block w-full min-w-0 sm:mt-0 sm:inline">
        {" "}
        <span className="text-muted-foreground">Юрлица:</span>{" "}
        <span data-testid="text-dealer-static-profile-legal-entities-count" className="tabular-nums text-foreground">
          {legalEntitiesCount}
        </span>
      </span>
      <span className="mt-1 block w-full min-w-0 sm:mt-0 sm:inline">
        {" "}
        <span className="text-muted-foreground">Оборудование:</span>{" "}
        <span data-testid="text-dealer-static-profile-equipment" className="break-words text-foreground">
          {equipmentSignal.summary}
        </span>
      </span>
    </p>
  );

  return (
    <section
      id="dealer-section-static-profile"
      data-testid="section-dealer-static-profile"
      className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Паспорт клиента</h2>
          {!open ? collapsedSummary : <p className="text-sm text-muted-foreground">Справочные реквизиты и контакты.</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9 shrink-0 px-3 text-xs font-semibold sm:text-sm"
          data-testid="button-dealer-static-profile-toggle"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <>
              Свернуть
              <ChevronUp className="ml-1 h-4 w-4" aria-hidden />
            </>
          ) : (
            <>
              Раскрыть
              <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
      </div>

      {open ? (
        <Card className="rounded-xl border border-border/70 bg-card shadow-xs">
          <CardHeader className="hidden pb-0 pt-4 sm:block">
            <CardDescription className="text-xs">Реквизиты и контакты</CardDescription>
            <CardTitle className="text-sm">Детали</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-3 sm:p-4">
            {hasMain ? (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{mainGrid}</div>
            ) : null}
            {hasContacts ? <div className="grid gap-2 sm:grid-cols-2">{contactGrid}</div> : null}
            {extraFields.length > 0 ? (
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Дополнительно</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {extraFields.map((f) => (
                    <StaticField key={f.label} label={f.label} value={f.value} />
                  ))}
                </div>
              </div>
            ) : null}
            <div className="border-t border-border pt-3" data-testid="section-dealer-static-profile-equipment">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Оборудование</p>
              {equipmentSignal.items.length === 0 ? (
                <p className="text-xs leading-snug text-muted-foreground">{equipmentSignal.summary}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium leading-snug text-foreground">{equipmentSignal.summary}</p>
                  <Badge variant="outline" className={cn("text-[10px] font-semibold", equipmentStatusBadgeClass(equipmentSignal.status))} data-testid="text-dealer-static-equipment-status">
                    {equipmentSignal.statusLabel}
                  </Badge>
                  {equipmentSignal.lastCheckDate ? (
                    <p className="text-[11px] text-muted-foreground" data-testid="text-dealer-static-equipment-last-check">
                      Последняя отметка в данных: {equipmentSignal.lastCheckDate}
                    </p>
                  ) : null}
                  {equipmentSignal.reason ? <p className="text-[11px] leading-snug text-muted-foreground">{equipmentSignal.reason}</p> : null}
                  <ul className="space-y-1.5">
                    {equipmentSignal.items.map((it) => (
                      <li
                        key={it.id}
                        data-testid={`row-dealer-static-equipment-${it.id}`}
                        className="rounded-md border border-border/60 bg-muted/10 px-2 py-1.5 text-xs"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-1">
                          <span className="font-medium text-foreground">{it.label}</span>
                          {typeof it.count === "number" ? (
                            <span className="tabular-nums text-muted-foreground">×{it.count}</span>
                          ) : null}
                        </div>
                        {it.comment ? <p className="mt-0.5 break-words text-[11px] text-muted-foreground">{it.comment}</p> : null}
                        {it.status && it.status !== "ok" ? (
                          <Badge variant="outline" className={cn("mt-1 text-[10px]", equipmentStatusBadgeClass(it.status))}>
                            {it.status === "needs_check"
                              ? "Проверка"
                              : it.status === "outdated"
                                ? "Устарело"
                                : "Нет данных"}
                          </Badge>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
