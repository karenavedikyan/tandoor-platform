export type DadataAddressSuggestItem = {
  value: string;
  unrestrictedValue: string;
  postalCode: string;
  region: string;
  city: string;
  street: string;
  house: string;
  fiasId: string;
  kladrId: string;
  geoLat: string;
  geoLon: string;
  source: "dadata";
};

export type DadataAddressSuggestOk = { success: true; items: DadataAddressSuggestItem[] };

export type DadataAddressSuggestErr = {
  success: false;
  code?: string;
  message?: string;
};

/**
 * Подсказки адреса через backend POST /api/dadata/address-suggest (ключ DaData только на сервере).
 */
export async function suggestAddress(
  query: string,
  options?: { count?: number },
): Promise<DadataAddressSuggestOk | DadataAddressSuggestErr> {
  const count = options?.count ?? 5;
  let res: Response;
  try {
    res = await fetch("/api/dadata/address-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, count }),
    });
  } catch {
    return { success: false, message: "Сеть недоступна." };
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { success: false, message: "Не удалось разобрать ответ сервера." };
  }
  const o = data != null && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  if (o.success === true && Array.isArray(o.items)) {
    return { success: true, items: o.items as DadataAddressSuggestItem[] };
  }
  const code = typeof o.code === "string" ? o.code : undefined;
  const message = typeof o.message === "string" ? o.message : "Ошибка подсказок адреса.";
  return { success: false, code, message };
}
