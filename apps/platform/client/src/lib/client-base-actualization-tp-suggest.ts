import type { DealerRow, DealerTradePoint } from "./dealer-base-mock-data.js";
import type { ManualTradePoint } from "./client-base-actualization-state.js";

export type TradePointSuggestion = {
  tradePointId: string;
  name: string;
  address: string;
  city: string;
  source: "seed" | "manual";
  matchedField: "address" | "name" | "both";
};

const normalize = (s: string): string =>
  (s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[\s\-_.,;:/\\№()]+/g, " ")
    .replace(/\b(г|ул|пер|пр|пр-т|просп|д|дом|стр|корп|кв|обл|респ|днр|лнр|днп)\b/g, "")
    .trim();

const tokens = (s: string): Set<string> => new Set(normalize(s).split(/\s+/).filter((t) => t.length >= 2));

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter += 1;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
};

function manualField(m: ManualTradePoint, key: string): string {
  const v = m.fields?.[key];
  return typeof v === "string" ? v : "";
}

/**
 * Возвращает похожие ТТ из карточки клиента.
 * Сравнение по адресу (порог 0.6) и по названию (порог 0.7).
 */
export function findSimilarTradePointsInDealer(args: {
  row: DealerRow;
  manualTradePoints: ManualTradePoint[];
  inputName: string;
  inputAddress: string;
  inputCity: string;
  excludeTradePointId?: string | null;
}): TradePointSuggestion[] {
  const { row, manualTradePoints, inputName, inputAddress, inputCity, excludeTradePointId } = args;
  const nameTokens = tokens(inputName);
  const addrTokens = tokens([inputCity, inputAddress].filter(Boolean).join(" "));

  if (nameTokens.size === 0 && addrTokens.size === 0) return [];

  const seedPoints: { id: string; name: string; address: string; city: string }[] = (row.tradePoints ?? []).map(
    (tp: DealerTradePoint) => ({
      id: tp.id,
      name: tp.name ?? "",
      address: tp.address ?? "",
      city: tp.city ?? "",
    }),
  );
  const manualPoints = manualTradePoints
    .filter((m) => m.dealerId === row.id)
    .map((m) => ({
      id: m.id,
      name: manualField(m, "name"),
      address: manualField(m, "address"),
      city: manualField(m, "city"),
    }));

  const out: TradePointSuggestion[] = [];

  const considerOne = (tp: { id: string; name: string; address: string; city: string }, source: "seed" | "manual"): void => {
    if (excludeTradePointId && tp.id === excludeTradePointId) return;
    const tpAddrTokens = tokens([tp.city, tp.address].filter(Boolean).join(" "));
    const tpNameTokens = tokens(tp.name);
    const addrScore = jaccard(addrTokens, tpAddrTokens);
    const nameScore = jaccard(nameTokens, tpNameTokens);
    const hitAddr = addrTokens.size > 0 && addrScore >= 0.6;
    const hitName = nameTokens.size > 0 && nameScore >= 0.7;
    if (!hitAddr && !hitName) return;
    out.push({
      tradePointId: tp.id,
      name: tp.name || "Без названия",
      address: tp.address || "",
      city: tp.city || "",
      source,
      matchedField: hitAddr && hitName ? "both" : hitAddr ? "address" : "name",
    });
  };

  seedPoints.forEach((tp) => considerOne(tp, "seed"));
  manualPoints.forEach((tp) => considerOne(tp, "manual"));

  return out.slice(0, 5);
}
