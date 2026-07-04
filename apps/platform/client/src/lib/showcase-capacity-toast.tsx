import * as React from "react";
import { ToastAction } from "../components/ui/toast.js";
import { toast } from "../hooks/use-toast.js";
import {
  focusShowcaseCapacityField,
  SHOWCASE_TYPE_LABEL_RU,
  type ShowcaseTypeKey,
} from "./showcase-type-capacity.js";
import { formatShowcaseCapacityAutoGrowToastDescription } from "./showcase-capacity-autogrow-on-save.js";

const DEBOUNCE_MS = 2000;

type ToastEntry = {
  lastAt: number;
  dismiss: () => void;
  update: ReturnType<typeof toast>["update"];
};

const recentByKey = new Map<string, ToastEntry>();

function toastKey(tradePointId: string, type: ShowcaseTypeKey): string {
  return `${tradePointId}:${type}`;
}

export function notifyShowcaseCapacityAutoGrow(params: {
  tradePointId: string;
  type: ShowcaseTypeKey;
  oldCapacity: number;
  nextCapacity: number;
  suppress?: boolean;
}): void {
  const { tradePointId, type, oldCapacity, nextCapacity, suppress } = params;
  if (suppress) return;
  const key = toastKey(tradePointId, type);
  const now = Date.now();
  const existing = recentByKey.get(key);

  const title = `Моделей ${SHOWCASE_TYPE_LABEL_RU[type]} больше, чем витрин`;
  const description = formatShowcaseCapacityAutoGrowToastDescription(type, oldCapacity, nextCapacity);
  const action = (
    <ToastAction altText="Уточнить" onClick={() => focusShowcaseCapacityField(type)}>
      Уточнить
    </ToastAction>
  );
  const toastProps = {
    title,
    description,
    action,
    duration: 6000,
    className: "border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-50",
  };

  if (existing && now - existing.lastAt < DEBOUNCE_MS) {
    existing.update(toastProps);
    existing.lastAt = now;
    return;
  }

  if (existing) {
    existing.dismiss();
    recentByKey.delete(key);
  }

  const t = toast(toastProps);

  recentByKey.set(key, {
    lastAt: now,
    dismiss: t.dismiss,
    update: t.update,
  });
}
