/**
 * Element-scroll виртуализация списков «Дистрибуция → Ввод» (контейнер overflow-y-auto + max-h).
 */

import { useLayoutEffect, useState, type RefObject } from "react";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";

export const DISTRIBUTION_ENTRY_VIRTUAL_OVERSCAN = 6;

export const DISTRIBUTION_ENTRY_VIRTUAL_ESTIMATE = {
  tradepointCompact: 68,
  tradepointDetailed: 150,
  catalogGridRow: 220,
  catalogList: 52,
  simpleRow: 72,
} as const;

export function useDistributionEntryVirtualizer({
  count,
  estimateSize,
  scrollRef,
  lanes = 1,
}: {
  count: number;
  estimateSize: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  lanes?: number;
}): Virtualizer<HTMLDivElement, Element> {
  return useVirtualizer({
    count,
    lanes,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan: DISTRIBUTION_ENTRY_VIRTUAL_OVERSCAN,
  });
}

/** Сетка ТТ: 2 колонки до lg (1024px), 1 колонка на lg+ (как grid-cols-2 lg:grid-cols-1). */
export function useDistributionEntryTradepointGridLanes(): number {
  const [lanes, setLanes] = useState(2);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setLanes(mq.matches ? 1 : 2);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return lanes;
}

/** Двухколоночный лейаут «Ввод» (совпадает с Tailwind `lg`, 1024px). */
export function useDistributionEntryDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false,
  );

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

const TAILWIND_BREAKPOINTS: ReadonlyArray<{ prefix: string; min: number }> = [
  { prefix: "2xl", min: 1536 },
  { prefix: "xl", min: 1280 },
  { prefix: "lg", min: 1024 },
  { prefix: "md", min: 768 },
  { prefix: "sm", min: 640 },
];

export function catalogGridColumnsFromClass(gridClass: string, width: number): number {
  if (!gridClass.trim()) return 1;

  const customRe = /min-\[(\d+)px\]:grid-cols-(\d+)/g;
  const customMatches = Array.from(gridClass.matchAll(customRe))
    .map((m) => ({ min: Number(m[1]), cols: Number(m[2]) }))
    .filter((x) => Number.isFinite(x.min) && Number.isFinite(x.cols))
    .sort((a, b) => b.min - a.min);
  for (const c of customMatches) {
    if (width >= c.min) return c.cols;
  }

  for (const bp of TAILWIND_BREAKPOINTS) {
    if (width < bp.min) continue;
    const re = new RegExp(`(?:^|\\s)${bp.prefix}:grid-cols-(\\d+)`);
    const m = gridClass.match(re);
    if (m) return Number(m[1]);
  }

  const base = gridClass.match(/(?:^|\s)grid-cols-(\d+)/);
  if (base) return Number(base[1]);

  return 1;
}

/** Колонки сетки каталога по классу из catalogCardGridClass. */
export function useDistributionEntryCatalogGridColumns(gridClass: string): number {
  const [columns, setColumns] = useState(() =>
    typeof window !== "undefined" ? catalogGridColumnsFromClass(gridClass, window.innerWidth) : 2,
  );

  useLayoutEffect(() => {
    const update = () => setColumns(catalogGridColumnsFromClass(gridClass, window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [gridClass]);

  return columns;
}

export function distributionEntryVirtualItemStyle(
  virtualizer: Virtualizer<HTMLDivElement, Element>,
  start: number,
): {
  position: "absolute";
  top: number;
  left: number;
  width: "100%";
  transform: string;
} {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    transform: `translateY(${start}px)`,
  };
}
