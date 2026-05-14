/**
 * Детерминированные сигналы Release 1 для карточки клиента (витрина, дистрибуция, конкуренты).
 * Без backend: данные выводятся из DealerRow и хэша id.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ShowcaseCategoryId } from "@/lib/showcase-distribution-data";

export function charSumId(id: string): number {
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return sum;
}

export type OutdatedShowcaseModel = {
  modelId: string;
  name: string;
  reason: string;
  categoryId: ShowcaseCategoryId;
  kind: "withdrawn" | "rotation";
};

export type OutdatedShowcaseBundle = {
  withdrawn: OutdatedShowcaseModel[];
  rotation: OutdatedShowcaseModel[];
  summaryReason: string;
};

const CAT_CYCLE: ShowcaseCategoryId[] = ["entrance_doors", "interior_doors", "hardware", "molding"];

/** Раскрываемый блок «неактуальная витрина»; null — не показывать. */
export function getOutdatedShowcaseBundle(row: DealerRow): OutdatedShowcaseBundle | null {
  const h = charSumId(row.id);
  if (h % 5 === 0) return null;
  const cat0 = CAT_CYCLE[h % 4];
  const cat1 = CAT_CYCLE[(h + 1) % 4];
  const withdrawn: OutdatedShowcaseModel[] = [
    {
      modelId: `${row.id}-wd-1`,
      name: h % 2 === 0 ? "Серия Loft A12" : "Коллекция Classic 45",
      reason: "Снята с производства, на складе остатки.",
      categoryId: cat0,
      kind: "withdrawn",
    },
  ];
  const rotation: OutdatedShowcaseModel[] = [
    {
      modelId: `${row.id}-rt-1`,
      name: h % 2 === 0 ? "Новая линейка Urban" : "Модель Prime 88",
      reason: "План ротации: заменить образцы до конца квартала.",
      categoryId: cat1,
      kind: "rotation",
    },
  ];
  return {
    withdrawn,
    rotation,
    summaryReason: "Часть образцов не соответствует актуальному прайсу и плану выкладки.",
  };
}

export type ShowcaseRecommendationItem = {
  modelId: string;
  name: string;
  categoryId: ShowcaseCategoryId;
  bucket: "top20" | "novelty";
  reason: string;
};

export function getShowcaseRecommendationItems(row: DealerRow): ShowcaseRecommendationItem[] {
  const h = charSumId(row.id);
  if (h % 7 === 0) return [];
  const cat = CAT_CYCLE[(h + 2) % 4];
  const top: ShowcaseRecommendationItem = {
    modelId: `${row.id}-rec-top`,
    name: "ТОП 20: петля скрытого монтажа Pro",
    categoryId: cat,
    bucket: "top20",
    reason: "Высокая оборачиваемость в регионе и запросы в визитах.",
  };
  const nov: ShowcaseRecommendationItem = {
    modelId: `${row.id}-rec-nov`,
    name: "Новинка: комплект фурнитуры Soft‑Line",
    categoryId: CAT_CYCLE[(h + 3) % 4],
    bucket: "novelty",
    reason: "Запуск коллекции — рекомендуем закрепить на витрине.",
  };
  return h % 2 === 0 ? [top, nov] : [top];
}

export type CompetitorActivityRow = {
  activityId: string;
  competitorName: string;
  promo: string;
  rmComment: string;
  updatedAtLabel: string;
};

export function getCompetitorActivityRows(row: DealerRow): CompetitorActivityRow[] {
  const list = row.competitors.list.trim();
  const promo = row.competitors.strengths.trim();
  const rm = row.competitors.rmComment.trim();
  const mgr = row.competitors.mgrComment.trim();
  const date = row.issues.date.trim();

  if (list && list !== "—") {
    const names = list.split(/[,;|]\s*/).map((s) => s.trim()).filter(Boolean);
    return names.slice(0, 4).map((name, i) => ({
      activityId: `${row.id}-ca-${i}`,
      competitorName: name,
      promo: promo !== "—" && promo ? promo : "Спецусловия уточняются",
      rmComment: rm !== "—" && rm ? rm : mgr !== "—" && mgr ? mgr : "Комментарий РМ не заполнен.",
      updatedAtLabel: date !== "—" && date ? date : "06.05.2026",
    }));
  }

  const h = charSumId(row.id);
  if (h % 6 === 0) return [];

  return [
    {
      activityId: `${row.id}-ca-synth`,
      competitorName: ["Porta M", "Bravo", "StilDoors"][h % 3],
      promo: "Рассрочка 0% на входные группы",
      rmComment: rm !== "—" && rm ? rm : "Держим ценовое давление на входной группе.",
      updatedAtLabel: date !== "—" && date ? date : `${(h % 25) + 1}.04.2026`,
    },
  ];
}

export type PassportLegalEntity = {
  legalEntityId: string;
  name: string;
};

