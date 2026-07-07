/**
 * Window-виртуализация списков на /dealer-base (единая прокрутка документа, несколько сегментов).
 */

import { useLayoutEffect, useState, type RefObject } from "react";
import { useWindowVirtualizer, type Virtualizer } from "@tanstack/react-virtual";

export const DEALER_BASE_VIRTUAL_OVERSCAN = 6;

/** Оценки высоты по режимам (уточняются measureElement). */
export const DEALER_BASE_VIRTUAL_ESTIMATE = {
  large: 820,
  largeRow: 320,
  gridRow: 240,
  list: 112,
  listRow: 96,
  table: 56,
} as const;

function measureScrollMargin(el: HTMLElement | null): number {
  if (!el || typeof window === "undefined") return 0;
  const rect = el.getBoundingClientRect();
  return rect.top + window.scrollY;
}

/** scrollMargin от верха документа до начала виртуализированного списка. */
export function useDealerBaseListScrollMargin(listRef: RefObject<HTMLElement | null>, deps: unknown[] = []): number {
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const update = () => setScrollMargin(measureScrollMargin(el));
    update();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasure when list anchor or segment size changes
  }, [listRef, ...deps]);

  return scrollMargin;
}

export type DealerBaseWindowVirtualizerOptions = {
  count: number;
  estimateSize: number;
  overscan?: number;
  scrollMargin: number;
};

export function useDealerBaseWindowVirtualizer({
  count,
  estimateSize,
  overscan = DEALER_BASE_VIRTUAL_OVERSCAN,
  scrollMargin,
}: DealerBaseWindowVirtualizerOptions): Virtualizer<Window, Element> {
  return useWindowVirtualizer({
    count,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin,
  });
}

/** Колонки compact-grid (совпадают с breakpoints в ClientCompactGridBlock). */
export function useDealerCompactGridColumnCount(): number {
  const [columns, setColumns] = useState(1);

  useLayoutEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1280) setColumns(4);
      else if (w >= 1024) setColumns(3);
      else if (w >= 380) setColumns(2);
      else setColumns(1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return columns;
}

/** Колонки large-grid (1 / 2 / 3 по breakpoints trade-points). */
export function useDealerLargeGridColumnCount(): number {
  const [columns, setColumns] = useState(1);

  useLayoutEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1280) setColumns(3);
      else if (w >= 768) setColumns(2);
      else setColumns(1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return columns;
}

export function dealerBaseVirtualItemStyle(
  virtualizer: Virtualizer<Window, Element>,
  start: number,
): { position: "absolute"; top: number; left: number; width: "100%"; transform: string } {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    transform: `translateY(${start - virtualizer.options.scrollMargin}px)`,
  };
}
