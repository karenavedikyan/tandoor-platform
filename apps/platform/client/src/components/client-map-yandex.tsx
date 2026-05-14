/**
 * Яндекс.Карты для /#/client-map: только отображение заранее подготовленных координат (без геокодинга в браузере).
 */

import { useEffect, useRef, useState } from "react";
import { isDealerTop } from "@/lib/dealer-base-role-views";
import { getClientCategoryLabel } from "@/lib/client-category";
import { buildBrowserHashAppHref } from "@/lib/hash-route-utils";
import type { ClientMapMarker } from "@/lib/client-map-data";
import type { DealerRow } from "@/lib/dealer-base-mock-data";

const DEFAULT_CENTER: [number, number] = [45.0355, 38.9753];
const DEFAULT_ZOOM = 7;

declare global {
  interface Window {
    ymaps?: YMapsGlobal;
  }
}

type YMapsGlobal = {
  ready: (cb: () => void) => void;
  Map: new (
    el: HTMLElement | string,
    state: { center: number[]; zoom: number; controls?: string[] },
    options?: Record<string, unknown>,
  ) => YMapInstance;
  Placemark: new (
    geometry: number[],
    properties: Record<string, string | number | undefined>,
    options?: Record<string, unknown>,
  ) => unknown;
  templateLayoutFactory: {
    createClass: (template: string, override?: Record<string, unknown>) => unknown;
  };
};

type YMapInstance = {
  geoObjects: {
    add: (obj: unknown) => void;
    removeAll: () => void;
    getBounds: () => number[][] | null;
  };
  setCenter: (center: number[], zoom?: number, options?: { duration?: number; checkZoomRange?: boolean }) => void;
  setBounds: (bounds: number[][], options?: { checkZoomRange?: boolean; zoomMargin?: number | number[] }) => void;
  destroy: () => void;
};

let ymapsApiPromise: Promise<YMapsGlobal> | null = null;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dealerBaseHrefForDealer(d: DealerRow): string {
  const params: Record<string, string> = { search: d.name, city: d.city };
  if (d.releaseTeamId) params.team = d.releaseTeamId;
  if (d.releaseManagerId) params.manager = d.releaseManagerId;
  return buildBrowserHashAppHref("/dealer-base", params);
}

function buildBalloonHtml(m: ClientMapMarker): string {
  const d = m.dealer;
  const srcLabel = "точный адрес";
  const cat = getClientCategoryLabel(d.clientCategory);
  const addrBlock = d.releaseAddress
    ? `<p class="text-xs text-muted-foreground"><span class="font-medium text-foreground">Адрес: </span>${escapeHtml(d.releaseAddress)}</p>`
    : "";
  const dealerHref = escapeHtml(buildBrowserHashAppHref(`/dealers/${d.id}`));
  const baseHref = escapeHtml(dealerBaseHrefForDealer(d));
  return `
<div class="ymaps-balloon-content text-sm space-y-1" style="min-width:200px" data-testid="popup-client-map-${escapeHtml(m.id)}">
  <p class="font-semibold leading-snug">${escapeHtml(d.name)}</p>
  <p class="text-muted-foreground">${escapeHtml(d.city)}</p>
  ${addrBlock}
  <p><span class="text-muted-foreground">РОП:</span> ${escapeHtml(d.regionalManager || "—")}</p>
  <p><span class="text-muted-foreground">Менеджер:</span> ${escapeHtml(d.manager)}</p>
  <p><span class="text-muted-foreground">Категория:</span> ${escapeHtml(cat)}</p>
  <p class="text-xs"><span class="text-muted-foreground">Источник координат:</span> ${escapeHtml(srcLabel)}</p>
  <div class="flex flex-col gap-1 pt-1">
    <a class="font-medium text-primary underline-offset-2 hover:underline" href="${dealerHref}" data-testid="link-client-map-open-dealer-${escapeHtml(d.id)}">Открыть карточку</a>
    <a class="text-xs text-primary underline-offset-2 hover:underline" href="${baseHref}" data-testid="link-client-map-open-base-${escapeHtml(d.id)}">Показать в базе</a>
  </div>
</div>`;
}

