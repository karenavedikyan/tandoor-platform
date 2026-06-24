import type { DealerRow, DealerTradePoint } from "./dealer-base-mock-data.js";

/** Осмысленное имя ТТ или null (отсекает пустые и заглушки вроде "."). */
export function meaningfulTradePointName(name?: string): string | null {
  const t = (name ?? "").trim();
  if (!t || t === ".") return null;
  return t;
}

export function tradePointDisplayLabel(point: Pick<DealerTradePoint, "name" | "releaseCode" | "id">): string {
  const meaningful = meaningfulTradePointName(point.name);
  if (meaningful) return meaningful;
  const code = point.releaseCode?.trim();
  if (code) return code;
  return point.id;
}

/** Строка «клиент · ТТ: …» для компактной шапки fullscreen-ввода. */
export function fullscreenCounterpartyLine(
  dealer: Pick<DealerRow, "name">,
  point: Pick<DealerTradePoint, "name" | "releaseCode" | "id" | "city">,
): string {
  const dealerName = dealer.name?.trim() || "Клиент";
  const tp = tradePointDisplayLabel(point);
  const city = point.city?.trim();
  const citySuffix = city && city !== "—" ? ` · ${city}` : "";
  return `${dealerName} · ТТ: ${tp}${citySuffix}`;
}