/** Юрлица для свернутого паспорта; пусто — блок не показывать. */
export function getPassportLegalEntities(row: DealerRow): PassportLegalEntity[] {
  const chunks: string[] = [];
  for (const raw of [row.legalEntity, row.holding]) {
    const t = raw.trim();
    if (!t || t === "—" || t === "-") continue;
    for (const part of t.split(/[;,]/)) {
      const p = part.trim();
      if (p && p !== "—") chunks.push(p);
    }
  }
  const uniq = Array.from(new Set(chunks));
  return uniq.map((name, i) => ({ legalEntityId: `${row.id}-le-${i}`, name }));
}

/** DD.MM.YYYY → Date UTC noon (избегаем сдвига TZ). */
export function parseRuDateDay(value: string): Date | null {
  const t = value.trim();
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!Number.isFinite(d) || !Number.isFinite(mo) || !Number.isFinite(y)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
}

/** Разница в месяцах (приближённо): для порога «старше 2 месяцев». */
export function distributionSnapshotIsStale(snapshot: Date, now: Date): boolean {
  const ms = now.getTime() - snapshot.getTime();
  const days = ms / (86400 * 1000);
  return days > 62;
}

export function getDistributionSnapshotForCard(row: DealerRow, now = new Date()): {
  displayLabel: string;
  parsed: Date | null;
  isStale: boolean;
} {
  const raw = row.distributionDetail.checkDate.trim();
  if (!raw || raw === "—" || raw === "-") {
    return { displayLabel: "—", parsed: null, isStale: false };
  }
  const parsed = parseRuDateDay(raw);
  if (!parsed) return { displayLabel: raw, parsed: null, isStale: false };
  const nowUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0));
  return {
    displayLabel: raw,
    parsed,
    isStale: distributionSnapshotIsStale(parsed, nowUtc),
  };
}

/** --- Обучение новых сотрудников ТТ (sessionStorage) --- */

export const DEALER_TRAINING_FLAGS_KEY = "tandoor-dealer-training-flags-v1";
export const DEALER_TRAINING_FLAGS_EVENT = "tandoor-dealer-training-flags-changed";

type TrainingFlagsDealer = {
  newStaffTrainingNeeded: boolean;
  log: { at: string; enabled: boolean; by: string }[];
};

type TrainingFlagsStorage = {
  dealers: Record<string, TrainingFlagsDealer>;
};

function emptyTrainingFlags(): TrainingFlagsStorage {
  return { dealers: {} };
}

export function loadDealerTrainingFlagsStorage(): TrainingFlagsStorage {
  if (typeof window === "undefined" || !window.sessionStorage) return emptyTrainingFlags();
  try {
    const raw = window.sessionStorage.getItem(DEALER_TRAINING_FLAGS_KEY);
    if (!raw) return emptyTrainingFlags();
    const p = JSON.parse(raw) as Partial<TrainingFlagsStorage>;
    const dealers =
      p.dealers && typeof p.dealers === "object"
        ? (p.dealers as Record<string, TrainingFlagsDealer>)
        : {};
    return { dealers };
  } catch {
    return emptyTrainingFlags();
  }
}

export function saveDealerTrainingFlagsStorage(data: TrainingFlagsStorage): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  window.sessionStorage.setItem(DEALER_TRAINING_FLAGS_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(DEALER_TRAINING_FLAGS_EVENT));
}

export function getNewStaffTrainingNeeded(dealerId: string): boolean {
  return loadDealerTrainingFlagsStorage().dealers[dealerId]?.newStaffTrainingNeeded ?? false;
}

export function setNewStaffTrainingNeeded(dealerId: string, next: boolean, byLabel: string): void {
  const storage = loadDealerTrainingFlagsStorage();
  const prev = storage.dealers[dealerId] ?? { newStaffTrainingNeeded: false, log: [] };
  const now = new Date().toISOString();
  const log = [...prev.log, { at: now, enabled: next, by: byLabel }].slice(-40);
  storage.dealers[dealerId] = {
    newStaffTrainingNeeded: next,
    log,
  };
  saveDealerTrainingFlagsStorage(storage);
}

export type TrainingFlagHistoryEvent = {
  id: string;
  meta: string;
  body: string;
  at: string;
};

export function getTrainingFlagsHistoryEvents(dealerId: string): TrainingFlagHistoryEvent[] {
  const d = loadDealerTrainingFlagsStorage().dealers[dealerId];
  if (!d?.log.length) return [];
  return d.log.map((e, idx) => {
    const day = e.at.slice(0, 10);
    const ru = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
    const metaDay = ru ? `${ru[3]}.${ru[2]}.${ru[1]}` : day;
    const body = e.enabled
      ? "Отмечена необходимость обучения новых сотрудников ТТ"
      : "Снята необходимость обучения новых сотрудников ТТ";
    return {
      id: `tf-${dealerId}-${idx}-${e.at}`,
      meta: `${metaDay} · ${e.by}`,
      body,
      at: e.at,
    };
  });
}
