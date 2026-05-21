/** Нормализация контактов и ссылки tel/wa/mailto для карточек витрины и списков. */

export function cleanContactDisplay(s: string | undefined | null): string | null {
  const t = (s ?? "").trim();
  if (!t || t === "—" || t === "-") return null;
  return t;
}

export function telHref(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("+")) return `tel:${t.replace(/\s/g, "")}`;
  const d = t.replace(/\D/g, "");
  if (d.length < 10) return null;
  return `tel:+${d}`;
}

export function whatsAppHref(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return null;
  let n = d;
  if (n.length === 11 && n.startsWith("8")) n = `7${n.slice(1)}`;
  if (n.length === 10) n = `7${n}`;
  return `https://wa.me/${n}`;
}

export function mailtoHref(raw: string): string | null {
  const t = raw.trim();
  if (!t || !t.includes("@")) return null;
  return `mailto:${t}`;
}
