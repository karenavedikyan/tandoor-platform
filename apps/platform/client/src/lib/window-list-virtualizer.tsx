/**
 * Общая window-виртуализация для тяжёлых списков (Промт 381).
 * Шаблон: dealer-base-list-window-virtualizer.tsx
 */

import { useLayoutEffect, useState, type RefObject, type ReactNode } from "react";
import { useWindowVirtualizer, type Virtualizer } from "@tanstack/react-virtual";

/** Включать виртуализацию только при >= 100 строк (Ctrl+F на малых списках). */
export const LARGE_LIST_VIRTUAL_THRESHOLD = 100;

export const LARGE_LIST_OVERSCAN = 5;

function measureScrollMargin(el: HTMLElement | null): number {
  if (!el || typeof window === "undefined") return 0;
  const rect = el.getBoundingClientRect();
  return rect.top + window.scrollY;
}

export function useLargeListScrollMargin(listRef: RefObject<HTMLElement | null>, deps: unknown[] = []): number {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listRef, ...deps]);

  return scrollMargin;
}

export type LargeListWindowVirtualizerOptions = {
  count: number;
  estimateSize: number;
  overscan?: number;
  scrollMargin: number;
  enabled?: boolean;
};

export function useLargeListWindowVirtualizer({
  count,
  estimateSize,
  overscan = LARGE_LIST_OVERSCAN,
  scrollMargin,
  enabled = true,
}: LargeListWindowVirtualizerOptions): Virtualizer<Window, Element> | null {
  const virtualizer = useWindowVirtualizer({
    count: enabled ? count : 0,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin,
  });
  return enabled ? virtualizer : null;
}

export function largeListVirtualItemStyle(
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

export function shouldVirtualizeLargeList(length: number, threshold = LARGE_LIST_VIRTUAL_THRESHOLD): boolean {
  return length >= threshold;
}

type VirtualizedStackListProps<T> = {
  items: T[];
  estimateSize: number;
  threshold?: number;
  listRef: RefObject<HTMLDivElement | null>;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  "data-testid"?: string;
  rowTestIdPrefix?: string;
};

/** Вертикальный список карточек с window-виртуализацией при length >= threshold. */
export function VirtualizedStackList<T>({
  items,
  estimateSize,
  threshold = LARGE_LIST_VIRTUAL_THRESHOLD,
  listRef,
  getKey,
  renderItem,
  className,
  "data-testid": testId,
  rowTestIdPrefix,
}: VirtualizedStackListProps<T>): React.ReactElement {
  const useVirtual = shouldVirtualizeLargeList(items.length, threshold);
  const scrollMargin = useLargeListScrollMargin(listRef, [items.length, useVirtual]);
  const virtualizer = useLargeListWindowVirtualizer({
    count: items.length,
    estimateSize,
    scrollMargin,
    enabled: useVirtual,
  });

  if (!useVirtual || !virtualizer) {
    return (
      <div ref={listRef} className={className} data-testid={testId}>
        {items.map((item, index) => (
          <div key={getKey(item, index)} data-testid={rowTestIdPrefix ? `${rowTestIdPrefix}-${getKey(item, index)}` : undefined}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={listRef}
      className={className}
      data-testid={testId}
      style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
    >
      {virtualItems.map((vItem) => {
        const item = items[vItem.index]!;
        const key = getKey(item, vItem.index);
        return (
          <div
            key={key}
            data-index={vItem.index}
            ref={virtualizer.measureElement}
            data-testid={rowTestIdPrefix ? `${rowTestIdPrefix}-${key}` : undefined}
            style={largeListVirtualItemStyle(virtualizer, vItem.start)}
          >
            {renderItem(item, vItem.index)}
          </div>
        );
      })}
    </div>
  );
}
