/**
 * Запуск: `npm run test:streak` из каталога apps/platform.
 *
 * Промт 47 G1: серия дней с активностью менеджера.
 */
import assert from "node:assert/strict";
import { computeStreak } from "../actualization-streak";

const MS_DAY = 24 * 60 * 60 * 1000;
const MOSCOW_OFFSET = 3 * 60 * 60 * 1000;

// Все тесты — относительно фиксированного "now" в полдень UTC, чтобы не зависеть от текущего времени.
const NOW = Date.parse("2026-05-27T09:00:00.000Z"); // UTC, для Москвы это 12:00 27 мая.

function moscowMidnightIsoFor(offsetDays: number): string {
  // Берём 12:00 московского времени для дня (NOW - offsetDays).
  const localMs = NOW - offsetDays * MS_DAY;
  return new Date(localMs).toISOString();
}

// G1.1: пустые входы → 0.
{
  assert.equal(computeStreak("u1", [], [], NOW), 0, "пусто → 0");
  assert.equal(computeStreak("", [{ userId: "u1", updatedAt: moscowMidnightIsoFor(0) }], [], NOW), 0, "пустой actorUserId → 0");
}

// G1.2: только сегодня → 1.
{
  const rows = [{ userId: "u1", updatedAt: moscowMidnightIsoFor(0) }];
  assert.equal(computeStreak("u1", rows, [], NOW), 1, "только сегодня → 1");
}

// G1.3: 5 подряд дней → 5.
{
  const rows = [0, 1, 2, 3, 4].map((d) => ({ userId: "u1", updatedAt: moscowMidnightIsoFor(d) }));
  assert.equal(computeStreak("u1", rows, [], NOW), 5, "пять подряд → 5");
}

// G1.4: разрыв ломает стрик.
{
  // активность была сегодня, вчера, позавчера (3), потом пропуск (день 3 = «-3»), потом дни 4–7
  const rows = [
    { userId: "u1", updatedAt: moscowMidnightIsoFor(0) },
    { userId: "u1", updatedAt: moscowMidnightIsoFor(1) },
    { userId: "u1", updatedAt: moscowMidnightIsoFor(2) },
    // пропуск дня 3
    { userId: "u1", updatedAt: moscowMidnightIsoFor(4) },
    { userId: "u1", updatedAt: moscowMidnightIsoFor(5) },
  ];
  assert.equal(computeStreak("u1", rows, [], NOW), 3, "после разрыва считаются только подряд идущие свежие дни");
}

// G1.5: cap 99.
{
  const rows = Array.from({ length: 150 }, (_, d) => ({ userId: "u1", updatedAt: moscowMidnightIsoFor(d) }));
  assert.equal(computeStreak("u1", rows, [], NOW), 99, "cap на 99");
}

// G1.6: учёт только своего userId.
{
  const rows = [
    { userId: "u1", updatedAt: moscowMidnightIsoFor(0) },
    { userId: "u2", updatedAt: moscowMidnightIsoFor(1) },
    { userId: "u2", updatedAt: moscowMidnightIsoFor(2) },
  ];
  assert.equal(computeStreak("u1", rows, [], NOW), 1, "u1: только свой день");
  // u2: сегодня нет, но вчера и позавчера — есть → стрик считается со вчера = 2.
  assert.equal(computeStreak("u2", rows, [], NOW), 2, "u2: вчера + позавчера, считается от yesterday-anchor → 2");
}

// G1.7: audit-источник добавляется к baseRows.
{
  const audit = [
    { actorUserId: "u1", action: "dealer.update", occurredAt: moscowMidnightIsoFor(0) },
    { actorUserId: "u1", action: "dealer.update", occurredAt: moscowMidnightIsoFor(1) },
    { actorUserId: "u1", action: "non-tracked.action", occurredAt: moscowMidnightIsoFor(2) }, // не считается
  ];
  assert.equal(computeStreak("u1", [], audit, NOW), 2, "audit с tracked actions добавляет дни");
}

// G1.8: yesterday работает (если сегодня без активности, но вчера была).
{
  const rows = [{ userId: "u1", updatedAt: moscowMidnightIsoFor(1) }]; // только вчера
  assert.equal(computeStreak("u1", rows, [], NOW), 1, "вчера + сегодня нет → 1");
}

void MOSCOW_OFFSET; // используется внутри util; здесь — для self-doc.

console.log("actualization-streak: ok (8 cases)");
