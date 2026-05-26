/**
 * Форматирование даты/времени для журналов и компактных списков (ru-RU, локальное время).
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDate(iso: string | Date | number | null | undefined): Date | null {
  if (iso == null) return null;
  if (typeof iso === "number" && Number.isFinite(iso)) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (iso instanceof Date) {
    return Number.isNaN(iso.getTime()) ? null : iso;
  }
  const s = String(iso).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** «26.05.2026 19:55:33» (24h). Невалидно / пусто — «—». */
export function formatDisplayDateTime(iso: string | Date | number | null | undefined): string {
  const d = toDate(iso);
  if (!d) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** «26.05.2026». Невалидно / пусто — «—». */
export function formatDisplayDate(iso: string | Date | number | null | undefined): string {
  const d = toDate(iso);
  if (!d) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** «5 мин назад», «2 ч назад», «вчера», иначе {@link formatDisplayDate}. */
export function formatRelativeTime(iso: string | Date | number | null | undefined): string {
  const d = toDate(iso);
  if (!d) return "—";
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 0) return formatDisplayDate(d);

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "только что";
  const min = Math.floor(sec / 60);
  if (min < 60) {
    if (min === 1) return "1 мин назад";
    if (min >= 2 && min <= 4) return `${min} мин назад`;
    return `${min} мин назад`;
  }
  const hours = Math.floor(min / 60);
  if (hours < 24) {
    if (hours === 1) return "1 ч назад";
    if (hours >= 2 && hours <= 4) return `${hours} ч назад`;
    return `${hours} ч назад`;
  }

  const today0 = startOfLocalDay(new Date(now));
  const y0 = startOfLocalDay(new Date(today0.getTime() - 86400000));
  const d0 = startOfLocalDay(d);
  if (d0.getTime() === y0.getTime()) return "вчера";

  return formatDisplayDate(d);
}
