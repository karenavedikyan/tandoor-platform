"use client";

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Building2, Mail, MessageCircle, Phone, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { mergeTradePointsForActualization } from "@/lib/client-base-actualization-data-merge";
import {
  countShowcaseMatrixDeficitForDealer,
  deriveShowcaseBucket,
} from "@/lib/trade-point-list-for-actualization";
import { computePortalSummary } from "@/lib/client-base-actualization-portal-math";
import {
  getManualDealerDisplayCode,
  getTradePointDisplayCodeForActualization,
} from "@/lib/client-base-actualization-stable-ids";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { getDealerStockSignal } from "@/lib/dealer-stock-signals";
import { getDealerProgramSignal } from "@/lib/dealer-program-signals";
import { DEALER_PROGRAM_FILTER_BADGE_TESTID } from "@/lib/dealer-program-signals";
import { getClientCategoryBadgeClass, getClientCategoryLabel } from "@/lib/client-category";
import { parseDealerGeoFromRow } from "@/lib/dealer-base-geo-parse";
import { buildHashPath } from "@/lib/hash-route-utils";
import type { DealerWorkPlanState } from "@/lib/dealer-work-plan";
import { isDealerHiddenForUser } from "@/lib/dealer-work-plan";
import type { DealerShipmentDayId } from "@/lib/dealer-shipment-days";
import { getDealerShipmentStatus } from "@/lib/dealer-shipment-days";
import { Checkbox } from "@/components/ui/checkbox";
import { DealerBulkDeleteCheckbox } from "@/components/dealer-bulk-delete-checkbox";

type ArchiveBulk = {
  selectedIds: Set<string>;
  selectableIds: Set<string>;
  onToggle: (dealerId: string, checked: boolean) => void;
};

export type DealerShowcaseGridProps = {
  rows: DealerRow[];
  empty: string;
  actualizationState: ActualizationState;
  workPlanUserId?: string;
  workPlanState?: DealerWorkPlanState;
  showWorkPlanSelect?: boolean;
  selectedIds?: Set<string>;
  onToggleWorkPlanSelect?: (dealerId: string, checked: boolean) => void;
  shipmentActiveDayId?: DealerShipmentDayId | null;
  shipmentUserId?: string;
  archiveBulk?: ArchiveBulk;
};

function cleanContact(s: string | undefined | null): string | null {
  const t = (s ?? "").trim();
  if (!t || t === "—" || t === "-") return null;
  return t;
}

function hrefTel(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("+")) return `tel:${t.replace(/\s/g, "")}`;
  const d = t.replace(/\D/g, "");
  if (d.length < 10) return null;
  return `tel:+${d}`;
}

function hrefWhatsApp(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return null;
  let n = d;
  if (n.length === 11 && n.startsWith("8")) n = `7${n.slice(1)}`;
  if (n.length === 10) n = `7${n}`;
  return `https://wa.me/${n}`;
}

function hrefMailto(raw: string): string | null {
  const t = raw.trim();
  if (!t || !t.includes("@")) return null;
  return `mailto:${t}`;
}

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function dealerClientCode(row: DealerRow, act: ActualizationState): string {
  const rel = row.releaseCode?.trim();
  if (rel) return rel;
  const m = act.manuallyCreatedDealersById[row.id];
  if (m) return getManualDealerDisplayCode(m);
  return "—";
}

function tradePointShowcaseLine(dealer: DealerRow, act: ActualizationState, tpId: string): string {
  const sh = act.tradePointShowcaseActualizationById[tpId];
  const deficit = countShowcaseMatrixDeficitForDealer(dealer, act, sh);
  if (deficit > 0) return "Есть дефицит";
  return deriveShowcaseBucket(sh).label;
}

function dealerShowcaseStatusLabel(status: DealerRow["status"]): string {
  switch (status) {
    case "активный":
      return "Активный";
    case "потенциальный":
      return "Потенциальный";
    case "приостановлен":
      return "Приостановлен";
    case "требует внимания":
      return "Требует внимания";
    default:
      return status;
  }
}

