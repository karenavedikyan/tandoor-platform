/**
 * Коммерческие характеристики клиента в актуализации (ручные клиенты + overrides).
 * Хранятся в `ManualDealer.fields` / `DealerActualizationOverride.fields`, мержатся в `DealerRow`.
 */

export type DealerCommercialTriSelect = "unset" | "yes" | "no";

export function commercialTriFromBoolNull(v: boolean | null | undefined): DealerCommercialTriSelect {
  if (v === true) return "yes";
  if (v === false) return "no";
  return "unset";
}

export function commercialTriToBoolNull(v: DealerCommercialTriSelect): boolean | null {
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

export function commercialTriLabelRu(v: boolean | null | undefined): string {
  if (v === true) return "Да";
  if (v === false) return "Нет";
  return "Не указано";
}

/** Читает boolean | null из полей актуализации; отсутствие ключа → null («не указано»). */
export function readCommercialBoolNull(f: Record<string, unknown>, key: string): boolean | null {
  if (!Object.prototype.hasOwnProperty.call(f, key)) return null;
  const v = f[key];
  if (v === true || v === false || v === null) return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

export function readCommercialString(f: Record<string, unknown>, key: string): string {
  if (!Object.prototype.hasOwnProperty.call(f, key)) return "";
  const v = f[key];
  return typeof v === "string" ? v : "";
}
