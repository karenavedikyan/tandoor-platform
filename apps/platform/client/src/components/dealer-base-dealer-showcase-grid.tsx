"use client";

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Building2, Mail, MessageCircle, Phone } from "lucide-react";
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
import { getClientCategoryLabel } from "@/lib/client-category";
import { parseDealerGeoFromRow } from "@/lib/dealer-base-geo-parse";
import { buildHashPath } from "@/lib/hash-route-utils";
import type { DealerWorkPlanState } from "@/lib/dealer-work-plan";
import { isDealerHiddenForUser } from "@/lib/dealer-work-plan";
import type { DealerShipmentDayId } from "@/lib/dealer-shipment-days";
import { getDealerShipmentStatus } from "@/lib/dealer-shipment-days";
import { Checkbox } from "@/components/ui/checkbox";
import { DealerBulkDeleteCheckbox } from "@/components/dealer-bulk-delete-checkbox";
import { SafeImage } from "@/components/safe-image";
import { TradePointRowListThumb } from "@/components/trade-point-row-list-thumb";

const badgeOutline = "border-[#9ACA3C]/35 bg-[#FFFFFF] text-[#222631]";
const badgeSoft = "border-[#9ACA3C]/30 bg-[#9ACA3C]/10 text-[#222631]";
const badgeNeutral = "border-[#E3E6F3] bg-[#FFFFFF] text-[#222631]";

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

/** Статусы дилера — только фирменная палитра, различие по тексту. */
function statusBadgeClass(_status: DealerRow["status"]): string {
  return cn("border-[#9ACA3C]/30 bg-[#FFFFFF] text-[#222631]");
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
    "h-8 gap-1 text-xs font-medium text-[#222631]",
    isBranch
      ? "rounded-md border border-[#9ACA3C]/35 bg-[#FFFFFF] px-2 hover:bg-[#9ACA3C]/10"
      : "rounded-full border border-[#9ACA3C]/35 bg-[#FFFFFF] px-2.5 hover:bg-[#9ACA3C]/10",
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
          <Icon className="h-3.5 w-3.5 shrink-0 text-[#9ACA3C]" aria-hidden />
          {labelNode}
        </a>
      </Button>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block max-w-full">
          <Button type="button" size="sm" variant="outline" disabled className={cn(btnClass, "opacity-70")}>
            <Icon className="h-3.5 w-3.5 shrink-0 text-[#8F96B0]" aria-hidden />
            {labelNode}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{disabledReason}</TooltipContent>
    </Tooltip>
  );
}

/** Левая полоса: фирменный зелёный при витрине или необходимости внимания; иначе нейтральная. */
function tradePointBranchAccentClass(line: string, deficit: number, newTasks: number): string {
  const needsBrandGreen = deficit > 0 || newTasks > 0 || line === "Есть витрина";
  if (needsBrandGreen) return "border-l-[#9ACA3C]";
  return "border-l-[#E3E6F3]";
}

