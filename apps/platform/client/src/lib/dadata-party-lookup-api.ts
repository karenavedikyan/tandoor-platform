import type { LegalEntityInnLookupResult } from "./legal-entity-directory.js";

export type DadataPartyLookupResponse =
  | { success: true; items: LegalEntityInnLookupResult[] }
  | { success: false; code?: string; message?: string };

/**
 * Поиск организации по ИНН через DaData (сервер POST /api/dadata/party-find-by-inn).
 */
export async function fetchDadataPartiesByInn(innRaw: string): Promise<DadataPartyLookupResponse> {
  const inn = innRaw.replace(/\D/g, "");
  let res: Response;
  try {
    res = await fetch("/api/dadata/party-find-by-inn", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: inn }),
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
    return { success: true, items: o.items as LegalEntityInnLookupResult[] };
  }
  return {
    success: false,
    code: typeof o.code === "string" ? o.code : undefined,
    message: typeof o.message === "string" ? o.message : "DaData недоступна.",
  };
}
