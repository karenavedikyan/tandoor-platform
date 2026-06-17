/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ключ JS API Яндекс.Карт для страницы «Карта клиентов» (только отображение координат). */
  readonly VITE_YANDEX_MAPS_API_KEY?: string;
  /** Web Vitals reporter (Промт 382). false/0/off — отключить sendBeacon. */
  readonly VITE_WEB_VITALS_ENABLED?: string;
}

declare module "*.svg" {
  const src: string;
  export default src;
}
