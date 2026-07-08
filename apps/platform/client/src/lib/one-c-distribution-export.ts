/**
 * Fire-and-forget export дистрибуции ЛК+1С → FTP (distribution_latest.json).
 * Использует существующий POST /api/admin/export-distribution.
 */

export type OneCDistributionExportResult = {
  ok: boolean;
  message: string;
};

export async function triggerDistributionExportTo1c(): Promise<OneCDistributionExportResult> {
  try {
    const res = await fetch("/api/admin/export-distribution", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const json = (await res.json()) as { success?: boolean; message?: string };
    if (!res.ok || json.success !== true) {
      return {
        ok: false,
        message: json.message ?? "Ошибка отправки в 1С.",
      };
    }
    return { ok: true, message: "Отправлено в 1С" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Ошибка отправки в 1С.",
    };
  }
}

export function triggerDistributionExportTo1cFireAndForget(
  onResult?: (result: OneCDistributionExportResult) => void,
): void {
  void triggerDistributionExportTo1c().then((result) => {
    onResult?.(result);
  });
}
