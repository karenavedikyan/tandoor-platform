/**
 * Промт 434: одноразовое размонтирование всех зарегистрированных service workers.
 * Бесшумно. Не падает, если SW API недоступен.
 */
export async function unregisterAllServiceWorkers(): Promise<void> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    if (!regs.length) return;
    for (const reg of regs) {
      try {
        await reg.unregister();
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line no-console
    console.info("[sw-kill-switch] unregistered", regs.length);
  } catch {
    /* ignore */
  }
}
