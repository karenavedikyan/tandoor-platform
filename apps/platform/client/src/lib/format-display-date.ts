/**
 * Отображение дат/времени в UI без сырых ISO-строк.
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Дата и время: 21.05.2026, 14:10 */
export function formatDisplayDateTime(iso: string | null | undefined): string {
  if (!iso?.trim()) return "Не указано";
  const s = iso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(s);
  if (m) return `${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  return "Не указано";
}

/** Только дата: 21.05.2026 */
export function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "Не указано";
  const s = iso.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
  return "Не указано";
}
