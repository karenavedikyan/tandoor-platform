import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  hasUnsavedActualizationChanges,
  useActualizationSaveStatus,
} from "@/lib/client-base-actualization-save-status";
import { DealerTpOverridesSyncStatus } from "@/components/dealer-tp-overrides-sync-status";
import { isStrictCoveredField } from "@/lib/use-dealer-field-saver";

function relativeLabel(iso: string | null): string {
  if (!iso) return "нет даты";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "нет даты";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 10) return "только что";
  if (diffSec < 60) return `${diffSec} сек назад`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour} ч назад`;
}

export type SaveStatusBadgeProps = {
  scope?: "actualization-blob" | "dealer-tp-overrides";
  dealerId?: string;
  tpId?: string;
  field?: string;
};

export function SaveStatusBadge(props: SaveStatusBadgeProps = {}): ReactElement {
  const useOverridesStatus =
    props.scope === "dealer-tp-overrides" || (props.field != null && isStrictCoveredField(props.field));
  if (useOverridesStatus) {
    return <DealerTpOverridesSyncStatus dealerId={props.dealerId} tpId={props.tpId} compact />;
  }
  const status = useActualizationSaveStatus();
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedActualizationChanges()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!hasUnsavedActualizationChanges()) return;
      const target = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!target) return;
      const href = target.getAttribute("href") ?? "";
      if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (window.confirm("Есть несохранённые изменения. Уйти?")) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const view = useMemo(() => {
    if (status.pendingChanges > 0 && status.state === "saved") {
      return {
        label: "Есть несохранённые изменения",
        tone: "warning" as const,
        spin: false,
      };
    }
    if (status.state === "saving") return { label: "Сохраняем…", tone: "muted" as const, spin: true };
    if (status.state === "error" || status.state === "offline") {
      return { label: status.state === "offline" ? "Не сохранено · offline" : "Не сохранено", tone: "error" as const, spin: false };
    }
    return { label: `Сохранено • ${relativeLabel(status.lastSavedAtServer ?? status.lastSavedAt)}`, tone: "saved" as const, spin: false };
  }, [status]);

  const onClick = () => {
    if (status.state === "error" || status.state === "offline") {
      toast({
        title: "Не сохранено в облаке",
        description: status.lastError ?? "Последнее сохранение не подтверждено сервером.",
        variant: "destructive",
      });
    }
  };

  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 max-w-[15rem] items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium shadow-sm transition-colors",
        view.tone === "saved" && "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
        view.tone === "muted" && "border-border bg-muted text-muted-foreground",
        view.tone === "error" && "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200",
        view.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
      )}
      title={status.lastSavedAtServer ?? status.lastSavedAt ?? status.lastError ?? undefined}
      onClick={onClick}
      data-testid="badge-actualization-save-status"
    >
      {view.spin ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            view.tone === "saved" && "bg-emerald-500",
            view.tone === "muted" && "bg-muted-foreground",
            view.tone === "error" && "bg-red-500",
            view.tone === "warning" && "bg-amber-500",
          )}
          aria-hidden
        />
      )}
      <span className="truncate">{view.label}</span>
    </button>
  );
}