function tradePointShowcaseStatusBadgeClass(line: string, deficit: number, newTasks: number): string {
  if (deficit > 0 || newTasks > 0 || line === "Есть дефицит") {
    return "border-[#9ACA3C] bg-[#9ACA3C]/10 text-[#222631]";
  }
  if (line === "Есть витрина") {
    return "border-[#9ACA3C]/40 bg-[#FFFFFF] text-[#222631]";
  }
  return badgeNeutral;
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
  const statusBadgeCn = tradePointShowcaseStatusBadgeClass(line, deficit, newTasks);

  const ship =
    shipmentActiveDayId && shipmentUserId && workPlanState
      ? getDealerShipmentStatus(dealer, shipmentActiveDayId, shipmentUserId, workPlanState)
      : null;

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-md border border-[#E3E6F3] bg-[#FFFFFF] py-2 pl-2 pr-2 shadow-none sm:py-2.5 sm:pr-2.5",
        "border-l-4",
        accentBorder,
      )}
      data-testid={`card-dealer-showcase-trade-point-${tp.id}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <div className="flex min-w-0 items-start gap-2">
              <TradePointRowListThumb point={tp} size="xs" className="shrink-0" />
              <div className="min-w-0">
                <span className="text-sm font-semibold leading-snug text-[#222631]">{tp.name}</span>
                <p className="font-mono text-[10px] leading-tight text-[#8F96B0]">{getTradePointDisplayCodeForActualization(tp)}</p>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-7 shrink-0 rounded-md border border-[#9ACA3C]/35 bg-[#FFFFFF] px-2.5 text-[11px] font-medium text-[#222631] hover:bg-[#9ACA3C]/10 sm:mt-0"
            >
              <Link href={tpHref} data-testid={`button-dealer-showcase-open-trade-point-${tp.id}`}>
                Открыть ТТ
              </Link>
            </Button>
          </div>
          <p className="text-[11px] leading-snug text-[#8F96B0]">
            {tp.city}
            {tp.address ? ` · ${tp.address}` : ""}
          </p>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className={cn("text-[10px] font-medium", statusBadgeCn)}>
              {line}
            </Badge>
            {summary.hasExpansionPotentialComputed ? (
              <Badge variant="outline" className={cn("text-[10px]", badgeSoft)}>
                Потенциал витрины
              </Badge>
            ) : null}
          </div>
          {(portals || tandoor) && (
            <p className="text-[10px] leading-tight text-[#8F96B0]">{[portals, tandoor].filter(Boolean).join(" · ")}</p>
          )}
          {ship ? <p className="text-[10px] text-[#8F96B0]">Отгрузка: {ship.label}</p> : null}
          {cleanContact(tp.contactName) ? <p className="text-[11px] text-[#8F96B0]">Контакт: {tp.contactName}</p> : null}
        </div>
      </div>
      <div className="mt-2 flex max-w-full flex-wrap gap-1.5 border-t border-[#E3E6F3] pt-2">
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
      className="overflow-hidden rounded-xl border border-[#E3E6F3] border-l-4 border-l-[#9ACA3C] bg-[#FFFFFF] shadow-sm"
      data-testid={`card-dealer-showcase-${row.id}`}
    >
      <CardContent className="space-y-3 p-3 text-[#222631] sm:p-4">
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
                  "mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#222631]/20 bg-[#EEEFF6] px-2 py-1",
                  showWorkPlanSelect && wp && onToggleWorkPlanSelect && "border-l-2 border-l-[#9ACA3C]/50 pl-2",
                )}
                data-testid={`wrap-dealer-bulk-select-${row.id}`}
              >
                <span className="text-[9px] font-bold uppercase text-[#222631]">Удалить</span>
                <DealerBulkDeleteCheckbox
                  checked={archiveBulk.selectedIds.has(row.id)}
                  onCheckedChange={(v: boolean | "indeterminate") => archiveBulk.onToggle(row.id, v === true)}
                  data-testid={`checkbox-dealer-select-${row.id}`}
                  aria-label={`Удалить клиента ${row.name} из рабочей базы`}
                />
              </span>
            ) : null}
            {(() => {
              const cover = row.coverPhotoThumbnailUrl?.trim() || row.coverPhotoUrl?.trim();
              if (cover) {
                return (
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[#9ACA3C]/25 bg-[#FFFFFF]">
                    <SafeImage src={cover} alt="" className="absolute inset-0 h-full w-full" objectFit="cover" />
                  </div>
                );
              }
              const logo = (row as DealerRow & { logoUrl?: string }).logoUrl?.trim();
              if (logo) {
                return (
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#9ACA3C]/25 bg-[#FFFFFF]">
                    <img src={logo} alt="" className="h-full w-full object-contain" loading="lazy" />
                  </div>
                );
              }
              return (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#9ACA3C]/30 bg-[#9ACA3C]/10 text-base font-bold text-[#222631]">
                  {initialsFromName(row.name)}
                </div>
              );
            })()}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-base font-semibold leading-tight text-[#222631] sm:text-lg">{row.name}</h3>
                <Badge variant="outline" className={cn("text-[10px] font-semibold", badgeOutline)}>
                  Дилер
                </Badge>
                {tpCount > 1 ? (
                  <Badge variant="outline" className={cn("text-[10px] font-medium", badgeOutline)}>
                    Сеть
                  </Badge>
                ) : null}
                <Badge variant="outline" className={cn("text-[10px] font-medium tabular-nums", badgeOutline)}>
                  {tpCount === 1 ? "1 ТТ" : `${tpCount} ТТ`}
                </Badge>
                {cities.length > 1 ? (
                  <Badge variant="outline" className={cn("text-[10px] font-medium tabular-nums", badgeOutline)}>
                    {cities.length} городов
                  </Badge>
                ) : null}
              </div>
              <p className="font-mono text-xs text-[#8F96B0]">{code}</p>
              {inn ? <p className="text-xs text-[#8F96B0]">ИНН: {inn}</p> : null}
              <p className="text-xs text-[#8F96B0]">{regionLine || "—"}</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className={cn("text-[10px]", badgeOutline)}>
                  {getClientCategoryLabel(row.clientCategory)}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px]", statusBadgeClass(row.status))}>
                  {dealerShowcaseStatusLabel(row.status)}
                </Badge>
                {stockSig.hasMainWarehouse ? (
                  <Badge variant="outline" className={cn("text-[10px]", badgeSoft)} data-testid={`badge-dealer-main-warehouse-${row.id}`}>
                    Склад двери
                  </Badge>
                ) : null}
                {stockSig.hasHardwareWarehouse ? (
                  <Badge variant="outline" className={cn("text-[10px]", badgeSoft)} data-testid={`badge-dealer-hardware-warehouse-${row.id}`}>
                    Склад фурнитуры
                  </Badge>
                ) : null}
                {programSig.hasTandoorClub ? (
                  <Badge variant="outline" className={cn("text-[10px]", badgeSoft)} data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.tandoor_club}-${row.id}`}>
                    Tandoor Club
                  </Badge>
                ) : null}
                {programSig.hasCashbackAgent ? (
                  <Badge variant="outline" className={cn("text-[10px]", badgeSoft)} data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.cashback_agent}-${row.id}`}>
                    Кэшбэк
                  </Badge>
                ) : null}
                {programSig.hasSpecialConditions ? (
                  <Badge variant="outline" className={cn("text-[10px]", badgeSoft)} data-testid={`${DEALER_PROGRAM_FILTER_BADGE_TESTID.special_conditions}-${row.id}`}>
                    Спецусловия
                  </Badge>
                ) : null}
              </div>
              {hidden ? (
                <Badge variant="outline" className="w-fit border-[#E3E6F3] bg-[#EEEFF6] text-[10px] text-[#8F96B0]" data-testid={`badge-dealer-hidden-${row.id}`}>
                  Скрыт из рабочего списка
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[12rem]">
            <Button
              asChild
              size="sm"
              className="h-9 w-full rounded-full bg-[#9ACA3C] font-semibold text-[#FFFFFF] hover:bg-[#86B832] sm:w-auto"
            >
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
          <div className="rounded-lg border border-[#9ACA3C]/25 bg-[#EEEFF6] px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#8F96B0]">
              <Building2 className="h-3.5 w-3.5 text-[#9ACA3C]" aria-hidden />
              Основной контакт
            </div>
            {contactName ? <p className="mt-1 font-medium text-[#222631]">{contactName}</p> : null}
            {phone ? <p className="text-xs text-[#222631]">{phone}</p> : null}
            {email ? <p className="text-xs text-[#8F96B0]">{email}</p> : null}
          </div>
        )}

        {merged.length > 0 ? (
          <section
            className="rounded-lg border border-[#9ACA3C]/25 bg-[#E3E6F3]/60 p-2 sm:p-2.5"
            data-testid={`section-dealer-showcase-branches-${row.id}`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#222631]">Филиалы / торговые точки</h4>
              <Badge variant="outline" className="h-5 border border-[#9ACA3C]/35 bg-[#FFFFFF] px-2 text-[10px] font-semibold tabular-nums text-[#222631]">
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
                className="mt-2 h-8 w-full text-xs font-semibold text-[#222631] hover:bg-[#9ACA3C]/10"
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
      <Card className="rounded-2xl border border-dashed border-[#9ACA3C]/30 bg-[#EEEFF6] p-8 text-center text-sm text-[#8F96B0]">
        {empty}
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3">
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
