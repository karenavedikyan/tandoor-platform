/**
 * Промт 47 D3: streak — серия подряд идущих дней с активностью менеджера.
 *
 * Активный день (Europe/Moscow): если в этот календарный день есть хоть одна
 * запись клиента/ТТ менеджера с updatedAt в этот день (вариант V «любое
 * редактирование карточки клиента — день активный»). Аудит-источника на клиенте
 * нет, fallback на baseRows.updatedAt.
 *
 * Streak = последовательность дней, заканчивающаяся на «сегодня» или «вчера».
 * Если сегодня активности нет, но была вчера — стрик считается со вчера; если
 * последний активный день старше «вчера» — streak = 0.
 *
 * Cap: 99 (бизнес-правило — не пугать пользователя огромным числом).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

export type StreakInputDealerRow = {
  /** Любой row, у которого есть assignedManagerId/managerId/userId и updatedAt. */
  assignedManagerId?: string | null;
  managerId?: string | null;
  userId?: string | null;
  updatedAt?: string | Date | null;
};

export type StreakAuditEvent = {
  actorUserId: string;
  action: string;
  occurredAt: string | Date;
};

/** Действия, которые считаем «активностью менеджера». */
const ACTIVITY_ACTIONS = new Set([
  "dealer.update",
  "dealer.create",
  "tradepoint.create",
  "tradepoint.update",
  "dealer.contact.update",
]);

function moscowDayKey(input: Date | string | null | undefined): string | null {
  if (!input) return null;
  const t = input instanceof Date ? input.getTime() : Date.parse(input);
  if (!Number.isFinite(t)) return null;
  const m = new Date(t + MOSCOW_OFFSET_MS);
  const y = m.getUTCFullYear();
  const mo = String(m.getUTCMonth() + 1).padStart(2, "0");
  const d = String(m.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function todayMoscowDayKey(now: number = Date.now()): string {
  return moscowDayKey(new Date(now))!;
}

function shiftDay(dayKey: string, deltaDays: number): string {
  const parts = dayKey.split("-").map((v) => Number.parseInt(v, 10));
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const ms = Date.UTC(y, m - 1, d) + deltaDays * MS_PER_DAY;
  const next = new Date(ms);
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(next.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

/**
 * Считает streak дней с активностью у указанного менеджера.
 *
 * @param actorUserId  userId менеджера (id, который сохраняем в `updatedBy` / `actorUserId`)
 * @param baseRows     клиенты в зоне ответственности (или весь baseRows — фильтр внутри)
 * @param audit        опционально — audit-события (любого источника), по умолчанию пусто
 * @param now          опционально для тестов
 */
export function computeStreak(
  actorUserId: string,
  baseRows: StreakInputDealerRow[],
  audit?: StreakAuditEvent[],
  now: number = Date.now(),
): number {
  if (!actorUserId) return 0;
  const days = new Set<string>();

  for (const row of baseRows) {
    const owner = row.assignedManagerId ?? row.managerId ?? row.userId ?? null;
    if (owner !== actorUserId) continue;
    const key = moscowDayKey(row.updatedAt ?? null);
    if (key) days.add(key);
  }

  if (audit) {
    for (const ev of audit) {
      if (ev.actorUserId !== actorUserId) continue;
      if (!ACTIVITY_ACTIONS.has(ev.action)) continue;
      const key = moscowDayKey(ev.occurredAt);
      if (key) days.add(key);
    }
  }

  if (days.size === 0) return 0;

  const today = todayMoscowDayKey(now);
  const yesterday = shiftDay(today, -1);

  // Если сегодня нет активности, но вчера была — считаем со вчера.
  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    if (streak >= 99) return 99;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}
