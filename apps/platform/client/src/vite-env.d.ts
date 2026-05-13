/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ключ JS API Яндекс.Карт для страницы «Карта клиентов» (только отображение координат). */
  readonly VITE_YANDEX_MAPS_API_KEY?: string;
}

declare module "*.svg" {
  const src: string;
  export default src;
}