function markerIconParts(ymaps: YMapsGlobal, fill: string, stroke: string, radius: number, isTop: boolean) {
  const r = isTop ? radius + 3 : radius;
  const sw = isTop ? 3 : 2;
  const size = r * 2 + sw * 2 + 4;
  const cx = size / 2;
  const cy = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></svg>`;
  const href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const layout = ymaps.templateLayoutFactory.createClass(
    `<div style="width:${size}px;height:${size}px;background:url('${href}') center/contain no-repeat;"></div>`,
  );
  const hitR = isTop ? radius + 8 : radius + 6;
  return { layout, size, hitR };
}

function syncPlacemarks(map: YMapInstance, ymaps: YMapsGlobal, markers: ClientMapMarker[]) {
  map.geoObjects.removeAll();
  for (const m of markers) {
    const isTop = isDealerTop(m.dealer);
    const { layout, size, hitR } = markerIconParts(ymaps, m.style.fill, m.style.stroke, m.style.radius, isTop);
    const off = Math.round(size / 2);
    const placemark = new ymaps.Placemark(
      [m.lat, m.lng],
      {
        balloonContent: buildBalloonHtml(m),
        hintContent: m.dealer.name,
      },
      {
        iconLayout: layout,
        iconOffset: [-off, -off],
        iconShape: {
          type: "Circle",
          coordinates: [off, off],
          radius: hitR,
        },
        zIndex: isTop ? 650 : 400,
        zIndexHover: isTop ? 700 : 500,
        openBalloonOnClick: true,
      },
    );
    map.geoObjects.add(placemark);
  }
  const bounds = map.geoObjects.getBounds();
  if (bounds && markers.length > 0) {
    map.setBounds(bounds, { checkZoomRange: true, zoomMargin: [40, 40, 40, 40] });
  } else {
    map.setCenter([...DEFAULT_CENTER], DEFAULT_ZOOM);
  }
}

function loadYandexMapsApi(apiKey: string): Promise<YMapsGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  const w = window as Window & { ymaps?: YMapsGlobal };
  if (w.ymaps) {
    return new Promise((resolve, reject) => {
      try {
        w.ymaps!.ready(() => resolve(w.ymaps!));
      } catch (e) {
        reject(e);
      }
    });
  }
  if (ymapsApiPromise) return ymapsApiPromise;
  ymapsApiPromise = new Promise<YMapsGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-tandoor-yandex-maps="1"]');
    if (existing) {
      const t0 = Date.now();
      const poll = () => {
        if (w.ymaps) {
          const y = w.ymaps;
          y.ready(() => resolve(y));
          return;
        }
        if (Date.now() - t0 > 20000) {
          ymapsApiPromise = null;
          reject(new Error("Yandex Maps API timeout"));
          return;
        }
        window.setTimeout(poll, 40);
      };
      poll();
      return;
    }
    const s = document.createElement("script");
    s.dataset.tandoorYandexMaps = "1";
    s.async = true;
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    s.onload = () => {
      if (!w.ymaps) {
        ymapsApiPromise = null;
        reject(new Error("ymaps missing after load"));
        return;
      }
      const y = w.ymaps;
      y.ready(() => resolve(y));
    };
    s.onerror = () => {
      ymapsApiPromise = null;
      reject(new Error("Yandex Maps script failed"));
    };
    document.head.appendChild(s);
  });
  return ymapsApiPromise;
}

export type ClientMapYandexProps = {
  apiKey: string;
  markers: ClientMapMarker[];
  flyTo: { lat: number; lng: number } | null;
  className?: string;
};

export function ClientMapYandex({ apiKey, markers, flyTo, className }: ClientMapYandexProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapInstance | null>(null);
  const flySeq = useRef(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let cancelled = false;
    setPhase("loading");
    setErrMsg(null);

    loadYandexMapsApi(apiKey)
      .then((ymaps) => {
        if (cancelled || !hostRef.current) return;
        if (mapRef.current) {
          mapRef.current.destroy();
          mapRef.current = null;
        }
        const map = new ymaps.Map(
          hostRef.current,
          { center: [...DEFAULT_CENTER], zoom: DEFAULT_ZOOM, controls: ["zoomControl", "fullscreenControl"] },
          { suppressMapOpenBlock: true },
        );
        mapRef.current = map;
        setPhase("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setPhase("error");
        setErrMsg(e instanceof Error ? e.message : "Ошибка загрузки Яндекс.Карт");
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || phase !== "ready") return;
    const w = window as Window & { ymaps?: YMapsGlobal };
    const ymaps = w.ymaps;
    if (!ymaps) return;
    syncPlacemarks(map, ymaps, markers);
  }, [markers, phase]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo || phase !== "ready") return;
    const seq = ++flySeq.current;
    window.setTimeout(() => {
      if (seq !== flySeq.current || !mapRef.current) return;
      mapRef.current.setCenter([flyTo.lat, flyTo.lng], 11, { duration: 300, checkZoomRange: true });
    }, 0);
  }, [flyTo, phase]);

  return (
    <div className={className}>
      {phase === "error" ? (
        <div className="flex min-h-[min(360px,52vh)] w-full flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-muted-foreground lg:min-h-[520px]">
          <p className="font-medium text-destructive">Не удалось загрузить Яндекс.Карты</p>
          <p className="mt-1">{errMsg ?? "Проверьте ключ и сеть."}</p>
        </div>
      ) : (
        <>
          <div
            ref={hostRef}
            className="h-[min(360px,52vh)] w-full min-w-0 lg:h-[520px]"
            data-testid="section-client-map-yandex-root"
          />
          {phase === "loading" ? (
            <p className="mt-2 text-xs text-muted-foreground" data-testid="text-client-map-yandex-loading">
              Загрузка карты…
            </p>
          ) : null}
        </>
      )}
      <div className="sr-only" aria-hidden>
        {markers.map((m) => (
          <span key={m.id} data-testid={`marker-client-map-${m.id}`} />
        ))}
      </div>
    </div>
  );
}
