/**
 * Нормализация названия населённого пункта для карточки территории (cockpit) и группировок по городам.
 * Не подставляет сырой почтовый адрес вместо города.
 *
 * Ручные / регрессионные кейсы:
 * - "296100, респ Крым, г Джанкой, ул ..." → "Джанкой"
 * - "297000, респ Крым, Красногвардейский р-н, ..." → "Красногвардейский район"
 * - "297100, Крым Респ, Нижнегорский р-н, ..." → "Нижнегорский район"
 */

const STREET_MARK = /\b(ул\.?|улица|просп\.?|пр-кт|пер\.?|переулок|наб\.?|набережная|шоссе|д\.?|дом|кв\.?|квартира|офис|строение|стр\.?)\b/i;

function isDashOrEmpty(s: string): boolean {
  const t = s.trim();
  return !t || t === "—" || t === "-";
}

function stripLeadingPostalIndex(s: string): string {
  return s.replace(/^\d{5,6}\s*[,;]?\s*/, "").trim();
}

function looksLikeStreetOrTooLong(label: string): boolean {
  const t = label.trim();
  if (!t || t.length > 52) return true;
  if (STREET_MARK.test(t)) return true;
  if (/^\d+[\s\d,-]*$/.test(t)) return true;
  return false;
}

function cleanExtractedFragment(raw: string): string | null {
  let t = raw.trim();
  const beforeComma = t.split(/[,;]/)[0] ?? t;
  t = beforeComma.trim();
  t = t.replace(/\bул\.?.*$/i, "").trim();
  t = t.replace(/\bд\.?\s*\d+.*$/i, "").trim();
  t = t.replace(/\s+р-н\.?$/i, "").trim();
  if (!t || t.length < 2 || t.length > 48) return null;
  if (STREET_MARK.test(t)) return null;
  if (/^\d/.test(t)) return null;
  return t;
}

function districtFromRyon(segment: string): string | null {
  const m = segment.match(/^([А-Яа-яЁё][А-Яа-яЁё\-]{0,40})\s+р-н\.?(?:\b|,|$)/i);
  if (!m?.[1]) return null;
  const base = m[1].replace(/\s+/g, " ").trim();
  if (!base || looksLikeStreetOrTooLong(base)) return null;
  return `${base} район`;
}

function tryExtractFromSegment(segment: string): string | null {
  const seg = segment.replace(/\s+/g, " ").trim();
  if (!seg) return null;

  const urbanPatterns: RegExp[] = [
    /\bг\.?\s+([^,;]+)/i,
    /\bгород\s+([^,;]+)/i,
    /\bст-ца\.?\s+([^,;]+)/i,
    /\bстаница\s+([^,;]+)/i,
    /\bпгт\.?\s+([^,;]+)/i,
    /\bпос\.?\s+([^,;]+)/i,
    /\bпоселок\s+([^,;]+)/i,
    /\bсело\s+([^,;]+)/i,
  ];
  for (const re of urbanPatterns) {
    const m = seg.match(re);
    if (m?.[1]) {
      const c = cleanExtractedFragment(m[1]);
      if (c && !looksLikeStreetOrTooLong(c)) return ensureFirstUpper(c);
    }
  }

  const dist = districtFromRyon(seg);
  if (dist) return ensureFirstUpper(dist);

  return null;
}

function ensureFirstUpper(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractFromBlob(blob: string): string | null {
  const stripped = stripLeadingPostalIndex(blob);
  if (!stripped) return null;

  const parts = stripped.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const hit = tryExtractFromSegment(part);
    if (hit) return hit;
  }

  const whole = tryExtractFromSegment(stripped);
  if (whole) return whole;

  const noNoise = stripped
    .replace(/\bресп\.?\s*крым\b/i, "")
    .replace(/\bкрым\s*респ\b/i, "")
    .replace(/\bреспублика\s*крым\b/i, "")
    .replace(/\bкрым\b/i, "")
    .replace(/[,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (noNoise && noNoise.length >= 2 && noNoise.length <= 40 && !/,/.test(blob) && !STREET_MARK.test(noNoise) && !/^\d/.test(noNoise)) {
    return ensureFirstUpper(noNoise);
  }

  return null;
}

/**
 * @param rawCity поле города из строки клиента/ТТ (может содержать полный адрес)
 * @param rawAddress опционально полный адрес — используется, если город пустой или «—»
 * @returns короткое имя для UI и группировки, либо «Без города», если распознать нельзя (сырой адрес не возвращаем)
 */
export function normalizeTerritoryCityName(rawCity?: string | null, rawAddress?: string | null): string {
  const cityTrim = rawCity?.trim() ?? "";
  const addrTrim = rawAddress?.trim() ?? "";

  const cityOk = !isDashOrEmpty(cityTrim);
  const primary = cityOk ? cityTrim : "";
  const secondary = addrTrim && !isDashOrEmpty(addrTrim) ? addrTrim : "";

  const blobs: string[] = [];
  if (primary) blobs.push(primary);
  if (secondary && secondary !== primary) blobs.push(secondary);

  if (blobs.length === 0) return "Без города";

  for (const blob of blobs) {
    const hit = extractFromBlob(blob);
    if (hit) return hit;
  }

  const single = blobs[0]!;
  const stripped = stripLeadingPostalIndex(single);
  if (
    stripped &&
    stripped.length <= 38 &&
    !/,/.test(stripped) &&
    !STREET_MARK.test(stripped) &&
    !/^\d{5,6}/.test(stripped) &&
    !/\bр-н\b/i.test(stripped)
  ) {
    return ensureFirstUpper(stripped);
  }

  return "Без города";
}