function statusBadgeClass(status: DealerRow["status"]): string {
  if (status === "требует внимания") return "border-amber-300 bg-amber-50 text-amber-950";
  if (status === "потенциальный") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "приостановлен") return "border-neutral-200 bg-muted text-muted-foreground";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function tradePointPortalCaptions(act: ActualizationState, tpId: string): { portals: string | null; tandoor: string | null } {
  const sh = act.tradePointShowcaseActualizationById[tpId];
  if (!sh || sh.hasShowcase === false) return { portals: null, tandoor: null };
  const total = sh.totalPortals ?? sh.tandoorTotalPortals;
  const t = sh.tandoorTotalPortals;
  const portals = total != null && Number.isFinite(total) ? `Порталы: ${total}` : null;
  const tandoor = t != null && Number.isFinite(t) ? `Tandoor: ${t}` : null;
  return { portals, tandoor };
}

const BRANCH_CONTACT_SHORT: Record<string, string> = {
  Позвонить: "Звонок",
  WhatsApp: "WA",
  Email: "Почта",
};

function ContactAction({
  label,
  icon: Icon,
  href,
  disabledReason,
  testId,
  variant = "dealer",
}: {
  label: string;
  icon: typeof Phone;
  href: string | null;
  disabledReason: string;
  testId: string;
  /** Вложенные действия ТТ: компактнее, на узком экране короткая подпись у иконки. */
  variant?: "dealer" | "branch";
}) {
  const isBranch = variant === "branch";
  const short = BRANCH_CONTACT_SHORT[label] ?? label.slice(0, 4);
  const btnClass = cn(
    "h-8 gap-1 text-xs font-medium",
    isBranch
      ? "rounded-md border-slate-200/90 bg-white/90 px-2 text-slate-800 hover:bg-white hover:text-slate-900"
      : "rounded-full border-emerald-200/80 px-2.5 text-emerald-950 hover:bg-emerald-50",
  );
  const labelNode = isBranch ? (
    <>
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{short}</span>
    </>
  ) : (
    label
  );
  if (href) {
    return (
      <Button asChild size="sm" variant="outline" className={btnClass}>
        <a href={href} data-testid={testId} className="inline-flex min-h-8 min-w-0 items-center gap-1">
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {labelNode}
        </a>
      </Button>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block max-w-full">
          <Button type="button" size="sm" variant="outline" disabled className={cn(btnClass, "opacity-80")}>
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
            {labelNode}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{disabledReason}</TooltipContent>
    </Tooltip>
  );
}

function tradePointBranchAccentClass(line: string, deficit: number, newTasks: number): string {
  if (deficit > 0 || newTasks > 0) return "border-l-amber-500";
  if (line === "Есть витрина") return "border-l-emerald-500";
  return "border-l-slate-300";
}

function TradePointShowcaseRow({
  dealer,
  tp,
  act,
  shipmentActiveDayId,
  shipmentUserId,
  workPlanState,
}: {
  dealer: DealerRow;
  tp: DealerTradePoint;
  act: ActualizationState;
  shipmentActiveDayId?: DealerShipmentDayId | null;
  shipmentUserId?: string;
  workPlanState?: DealerWorkPlanState;
}) {
  const sh = act.tradePointShowcaseActualizationById[tp.id];
  const summary = computePortalSummary(sh);
  const deficit = countShowcaseMatrixDeficitForDealer(dealer, act, sh);
  const newTasks = (sh?.showcaseMatrixTasks ?? []).filter((t) => t.status === "new").length;
  const line = tradePointShowcaseLine(dealer, act, tp.id);
  const { portals, tandoor } = tradePointPortalCaptions(act, tp.id);
  const phone = cleanContact(tp.contactPhone);
  const tpEmail = cleanContact(tp.contactEmail);
  const tpHref = buildHashPath(`/dealers/${dealer.id}/trade-points/${tp.id}`, { tradePointShowcase: "1" });
  const tel = phone ? hrefTel(phone) : null;
  const wa = phone ? hrefWhatsApp(phone) : null;
  const tpMail = tpEmail ? hrefMailto(tpEmail) : null;

  const accentBorder = tradePointBranchAccentClass(line, deficit, newTasks);

  const statusClass =
    deficit > 0 || newTasks > 0
      ? "border-amber-300 bg-amber-50 text-amber-950"
      : line.includes("Нет витрины")
        ? "border-neutral-200 bg-muted text-muted-foreground"
        : line.includes("Есть витрина")
          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
          : "border-sky-200 bg-sky-50 text-sky-950";

  const ship =
    shipmentActiveDayId && shipmentUserId && workPlanState
      ? getDealerShipmentStatus(dealer, shipmentActiveDayId, shipmentUserId, workPlanState)
      : null;

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-md border border-slate-200/80 bg-background/90 py-2 pl-2 pr-2 shadow-none sm:py-2.5 sm:pr-2.5",
        "border-l-4",
        accentBorder,
      )}
      data-testid={`card-dealer-showcase-trade-point-${tp.id}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <div className="flex min-w-0 items-start gap-1.5">
              <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
              <div className="min-w-0">
                <span className="text-sm font-semibold leading-snug text-foreground">{tp.name}</span>
                <p className="font-mono text-[10px] leading-tight text-muted-foreground">{getTradePointDisplayCodeForActualization(tp)}</p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="h-7 shrink-0 rounded-md px-2.5 text-[11px] font-medium text-slate-700 sm:mt-0">
              <Link href={tpHref} data-testid={`button-dealer-showcase-open-trade-point-${tp.id}`}>
                Открыть ТТ
              </Link>
            </Button>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {tp.city}
            {tp.address ? ` · ${tp.address}` : ""}
          </p>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className={cn("text-[10px] font-medium", statusClass)}>
              {line}
            </Badge>
            {summary.hasExpansionPotentialComputed ? (
              <Badge variant="outline" className="border-amber-200 bg-amber-50/80 text-[10px] text-amber-950">
                Потенциал витрины
              </Badge>
            ) : null}
          </div>
          {(portals || tandoor) && (
            <p className="text-[10px] leading-tight text-muted-foreground">{[portals, tandoor].filter(Boolean).join(" · ")}</p>
          )}
          {ship ? <p className="text-[10px] text-muted-foreground">Отгрузка: {ship.label}</p> : null}
          {cleanContact(tp.contactName) ? <p className="text-[11px] text-muted-foreground">Контакт: {tp.contactName}</p> : null}
        </div>
      </div>
      <div className="mt-2 flex max-w-full flex-wrap gap-1.5 border-t border-slate-100/90 pt-2">
        <ContactAction
          variant="branch"
          label="Позвонить"
          icon={Phone}
          href={tel}
          disabledReason="Телефон не указан"
          testId={`link-dealer-showcase-trade-point-call-${tp.id}`}
        />
        <ContactAction
          variant="branch"
          label="WhatsApp"
          icon={MessageCircle}
          href={wa}
          disabledReason="Телефон не указан"
          testId={`link-dealer-showcase-trade-point-whatsapp-${tp.id}`}
        />
        <ContactAction
          variant="branch"
          label="Email"
          icon={Mail}
          href={tpMail}
          disabledReason="Email не указан"
          testId={`link-dealer-showcase-trade-point-email-${tp.id}`}
        />
      </div>
    </div>
  );
}

function DealerShowcaseCard({
  row,
  act,
  workPlanUserId,
  workPlanState,
  showWorkPlanSelect,
  selectedIds,
  onToggleWorkPlanSelect,
  shipmentActiveDayId,
  shipmentUserId,
  archiveBulk,
}: {
  row: DealerRow;
  act: ActualizationState;
  workPlanUserId?: string;
  workPlanState?: DealerWorkPlanState;
  showWorkPlanSelect?: boolean;
  selectedIds?: Set<string>;
  onToggleWorkPlanSelect?: (dealerId: string, checked: boolean) => void;
  shipmentActiveDayId?: DealerShipmentDayId | null;
  shipmentUserId?: string;
  archiveBulk?: ArchiveBulk;
}) {
  const wp = workPlanUserId && workPlanState;
  const hidden = wp ? isDealerHiddenForUser(workPlanUserId, row.id, workPlanState) : false;
  const checked = Boolean(selectedIds?.has(row.id));
  const merged = useMemo(() => mergeTradePointsForActualization(row, act).filter((e) => !e.isArchived), [row, act]);
  const cities = useMemo(() => {
    const s = new Set<string>();
    for (const e of merged) {
      const c = e.point.city?.trim();
      if (c) s.add(c);
    }
    return Array.from(s);
  }, [merged]);
  const cityLine =
    cities.length > 1 ? `${cities.length} городов` : cities.length === 1 ? cities[0]! : cleanContact(row.city) ?? "—";
  const geo = parseDealerGeoFromRow(row);
  const regionLine = [geo.region || row.region?.trim(), cityLine !== "—" && cities.length <= 1 ? cityLine : null]
    .filter(Boolean)
    .join(" · ");

  const stockSig = getDealerStockSignal(row);
  const programSig = getDealerProgramSignal(row);
  const code = dealerClientCode(row, act);
  const inn = cleanContact(row.actualizationInn);
  const phone = cleanContact(row.contacts?.phone);
  const email = cleanContact(row.contacts?.email);
  const contactName = cleanContact(row.contacts?.lpr);
  const tel = phone ? hrefTel(phone) : null;
  const wa = phone ? hrefWhatsApp(phone) : null;
  const mail = email ? hrefMailto(email) : null;

  const tpCount = merged.length;
  const [expanded, setExpanded] = useState(false);
  const initialTpCap = typeof window !== "undefined" && window.innerWidth >= 768 ? 3 : 2;
  const visibleTp = expanded ? merged : merged.slice(0, initialTpCap);
  const restCount = merged.length - visibleTp.length;

  return (
    <Card
      className="overflow-hidden rounded-xl border border-border/70 border-l-4 border-l-emerald-600 bg-card shadow-sm ring-1 ring-slate-900/[0.03]"
      data-testid={`card-dealer-showcase-${row.id}`}
    >
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            {showWorkPlanSelect && wp && onToggleWorkPlanSelect ? (
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => onToggleWorkPlanSelect(row.id, v === true)}
                className="mt-1 h-4 w-4 shrink-0"
                data-testid={`checkbox-dealer-workplan-select-${row.id}`}
                aria-label={`Выбрать клиента ${row.name} для плана работ`}
              />
            ) : null}
            {archiveBulk?.selectableIds.has(row.id) ? (
              <span
                className={cn(
                  "mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-destructive/45 bg-destructive/[0.06] px-2 py-1",
                  showWorkPlanSelect && wp && onToggleWorkPlanSelect && "border-l-2 border-l-destructive/50 pl-2",
                )}
                data-testid={`wrap-dealer-bulk-select-${row.id}`}
              >
                <span className="text-[9px] font-bold uppercase text-destructive">Удалить</span>
                <DealerBulkDeleteCheckbox
                  checked={archiveBulk.selectedIds.has(row.id)}
                  onCheckedChange={(v) => archiveBulk.onToggle(row.id, v === true)}
                  data-testid={`checkbox-dealer-select-${row.id}`}
                  aria-label={`Удалить клиента ${row.name} из рабочей базы`}
                />
              </span>
            ) : null}
            {(() => {
              const logo = (row as DealerRow & { logoUrl?: string }).logoUrl?.trim();
              if (logo) {
                return (
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-emerald-700/15">
                    <img src={logo} alt="" className="h-full w-full object-contain" loading="lazy" />
                  </div>
                );
              }
              return (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-base font-bold text-emerald-800 ring-1 ring-emerald-700/15">
                  {initialsFromName(row.name)}
                </div>
              );
            })()}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-base font-semibold leading-tight text-foreground sm:text-lg">{row.name}</h3>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50/80 text-[10px] font-semibold text-emerald-900">
                  Дилер
                </Badge>
                {tpCount > 1 ? (
                  <Badge variant="outline" className="text-[10px] font-medium">
                    Сеть
                  </Badge>
                ) : null}
                <Badge variant="outline" className="text-[10px] font-medium tabular-nums">
                  {tpCount === 1 ? "1 ТТ" : `${tpCount} ТТ`}
                </Badge>
                {cities.length > 1 ? (
                  <Badge variant="outline" className="text-[10px] font-medium tabular-nums">
                    {cities.length} городов
                  </Badge>
                ) : null}
              </div>
              <p className="font-mono text-xs text-muted-foreground">{code}</p>
              {inn ? <p className="text-xs text-muted-foreground">ИНН: {inn}</p> : null}
              <p className="text-xs text-muted-foreground">{regionLine || "—"}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className={cn("text-[10px]", getClientCategoryBadgeClass(row.clientCategory))}>
                  {getClientCategoryLabel(row.clientCategory)}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px]", statusBadgeClass(row.status))}>
                  {dealerShowcaseStatusLabel(row.status)}
                </Badge>
                {stockSig.hasMainWarehouse ? (
                  <Badge variant="outline" className="border-slate-300 bg-slate-50 text-[10px] text-slate-900" data-testid={`badge-dealer-main-warehouse-${row.id}`}>
                    Склад двери
                  </Badge>
                ) : null}
                {stockSig.hasHardwareWarehouse ? (
                  <Badge variant="outline" className="border-violet-300 bg-violet-50 text-[10px] text-violet-950" data-testid={`badge-dealer-hardware-warehouse-${row.id}`}>
                    Склад фурнитуры
                  </Badge>
                ) : null}
                {programSig.hasTandoorClub ? (
                  <Badge variant="outline" className="border-indigo-300 bg-indigo-50 text-[10px]" data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.tandoor_club}-${row.id}`}>
                    Tandoor Club
                  </Badge>
                ) : null}
                {programSig.hasCashbackAgent ? (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px]" data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.cashback_agent}-${row.id}`}>
                    Кэшбэк
                  </Badge>
                ) : null}
                {programSig.hasSpecialConditions ? (
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px]" data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.special_conditions}-${row.id}`}>
                    Спецусловия
                  </Badge>
                ) : null}
              </div>
              {hidden ? (
                <Badge variant="secondary" className="w-fit text-[10px]" data-testid={`badge-dealer-hidden-${row.id}`}>
                  Скрыт из рабочего списка
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[12rem]">
            <Button asChild size="sm" className="h-9 w-full rounded-full bg-emerald-600 font-semibold text-white hover:bg-emerald-700 sm:w-auto">
              <Link href={`/dealers/${row.id}`} data-testid={`button-dealer-showcase-open-${row.id}`}>
                Открыть клиента
              </Link>
            </Button>
            <div className="flex flex-wrap gap-1.5">
              <ContactAction label="Позвонить" icon={Phone} href={tel} disabledReason="Телефон не указан" testId={`link-dealer-showcase-call-${row.id}`} />
              <ContactAction label="Написать" icon={MessageCircle} href={wa} disabledReason="Телефон не указан" testId={`link-dealer-showcase-whatsapp-${row.id}`} />
              <ContactAction label="Email" icon={Mail} href={mail} disabledReason="Email не указан" testId={`link-dealer-showcase-email-${row.id}`} />
            </div>
          </div>
        </div>

        {(contactName || phone || email) && (
          <div className="rounded-lg border border-emerald-100/80 bg-emerald-50/25 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-emerald-800/70" aria-hidden />
              Основной контакт
            </div>
            {contactName ? <p className="mt-1 font-medium text-foreground">{contactName}</p> : null}
            {phone ? <p className="text-xs text-foreground">{phone}</p> : null}
            {email ? <p className="text-xs text-muted-foreground">{email}</p> : null}
          </div>
        )}

        {merged.length > 0 ? (
          <section
            className="rounded-lg border border-emerald-100/90 bg-emerald-50/35 p-2 sm:p-2.5"
            data-testid={`section-dealer-showcase-branches-${row.id}`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-950/90">Филиалы / торговые точки</h4>
              <Badge variant="secondary" className="h-5 border border-emerald-200/80 bg-white/90 px-2 text-[10px] font-semibold tabular-nums text-emerald-900">
                {merged.length}
              </Badge>
            </div>
            <div className="flex flex-col gap-1.5">
              {visibleTp.map((e) => (
                <TradePointShowcaseRow
                  key={e.point.id}
                  dealer={row}
                  tp={e.point}
                  act={act}
                  shipmentActiveDayId={shipmentActiveDayId}
                  shipmentUserId={shipmentUserId}
                  workPlanState={workPlanState}
                />
              ))}
            </div>
            {restCount > 0 && !expanded ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-8 w-full text-xs font-semibold text-emerald-900 hover:bg-white/60"
                onClick={() => setExpanded(true)}
              >
                Показать все точки ({merged.length})
              </Button>
            ) : null}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DealerBaseDealerShowcaseGrid(props: DealerShowcaseGridProps) {
  const {
    rows,
    empty,
    actualizationState,
    workPlanUserId,
    workPlanState,
    showWorkPlanSelect,
    selectedIds,
    onToggleWorkPlanSelect,
    shipmentActiveDayId,
    shipmentUserId,
    archiveBulk,
  } = props;

  if (rows.length === 0) {
    if (!empty.trim()) return null;
    return (
      <Card className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {empty}
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <DealerShowcaseCard
            key={row.id}
            row={row}
            act={actualizationState}
            workPlanUserId={workPlanUserId}
            workPlanState={workPlanState}
            showWorkPlanSelect={showWorkPlanSelect}
            selectedIds={selectedIds}
            onToggleWorkPlanSelect={onToggleWorkPlanSelect}
            shipmentActiveDayId={shipmentActiveDayId}
            shipmentUserId={shipmentUserId}
            archiveBulk={archiveBulk}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
