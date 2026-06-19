/**
 * /trash — Корзина и Архив клиентов / торговых точек (Промт 45, 70.4, 70.5).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Archive, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { BackNav } from "@/components/navigation/back-nav";
import { breadcrumbsFor } from "@/lib/navigation/route-hierarchy";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientAvatar } from "@/components/ui/client-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useSidebarNavRealScope } from "@/hooks/use-sidebar-nav-real-scope";
import { useTeamContext } from "@/hooks/use-team-context";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import {
  mergeActualizationState,
  type TrashedDealerInfo,
  type TrashedTradePointInfo,
} from "@/lib/client-base-actualization-state";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/format-display-date";
import { getReleaseClients } from "@/lib/release-client-data";
import {
  ARCHIVE_PAGE_SIZE,
  buildArchivedDealerDisplay,
  buildArchivedTpDisplay,
  buildReleaseClientByDealerId,
  forceDeleteArchivedDealersPatch,
  forceDeleteArchivedTpsPatch,
  restoreArchivedDealersPatch,
  restoreArchivedTpsPatch,
  sortArchivedDealers,
  sortArchivedTps,
  type ArchiveDealerSort,
  type ArchivedDealerDisplay,
  type ArchivedTpDisplay,
} from "@/lib/trash-archive-helpers";
import { resolveTrashedDealerDisplayName } from "@/lib/client-base-actualization-visibility";
import { useDealerTpOverridesHydration } from "@/hooks/use-dealer-tp-overrides-hydration";
import { untrashDealerStrict, requestPurgeDealerStrict } from "@/lib/dealer-overrides-api";
import { hydrateDealerOverridesFromServer } from "@/lib/dealer-overrides-sync";
import { untrashTradePointStrict, requestPurgeTradePointStrict } from "@/lib/trade-point-overrides-api";
import { hydrateTradePointOverridesFromServer } from "@/lib/dealer-overrides-sync";
import {
  mergeTrashedDealersForUi,
  mergeTrashedTradePointsForUi,
  patchDealerTrashRuntime,
  patchDealerPurgePendingRuntime,
  patchTradePointTrashRuntime,
  patchTradePointPurgePendingRuntime,
} from "@/lib/dealer-overrides-runtime";
import { buildArchiveScopeFilter, buildTrashScopeFilter, trashMetaFromDealerInfo, trashMetaFromTradePointInfo, archiveMetaFromDealerInfo, archiveMetaFromTradePointInfo } from "@/lib/dealer-trash-scope";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import { TrashBinSkeleton } from "@/components/skeletons/trash-bin-skeleton";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { VirtualizedStackList } from "@/lib/window-list-virtualizer";

type ConfirmKind =
  | { kind: "force-delete-dealer"; dealerId: string; name: string }
  | { kind: "force-delete-tp"; tradePointId: string; name: string }
  | { kind: "request-purge-dealer"; dealerId: string; name: string }
  | { kind: "request-purge-tp"; tradePointId: string; name: string }
  | { kind: "request-purge-all-dealers"; count: number; ids: string[] }
  | { kind: "request-purge-all-tps"; count: number; ids: string[] }
  | { kind: "request-purge-selected-dealers"; count: number; ids: string[] }
  | { kind: "request-purge-selected-tps"; count: number; ids: string[] }
  | { kind: "restore-all-archived-dealers"; count: number }
  | { kind: "restore-all-archived-tps"; count: number }
  | { kind: "move-archived-dealers-to-trash"; count: number; ids: string[] }
  | { kind: "move-archived-tps-to-trash"; count: number; ids: string[] }
  | { kind: "force-delete-archived-dealers"; count: number; ids: string[] }
  | { kind: "force-delete-archived-tps"; count: number; ids: string[] };

function compareByExpires(a: TrashedDealerInfo | TrashedTradePointInfo, b: TrashedDealerInfo | TrashedTradePointInfo): number {
  return Date.parse(a.expiresAt) - Date.parse(b.expiresAt);
}

function useArchivePagination(total: number, page: number): { pageIndex: number; from: number; to: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(total / ARCHIVE_PAGE_SIZE));
  const pageIndex = Math.min(Math.max(0, page), pageCount - 1);
  const from = pageIndex * ARCHIVE_PAGE_SIZE;
  const to = Math.min(from + ARCHIVE_PAGE_SIZE, total);
  return { pageIndex, from, to, pageCount };
}

export function TrashBinPage(): ReactElement {
  useDealerTpOverridesHydration(true);
  const { user } = useAuthUser();
  const { profile } = useReleaseDemoProfile();
  const realScope = useSidebarNavRealScope(true);
  const { teamContext } = useTeamContext(true);
  const actx = useClientBaseActualization();
  const teamPlane = useClientBaseTeamActualization();
  const [trashTab, setTrashTab] = useState<"clients" | "tps">("clients");
  const [archiveTab, setArchiveTab] = useState<"clients" | "tps">("clients");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmFD, setConfirmFD] = useState<ConfirmKind | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);

  const [archiveDealerSearch, setArchiveDealerSearch] = useState("");
  const [archiveDealerSort, setArchiveDealerSort] = useState<ArchiveDealerSort>("archived_desc");
  const [archiveDealerPage, setArchiveDealerPage] = useState(0);
  const [selectedArchivedDealerIds, setSelectedArchivedDealerIds] = useState<Set<string>>(() => new Set());

  const [archiveTpSearch, setArchiveTpSearch] = useState("");
  const [archiveTpSort, setArchiveTpSort] = useState<ArchiveDealerSort>("archived_desc");
  const [archiveTpPage, setArchiveTpPage] = useState(0);
  const [selectedArchivedTpIds, setSelectedArchivedTpIds] = useState<Set<string>>(() => new Set());

  const [selectedTrashDealerIds, setSelectedTrashDealerIds] = useState<Set<string>>(() => new Set());
  const [selectedTrashTpIds, setSelectedTrashTpIds] = useState<Set<string>>(() => new Set());

  const canForceDelete = user?.role === "admin" || user?.role === "director";
  const canRunPurge = user?.role === "admin";

  const useTeamState = shouldUseTeamMergedActualizationPlane(profile, user?.role);
  const stateForRead = useMemo(
    () => (useTeamState ? teamPlane.mergedState : actx.state),
    [useTeamState, teamPlane.mergedState, actx.state],
  );

  useEffect(() => {
    if (!user?.id || !actx.enabled) return;
    void actx.refresh();
  }, [user?.id, actx.enabled, actx.refresh]);
  const releaseByDealerId = useMemo(() => buildReleaseClientByDealerId(getReleaseClients()), []);

  const trashScopeFilter = useMemo(
    () =>
      buildTrashScopeFilter({
        role: user?.role ?? null,
        profile,
        realScope,
        userId: user?.id ?? null,
        teamContext,
      }),
    [user?.role, user?.id, profile, realScope, teamContext],
  );

  const archiveScopeFilter = useMemo(
    () =>
      buildArchiveScopeFilter({
        role: user?.role ?? null,
        profile,
        realScope,
        teamContext,
      }),
    [user?.role, profile, realScope, teamContext],
  );

  const trashDealersListRef = useRef<HTMLDivElement>(null);
  const trashTpsListRef = useRef<HTMLDivElement>(null);

  useScrollRestoration({ enabled: !actx.loading });

  const trashedDealerDisplays = useMemo(() => {
    if (!stateForRead.updatedAt && user?.role === "manager") return [];
    const map = mergeTrashedDealersForUi(stateForRead);
    return Object.values(map)
      .filter(
        (d) =>
          trashScopeFilter.fullView ||
          trashScopeFilter.isDealerInScope(d.dealerId, trashMetaFromDealerInfo(d)),
      )
      .map((info) => resolveTrashedDealerDisplayName(info, stateForRead, releaseByDealerId))
      .sort((a, b) => compareByExpires(a.info, b.info));
  }, [stateForRead, trashScopeFilter, releaseByDealerId, user?.role]);
  const trashedDealers = useMemo(() => trashedDealerDisplays.map((d) => d.info), [trashedDealerDisplays]);
  const trashedTps = useMemo(() => {
    if (!stateForRead.updatedAt && user?.role === "manager") return [];
    const map = mergeTrashedTradePointsForUi(stateForRead);
    return Object.values(map)
      .filter(
        (t) =>
          trashScopeFilter.fullView ||
          trashScopeFilter.isTradePointInScope(
            t.tradePointId,
            t.dealerId ?? null,
            trashMetaFromTradePointInfo(t),
          ),
      )
      .sort(compareByExpires);
  }, [stateForRead, trashScopeFilter, user?.role]);

  const archivedDealerDisplays = useMemo(() => {
    if (!stateForRead.updatedAt && user?.role === "manager") return [];
    const map = stateForRead.archivedDealersById ?? {};
    return Object.values(map)
      .filter(
        (d) =>
          archiveScopeFilter.fullView ||
          archiveScopeFilter.isDealerInScope(d.dealerId, archiveMetaFromDealerInfo(d)),
      )
      .map((info) => buildArchivedDealerDisplay(info, stateForRead, releaseByDealerId));
  }, [stateForRead, releaseByDealerId, archiveScopeFilter, user?.role]);

  const archivedTpDisplays = useMemo(() => {
    if (!stateForRead.updatedAt && user?.role === "manager") return [];
    const map = stateForRead.archivedTradePointsById ?? {};
    return Object.values(map)
      .filter(
        (t) =>
          archiveScopeFilter.fullView ||
          archiveScopeFilter.isTradePointInScope(
            t.tradePointId,
            t.dealerId ?? null,
            archiveMetaFromTradePointInfo(t),
          ),
      )
      .map((info) => buildArchivedTpDisplay(info, stateForRead, releaseByDealerId));
  }, [stateForRead, releaseByDealerId, archiveScopeFilter, user?.role]);

  const filteredArchivedDealers = useMemo(() => {
    const q = archiveDealerSearch.trim().toLowerCase();
    let rows = archivedDealerDisplays;
    if (q) rows = rows.filter((r) => r.searchBlob.includes(q));
    return sortArchivedDealers(rows, archiveDealerSort);
  }, [archivedDealerDisplays, archiveDealerSearch, archiveDealerSort]);

  const filteredArchivedTps = useMemo(() => {
    const q = archiveTpSearch.trim().toLowerCase();
    let rows = archivedTpDisplays;
    if (q) rows = rows.filter((r) => r.searchBlob.includes(q));
    return sortArchivedTps(rows, archiveTpSort);
  }, [archivedTpDisplays, archiveTpSearch, archiveTpSort]);

  const dealerPageMeta = useArchivePagination(filteredArchivedDealers.length, archiveDealerPage);
  const tpPageMeta = useArchivePagination(filteredArchivedTps.length, archiveTpPage);

  const pagedArchivedDealers = useMemo(
    () => filteredArchivedDealers.slice(dealerPageMeta.from, dealerPageMeta.to),
    [filteredArchivedDealers, dealerPageMeta.from, dealerPageMeta.to],
  );
  const pagedArchivedTps = useMemo(
    () => filteredArchivedTps.slice(tpPageMeta.from, tpPageMeta.to),
    [filteredArchivedTps, tpPageMeta.from, tpPageMeta.to],
  );

  useEffect(() => {
    setArchiveDealerPage(0);
  }, [archiveDealerSearch, archiveDealerSort, archivedDealerDisplays.length]);

  useEffect(() => {
    setArchiveTpPage(0);
  }, [archiveTpSearch, archiveTpSort, archivedTpDisplays.length]);

  useEffect(() => {
    const allowed = new Set(filteredArchivedDealers.map((r) => r.dealerId));
    setSelectedArchivedDealerIds((prev) => {
      const n = new Set<string>();
      let changed = false;
      prev.forEach((id) => {
        if (allowed.has(id)) n.add(id);
        else changed = true;
      });
      return changed || n.size !== prev.size ? n : prev;
    });
  }, [filteredArchivedDealers]);

  useEffect(() => {
    const allowed = new Set(filteredArchivedTps.map((r) => r.tradePointId));
    setSelectedArchivedTpIds((prev) => {
      const n = new Set<string>();
      let changed = false;
      prev.forEach((id) => {
        if (allowed.has(id)) n.add(id);
        else changed = true;
      });
      return changed || n.size !== prev.size ? n : prev;
    });
  }, [filteredArchivedTps]);

  useEffect(() => {
    setSelectedTrashDealerIds(new Set());
    setSelectedTrashTpIds(new Set());
  }, [trashTab]);

  useEffect(() => {
    const allowed = new Set(trashedDealerDisplays.map((d) => d.info.dealerId));
    setSelectedTrashDealerIds((prev) => {
      const n = new Set<string>();
      let changed = false;
      prev.forEach((id) => {
        if (allowed.has(id)) n.add(id);
        else changed = true;
      });
      return changed || n.size !== prev.size ? n : prev;
    });
  }, [trashedDealerDisplays]);

  useEffect(() => {
    const allowed = new Set(trashedTps.map((t) => t.tradePointId));
    setSelectedTrashTpIds((prev) => {
      const n = new Set<string>();
      let changed = false;
      prev.forEach((id) => {
        if (allowed.has(id)) n.add(id);
        else changed = true;
      });
      return changed || n.size !== prev.size ? n : prev;
    });
  }, [trashedTps]);

  const earliestExpires = useMemo(() => {
    const all = [...trashedDealers, ...trashedTps];
    if (all.length === 0) return null;
    const ms = all
      .map((t) => Date.parse(t.expiresAt))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)[0];
    return ms ? new Date(ms).toISOString() : null;
  }, [trashedDealers, trashedTps]);

  const afterPersist = useCallback(
    (r: { success: boolean }, okTitle: string, failTitle: string) => {
      if (r.success) {
        toast({ title: okTitle });
        void teamPlane.refresh();
      } else {
        toast({ title: failTitle, variant: "destructive" });
      }
    },
    [teamPlane],
  );

  const onRestoreDealer = async (dealerId: string): Promise<void> => {
    if (busy) return;
    setBusy(`restore-dealer:${dealerId}`);
    const r = await untrashDealerStrict(dealerId);
    setBusy(null);
    if (r.ok) {
      patchDealerTrashRuntime(dealerId, null);
      await hydrateDealerOverridesFromServer();
      toast({ title: "Клиент восстановлен в рабочую базу" });
      void teamPlane.refresh();
    } else {
      toast({
        title: "Не удалось восстановить",
        description: r.message ?? "Ошибка запроса",
        variant: "destructive",
      });
    }
  };

  const onRestoreTp = async (tp: TrashedTradePointInfo): Promise<void> => {
    if (busy) return;
    if (mergeTrashedDealersForUi(stateForRead)[tp.dealerId]) {
      toast({
        title: "Сначала восстановите клиента",
        description: "Клиент-владелец этой точки находится в корзине.",
        variant: "destructive",
      });
      return;
    }
    setBusy(`restore-tp:${tp.tradePointId}`);
    const r = await untrashTradePointStrict(tp.tradePointId);
    setBusy(null);
    if (r.ok) {
      patchTradePointTrashRuntime(tp.tradePointId, null);
      await hydrateTradePointOverridesFromServer();
      toast({ title: "Торговая точка восстановлена" });
      void teamPlane.refresh();
    } else {
      toast({
        title: "Не удалось восстановить",
        description: r.message ?? "Ошибка запроса",
        variant: "destructive",
      });
    }
  };

  const onRequestPurgeDealer = async (dealerId: string): Promise<void> => {
    if (busy) return;
    setBusy(`request-purge-dealer:${dealerId}`);
    patchDealerTrashRuntime(dealerId, null);
    patchDealerPurgePendingRuntime(dealerId, true);
    const r = await requestPurgeDealerStrict(dealerId);
    setBusy(null);
    if (r.ok) {
      toast({ title: "Запись отправлена админу на окончательное удаление" });
      void actx.refresh();
      void teamPlane.refresh();
    } else {
      toast({ title: r.message ?? "Не удалось отправить на удаление", variant: "destructive" });
    }
  };

  const onRequestPurgeTp = async (tradePointId: string): Promise<void> => {
    if (busy) return;
    setBusy(`request-purge-tp:${tradePointId}`);
    patchTradePointTrashRuntime(tradePointId, null);
    patchTradePointPurgePendingRuntime(tradePointId, true);
    const r = await requestPurgeTradePointStrict(tradePointId);
    setBusy(null);
    if (r.ok) {
      toast({ title: "Запись отправлена админу на окончательное удаление" });
      void actx.refresh();
      void teamPlane.refresh();
    } else {
      toast({ title: r.message ?? "Не удалось отправить на удаление", variant: "destructive" });
    }
  };

  const onRequestPurgeAllDealers = async (ids: string[]): Promise<void> => {
    if (busy || ids.length === 0) return;
    setBusy("request-purge-all-dealers");
    try {
      let ok = 0;
      for (const id of ids) {
        patchDealerTrashRuntime(id, null);
        patchDealerPurgePendingRuntime(id, true);
        const r = await requestPurgeDealerStrict(id);
        if (r.ok) ok++;
      }
      toast({
        title: ok === ids.length ? "Корзина очищена" : `Отправлено ${ok} из ${ids.length}`,
        variant: ok === 0 ? "destructive" : undefined,
      });
      void actx.refresh();
      void teamPlane.refresh();
    } finally {
      setBusy(null);
    }
  };

  const onRequestPurgeAllTps = async (ids: string[]): Promise<void> => {
    if (busy || ids.length === 0) return;
    setBusy("request-purge-all-tps");
    try {
      let ok = 0;
      for (const id of ids) {
        patchTradePointTrashRuntime(id, null);
        patchTradePointPurgePendingRuntime(id, true);
        const r = await requestPurgeTradePointStrict(id);
        if (r.ok) ok++;
      }
      toast({
        title: ok === ids.length ? "Корзина очищена" : `Отправлено ${ok} из ${ids.length}`,
        variant: ok === 0 ? "destructive" : undefined,
      });
      void actx.refresh();
      void teamPlane.refresh();
    } finally {
      setBusy(null);
    }
  };

  const onBulkRestoreTrashDealers = async (ids: string[]): Promise<void> => {
    if (busy || ids.length === 0) return;
    setBusy("bulk-restore-trash-dealers");
    try {
      for (const id of ids) patchDealerTrashRuntime(id, null);
      const res = await fetch("/api/dealer-overrides/bulk-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ dealer_ids: ids }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: { restored?: number; skipped?: number };
      };
      if (!res.ok || json.success !== true) {
        throw new Error(json.message ?? `HTTP ${res.status}`);
      }
      const restored = json.data?.restored ?? ids.length;
      const skipped = json.data?.skipped ?? 0;
      toast({
        title: "Восстановлено",
        description: skipped > 0 ? `Восстановлено: ${restored}, пропущено: ${skipped}` : `Восстановлено: ${restored}`,
      });
      setSelectedTrashDealerIds(new Set());
      await actx.refresh();
      void teamPlane.refresh();
    } catch (e: unknown) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const onBulkRequestPurgeTrashDealers = async (ids: string[]): Promise<void> => {
    if (busy || ids.length === 0) return;
    setBusy("bulk-request-purge-trash-dealers");
    try {
      for (const id of ids) {
        patchDealerTrashRuntime(id, null);
        patchDealerPurgePendingRuntime(id, true);
      }
      const res = await fetch("/api/dealer-overrides/bulk-request-purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ dealer_ids: ids }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: { requestedPurge?: number; skipped?: number };
      };
      if (!res.ok || json.success !== true) {
        throw new Error(json.message ?? `HTTP ${res.status}`);
      }
      const requestedPurge = json.data?.requestedPurge ?? ids.length;
      const skipped = json.data?.skipped ?? 0;
      toast({
        title: "Отправлено на удаление",
        description:
          skipped > 0
            ? `Отправлено: ${requestedPurge}, пропущено: ${skipped}`
            : `Отправлено на удаление: ${requestedPurge}`,
      });
      setSelectedTrashDealerIds(new Set());
      await actx.refresh();
      void teamPlane.refresh();
    } catch (e: unknown) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const onBulkRestoreTrashTps = async (ids: string[]): Promise<void> => {
    if (busy || ids.length === 0) return;
    setBusy("bulk-restore-trash-tps");
    try {
      for (const id of ids) patchTradePointTrashRuntime(id, null);
      const res = await fetch("/api/trade-point-overrides/bulk-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ trade_point_ids: ids }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: { restored?: number; skipped?: number };
      };
      if (!res.ok || json.success !== true) {
        throw new Error(json.message ?? `HTTP ${res.status}`);
      }
      const restored = json.data?.restored ?? ids.length;
      const skipped = json.data?.skipped ?? 0;
      toast({
        title: "Восстановлено",
        description: skipped > 0 ? `Восстановлено: ${restored}, пропущено: ${skipped}` : `Восстановлено: ${restored}`,
      });
      setSelectedTrashTpIds(new Set());
      await actx.refresh();
      void teamPlane.refresh();
    } catch (e: unknown) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const onBulkRequestPurgeTrashTps = async (ids: string[]): Promise<void> => {
    if (busy || ids.length === 0) return;
    setBusy("bulk-request-purge-trash-tps");
    try {
      for (const id of ids) {
        patchTradePointTrashRuntime(id, null);
        patchTradePointPurgePendingRuntime(id, true);
      }
      const res = await fetch("/api/trade-point-overrides/bulk-request-purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ trade_point_ids: ids }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: { requestedPurge?: number; skipped?: number };
      };
      if (!res.ok || json.success !== true) {
        throw new Error(json.message ?? `HTTP ${res.status}`);
      }
      const requestedPurge = json.data?.requestedPurge ?? ids.length;
      const skipped = json.data?.skipped ?? 0;
      toast({
        title: "Отправлено на удаление",
        description:
          skipped > 0
            ? `Отправлено: ${requestedPurge}, пропущено: ${skipped}`
            : `Отправлено на удаление: ${requestedPurge}`,
      });
      setSelectedTrashTpIds(new Set());
      await actx.refresh();
      void teamPlane.refresh();
    } catch (e: unknown) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const onForceDeleteDealer = async (dealerId: string): Promise<void> => {
    if (busy) return;
    setBusy(`force-dealer:${dealerId}`);
    const r = await actx.persist(
      (prev) => {
        const next = { ...prev.trashedDealersById };
        delete next[dealerId];
        return mergeActualizationState(prev, { trashedDealersById: next });
      },
      { unTrash: { dealers: [dealerId] } },
    );
    setBusy(null);
    afterPersist(r, "Клиент удалён окончательно", "Не удалось удалить");
  };

  const onForceDeleteTp = async (tradePointId: string): Promise<void> => {
    if (busy) return;
    setBusy(`force-tp:${tradePointId}`);
    const r = await actx.persist(
      (prev) => {
        const next = { ...prev.trashedTradePointsById };
        delete next[tradePointId];
        return mergeActualizationState(prev, { trashedTradePointsById: next });
      },
      { unTrash: { tradePoints: [tradePointId] } },
    );
    setBusy(null);
    afterPersist(r, "Торговая точка удалена окончательно", "Не удалось удалить");
  };

  const onRestoreAllArchivedDealers = async (count: number): Promise<void> => {
    if (busy || count === 0) return;
    setBusy("restore-all-archived-dealers");
    try {
      const r = await actx.persist((prev) => mergeActualizationState(prev, { archivedDealersById: {} }));
      afterPersist(r, `Восстановлено ${count} клиентов. Они снова в активной базе.`, "Не удалось восстановить");
      setSelectedArchivedDealerIds(new Set());
    } finally {
      setBusy(null);
    }
  };

  const onRestoreAllArchivedTps = async (count: number): Promise<void> => {
    if (busy || count === 0) return;
    setBusy("restore-all-archived-tps");
    try {
      const r = await actx.persist((prev) => mergeActualizationState(prev, { archivedTradePointsById: {} }));
      afterPersist(r, `Восстановлено ${count} торговых точек.`, "Не удалось восстановить");
      setSelectedArchivedTpIds(new Set());
    } finally {
      setBusy(null);
    }
  };

  const onRestoreArchivedDealers = async (ids: string[]): Promise<void> => {
    if (busy || ids.length === 0) return;
    setBusy("restore-archived-dealers");
    try {
      const r = await actx.persist((prev) => restoreArchivedDealersPatch(prev, ids));
      afterPersist(r, `Восстановлено ${ids.length} клиентов`, "Не удалось восстановить");
      setSelectedArchivedDealerIds(new Set());
    } finally {
      setBusy(null);
    }
  };

  const onRestoreOneArchivedDealer = async (dealerId: string): Promise<void> => {
    await onRestoreArchivedDealers([dealerId]);
  };

  const onRestoreArchivedTps = async (ids: string[]): Promise<void> => {
    if (busy || ids.length === 0) return;
    setBusy("restore-archived-tps");
    try {
      const r = await actx.persist((prev) => restoreArchivedTpsPatch(prev, ids));
      afterPersist(r, `Восстановлено ${ids.length} торговых точек`, "Не удалось восстановить");
      setSelectedArchivedTpIds(new Set());
    } finally {
      setBusy(null);
    }
  };

  const onRestoreOneArchivedTp = async (tradePointId: string): Promise<void> => {
    await onRestoreArchivedTps([tradePointId]);
  };

  const onMoveArchivedDealersToTrash = async (ids: string[]): Promise<void> => {
    if (busy || ids.length === 0) return;
    setBusy("move-archived-dealers-to-trash");
    try {
      const res = await fetch("/api/dealer-overrides/bulk-move-archive-to-trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ dealer_ids: ids }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: { moved?: number; skipped?: number };
      };
      if (!res.ok || json.success !== true) {
        toast({
          title: "Не удалось переместить",
          description: json.message ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      const moved = json.data?.moved ?? ids.length;
      const skipped = json.data?.skipped ?? 0;
      toast({
        title:
          skipped > 0
            ? `Перемещено ${moved}, пропущено ${skipped} (вне вашей зоны ответственности)`
            : `Перемещено ${moved} клиентов в Корзину`,
      });
      setSelectedArchivedDealerIds(new Set());
      await actx.refresh();
      void teamPlane.refresh();
    } finally {
      setBusy(null);
    }
  };

  const onMoveArchivedTpsToTrash = async (ids: string[]): Promise<void> => {
    if (busy || ids.length === 0) return;
    setBusy("move-archived-tps-to-trash");
    try {
      const res = await fetch("/api/trade-point-overrides/bulk-move-archive-to-trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ trade_point_ids: ids }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        message?: string;
        data?: { moved?: number; skipped?: number };
      };
      if (!res.ok || json.success !== true) {
        toast({
          title: "Не удалось переместить",
          description: json.message ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      const moved = json.data?.moved ?? ids.length;
      const skipped = json.data?.skipped ?? 0;
      toast({
        title:
          skipped > 0
            ? `Перемещено ${moved}, пропущено ${skipped} (вне вашей зоны ответственности)`
            : `Перемещено ${moved} торговых точек в Корзину`,
      });
      setSelectedArchivedTpIds(new Set());
      await actx.refresh();
      void teamPlane.refresh();
    } finally {
      setBusy(null);
    }
  };

  const onForceDeleteArchivedDealers = async (ids: string[]): Promise<void> => {
    if (busy || ids.length === 0) return;
    setBusy("force-delete-archived-dealers");
    try {
      const r = await actx.persist((prev) => forceDeleteArchivedDealersPatch(prev, ids));
      afterPersist(r, `Удалено ${ids.length} клиентов`, "Не удалось удалить");
      setSelectedArchivedDealerIds(new Set());
    } finally {
      setBusy(null);
    }
  };

  const onForceDeleteArchivedTps = async (ids: string[]): Promise<void> => {
    if (busy || ids.length === 0) return;
    setBusy("force-delete-archived-tps");
    try {
      const r = await actx.persist((prev) => forceDeleteArchivedTpsPatch(prev, ids));
      afterPersist(r, `Удалено ${ids.length} торговых точек`, "Не удалось удалить");
      setSelectedArchivedTpIds(new Set());
    } finally {
      setBusy(null);
    }
  };

  const onRunPurge = async (): Promise<void> => {
    if (purgeBusy) return;
    setPurgeBusy(true);
    try {
      const res = await fetch("/api/cron/purge-trash", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        success?: boolean;
        purgedDealers?: number;
        purgedTradePoints?: number;
        message?: string;
      };
      if (!res.ok || json.success !== true) {
        toast({
          title: "Не удалось запустить очистку",
          description: json.message ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Очистка выполнена",
          description: `Клиентов удалено: ${json.purgedDealers ?? 0}, ТТ: ${json.purgedTradePoints ?? 0}`,
        });
        void teamPlane.refresh();
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : "Сетевая ошибка";
      toast({ title: "Не удалось запустить очистку", description: m, variant: "destructive" });
    } finally {
      setPurgeBusy(false);
    }
  };

  const selectedDealerCount = selectedArchivedDealerIds.size;
  const selectedTpCount = selectedArchivedTpIds.size;
  const selectedTrashDealerCount = selectedTrashDealerIds.size;
  const selectedTrashTpCount = selectedTrashTpIds.size;

  const toggleTrashDealer = (dealerId: string, checked: boolean) => {
    setSelectedTrashDealerIds((prev) => {
      const n = new Set(prev);
      if (checked) n.add(dealerId);
      else n.delete(dealerId);
      return n;
    });
  };

  const toggleTrashTp = (tradePointId: string, checked: boolean) => {
    setSelectedTrashTpIds((prev) => {
      const n = new Set(prev);
      if (checked) n.add(tradePointId);
      else n.delete(tradePointId);
      return n;
    });
  };

  const toggleSelectAllTrashDealers = (checked: boolean) => {
    setSelectedTrashDealerIds(checked ? new Set(trashedDealerDisplays.map((d) => d.info.dealerId)) : new Set());
  };

  const toggleSelectAllTrashTps = (checked: boolean) => {
    setSelectedTrashTpIds(checked ? new Set(trashedTps.map((t) => t.tradePointId)) : new Set());
  };

  const allTrashDealersSelected =
    trashedDealerDisplays.length > 0 &&
    trashedDealerDisplays.every((d) => selectedTrashDealerIds.has(d.info.dealerId));
  const allTrashTpsSelected =
    trashedTps.length > 0 && trashedTps.every((t) => selectedTrashTpIds.has(t.tradePointId));

  const toggleSelectAllFilteredDealers = (checked: boolean) => {
    setSelectedArchivedDealerIds(checked ? new Set(filteredArchivedDealers.map((r) => r.dealerId)) : new Set());
  };

  const toggleSelectAllFilteredTps = (checked: boolean) => {
    setSelectedArchivedTpIds(checked ? new Set(filteredArchivedTps.map((r) => r.tradePointId)) : new Set());
  };

  const allFilteredDealersSelected =
    filteredArchivedDealers.length > 0 && filteredArchivedDealers.every((r) => selectedArchivedDealerIds.has(r.dealerId));
  const allFilteredTpsSelected =
    filteredArchivedTps.length > 0 && filteredArchivedTps.every((r) => selectedArchivedTpIds.has(r.tradePointId));

  const renderTrashDealerToolbar = () => {
    if (trashedDealers.length === 0) return null;
    return (
      <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-lg border border-border/80 bg-card/95 p-3 backdrop-blur-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={allTrashDealersSelected}
                onCheckedChange={(v) => toggleSelectAllTrashDealers(v === true)}
                data-testid="checkbox-trash-dealer-select-all"
              />
              Выбрать всех
            </label>
            <span className="text-sm text-muted-foreground">Выбрано: {selectedTrashDealerCount}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={selectedTrashDealerCount === 0 || Boolean(busy)}
              onClick={() => void onBulkRestoreTrashDealers(Array.from(selectedTrashDealerIds))}
              data-testid="button-trash-restore-selected-dealers"
            >
              Восстановить выбранных ({selectedTrashDealerCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={selectedTrashDealerCount === 0 || Boolean(busy)}
              onClick={() =>
                setConfirmFD({
                  kind: "request-purge-selected-dealers",
                  count: selectedTrashDealerCount,
                  ids: Array.from(selectedTrashDealerIds),
                })
              }
              data-testid="button-trash-request-purge-selected-dealers"
            >
              Удалить выбранных навсегда ({selectedTrashDealerCount})
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderTrashTpToolbar = () => {
    if (trashedTps.length === 0) return null;
    return (
      <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-lg border border-border/80 bg-card/95 p-3 backdrop-blur-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={allTrashTpsSelected}
                onCheckedChange={(v) => toggleSelectAllTrashTps(v === true)}
                data-testid="checkbox-trash-tp-select-all"
              />
              Выбрать всех
            </label>
            <span className="text-sm text-muted-foreground">Выбрано: {selectedTrashTpCount}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={selectedTrashTpCount === 0 || Boolean(busy)}
              onClick={() => void onBulkRestoreTrashTps(Array.from(selectedTrashTpIds))}
              data-testid="button-trash-restore-selected-tps"
            >
              Восстановить выбранных ({selectedTrashTpCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={selectedTrashTpCount === 0 || Boolean(busy)}
              onClick={() =>
                setConfirmFD({
                  kind: "request-purge-selected-tps",
                  count: selectedTrashTpCount,
                  ids: Array.from(selectedTrashTpIds),
                })
              }
              data-testid="button-trash-request-purge-selected-tps"
            >
              Удалить выбранных навсегда ({selectedTrashTpCount})
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderArchivePagination = (
    total: number,
    pageMeta: ReturnType<typeof useArchivePagination>,
    setPage: (n: number) => void,
  ) => {
    if (total === 0) return null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Показано {pageMeta.from + 1}–{pageMeta.to} из {total}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pageMeta.pageIndex <= 0}
            onClick={() => setPage(pageMeta.pageIndex - 1)}
            aria-label="Назад"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pageMeta.pageIndex >= pageMeta.pageCount - 1}
            onClick={() => setPage(pageMeta.pageIndex + 1)}
            aria-label="Вперёд"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderDealerArchiveToolbar = () => {
    if (archivedDealerDisplays.length === 0) return null;
    return (
      <div className="sticky top-0 z-10 space-y-3 rounded-lg border border-border/80 bg-card/95 p-3 backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={archiveDealerSearch}
            onChange={(e) => setArchiveDealerSearch(e.target.value)}
            placeholder="Поиск по имени, ИНН, коду, городу"
            className="min-h-9 flex-1"
            data-testid="input-archive-dealer-search"
          />
          <Select value={archiveDealerSort} onValueChange={(v) => setArchiveDealerSort(v as ArchiveDealerSort)}>
            <SelectTrigger className="w-full sm:w-[220px]" data-testid="select-archive-dealer-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="archived_desc">По дате архивации (новые)</SelectItem>
              <SelectItem value="archived_asc">По дате архивации (старые)</SelectItem>
              <SelectItem value="name_asc">По имени (А–Я)</SelectItem>
              <SelectItem value="name_desc">По имени (Я–А)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={allFilteredDealersSelected}
                onCheckedChange={(v) => toggleSelectAllFilteredDealers(v === true)}
                data-testid="checkbox-archive-dealer-select-all"
              />
              Выбрать все на странице
            </label>
            <span className="text-sm text-muted-foreground">Выбрано: {selectedDealerCount}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={selectedDealerCount === 0 || Boolean(busy)}
              onClick={() => void onRestoreArchivedDealers(Array.from(selectedArchivedDealerIds))}
              data-testid="button-archive-restore-selected-dealers"
            >
              Восстановить выбранных ({selectedDealerCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={selectedDealerCount === 0 || Boolean(busy)}
              onClick={() =>
                setConfirmFD({
                  kind: "move-archived-dealers-to-trash",
                  count: selectedDealerCount,
                  ids: Array.from(selectedArchivedDealerIds),
                })
              }
              data-testid="button-archive-move-selected-dealers-to-trash"
            >
              Переместить выбранных в Корзину ({selectedDealerCount})
            </Button>
            {canForceDelete ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={selectedDealerCount === 0 || Boolean(busy)}
                onClick={() =>
                  setConfirmFD({
                    kind: "force-delete-archived-dealers",
                    count: selectedDealerCount,
                    ids: Array.from(selectedArchivedDealerIds),
                  })
                }
                data-testid="button-archive-force-delete-selected-dealers"
              >
                Удалить выбранных навсегда ({selectedDealerCount})
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              disabled={archivedDealerDisplays.length === 0 || busy === "restore-all-archived-dealers"}
              onClick={() =>
                setConfirmFD({ kind: "restore-all-archived-dealers", count: archivedDealerDisplays.length })
              }
              data-testid="button-trash-restore-all-archived"
            >
              Восстановить всех (полный объём, {archivedDealerDisplays.length})
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderTpArchiveToolbar = () => {
    if (archivedTpDisplays.length === 0) return null;
    return (
      <div className="sticky top-0 z-10 space-y-3 rounded-lg border border-border/80 bg-card/95 p-3 backdrop-blur-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={archiveTpSearch}
            onChange={(e) => setArchiveTpSearch(e.target.value)}
            placeholder="Поиск по имени, адресу, коду, городу"
            className="min-h-9 flex-1"
            data-testid="input-archive-tp-search"
          />
          <Select value={archiveTpSort} onValueChange={(v) => setArchiveTpSort(v as ArchiveDealerSort)}>
            <SelectTrigger className="w-full sm:w-[220px]" data-testid="select-archive-tp-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="archived_desc">По дате архивации (новые)</SelectItem>
              <SelectItem value="archived_asc">По дате архивации (старые)</SelectItem>
              <SelectItem value="name_asc">По имени (А–Я)</SelectItem>
              <SelectItem value="name_desc">По имени (Я–А)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={allFilteredTpsSelected}
                onCheckedChange={(v) => toggleSelectAllFilteredTps(v === true)}
                data-testid="checkbox-archive-tp-select-all"
              />
              Выбрать все на странице
            </label>
            <span className="text-sm text-muted-foreground">Выбрано: {selectedTpCount}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={selectedTpCount === 0 || Boolean(busy)}
              onClick={() => void onRestoreArchivedTps(Array.from(selectedArchivedTpIds))}
            >
              Восстановить выбранных ({selectedTpCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={selectedTpCount === 0 || Boolean(busy)}
              onClick={() =>
                setConfirmFD({
                  kind: "move-archived-tps-to-trash",
                  count: selectedTpCount,
                  ids: Array.from(selectedArchivedTpIds),
                })
              }
            >
              Переместить выбранных в Корзину ({selectedTpCount})
            </Button>
            {canForceDelete ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={selectedTpCount === 0 || Boolean(busy)}
                onClick={() =>
                  setConfirmFD({
                    kind: "force-delete-archived-tps",
                    count: selectedTpCount,
                    ids: Array.from(selectedArchivedTpIds),
                  })
                }
              >
                Удалить выбранных навсегда ({selectedTpCount})
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              disabled={archivedTpDisplays.length === 0 || busy === "restore-all-archived-tps"}
              onClick={() => setConfirmFD({ kind: "restore-all-archived-tps", count: archivedTpDisplays.length })}
            >
              Восстановить всех (полный объём, {archivedTpDisplays.length})
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderDealerArchiveRow = (row: ArchivedDealerDisplay) => {
    const id = row.dealerId;
    const codeBadge = row.releaseCode || row.dealerCode;
    return (
      <Card key={id} className="rounded-xl border border-border bg-card" data-testid={`row-trash-archived-${id}`}>
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
          <Checkbox
            className="mt-1"
            checked={selectedArchivedDealerIds.has(id)}
            onCheckedChange={(v) => {
              setSelectedArchivedDealerIds((prev) => {
                const n = new Set(prev);
                if (v === true) n.add(id);
                else n.delete(id);
                return n;
              });
            }}
            data-testid={`checkbox-archive-dealer-${id}`}
          />
          <ClientAvatar size={36} shape="circle" name={row.name} seed={id} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
              {codeBadge ? (
                <Badge variant="outline" className="font-mono text-[10px]">
                  {codeBadge}
                </Badge>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {[row.city, row.inn ? `ИНН ${row.inn}` : null].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              архивировал {row.info.archivedByName} · {formatDisplayDateTime(row.info.archivedAt)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => void onRestoreOneArchivedDealer(id)}
            >
              Восстановить
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => setConfirmFD({ kind: "move-archived-dealers-to-trash", count: 1, ids: [id] })}
            >
              В Корзину
            </Button>
            {canForceDelete ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={Boolean(busy)}
                onClick={() => setConfirmFD({ kind: "force-delete-archived-dealers", count: 1, ids: [id] })}
              >
                Удалить навсегда
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTpArchiveRow = (row: ArchivedTpDisplay) => {
    const id = row.tradePointId;
    const displayName = row.name || row.tradePointCode || id;
    return (
      <Card key={id} className="rounded-xl border border-border bg-card" data-testid={`row-trash-archived-tp-${id}`}>
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
          <Checkbox
            className="mt-1"
            checked={selectedArchivedTpIds.has(id)}
            onCheckedChange={(v) => {
              setSelectedArchivedTpIds((prev) => {
                const n = new Set(prev);
                if (v === true) n.add(id);
                else n.delete(id);
                return n;
              });
            }}
          />
          <ClientAvatar size={32} shape="circle" name={displayName} seed={id} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
            <p className="text-[11px] text-muted-foreground">
              {row.city}
              {row.address ? ` · ${row.address}` : ""}
            </p>
            <p className="text-[11px] text-muted-foreground">клиент: {row.dealerFullName}</p>
            <p className="text-[11px] text-muted-foreground">
              архивировал {row.info.archivedByName} · {formatDisplayDateTime(row.info.archivedAt)}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1">
            <Button type="button" size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void onRestoreOneArchivedTp(id)}>
              Восстановить
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => setConfirmFD({ kind: "move-archived-tps-to-trash", count: 1, ids: [id] })}
            >
              В Корзину
            </Button>
            {canForceDelete ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={Boolean(busy)}
                onClick={() => setConfirmFD({ kind: "force-delete-archived-tps", count: 1, ids: [id] })}
              >
                Удалить навсегда
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  };

  const confirmTitle = (() => {
    if (!confirmFD) return "";
    switch (confirmFD.kind) {
      case "restore-all-archived-dealers":
        return `Восстановить ${confirmFD.count} клиентов из архива?`;
      case "restore-all-archived-tps":
        return `Восстановить ${confirmFD.count} торговых точек из архива?`;
      case "move-archived-dealers-to-trash":
        return `Переместить ${confirmFD.count} клиентов в Корзину?`;
      case "move-archived-tps-to-trash":
        return `Переместить ${confirmFD.count} торговых точек в Корзину?`;
      case "force-delete-archived-dealers":
        return `Удалить ${confirmFD.count} клиентов навсегда?`;
      case "force-delete-archived-tps":
        return `Удалить ${confirmFD.count} торговых точек навсегда?`;
      case "force-delete-dealer":
      case "force-delete-tp":
        return "Удалить навсегда?";
      case "request-purge-dealer":
      case "request-purge-tp":
        return "Отправить на удаление?";
      case "request-purge-all-dealers":
        return `Очистить корзину (${confirmFD.count} клиентов)?`;
      case "request-purge-all-tps":
        return `Очистить корзину (${confirmFD.count} торговых точек)?`;
      case "request-purge-selected-dealers":
        return `Удалить выбранных навсегда (${confirmFD.count} клиентов)?`;
      case "request-purge-selected-tps":
        return `Удалить выбранных навсегда (${confirmFD.count} торговых точек)?`;
      default:
        return "Подтвердите действие";
    }
  })();

  const confirmDescription = (() => {
    if (!confirmFD) return "";
    switch (confirmFD.kind) {
      case "force-delete-dealer":
        return `Клиент «${confirmFD.name}» будет удалён окончательно. Восстановить будет невозможно.`;
      case "force-delete-tp":
        return `Торговая точка «${confirmFD.name}» будет удалена окончательно. Восстановить будет невозможно.`;
      case "request-purge-selected-dealers":
      case "request-purge-selected-tps":
        return `Будут отправлены на удаление навсегда ${confirmFD.count} записей. Продолжить?`;
      case "request-purge-dealer":
      case "request-purge-tp":
      case "request-purge-all-dealers":
      case "request-purge-all-tps":
        return "Запись будет отправлена админу на окончательное удаление. Восстановить сами больше не сможете. Продолжить?";
      case "restore-all-archived-dealers":
        return "Все клиенты вернутся в активную базу. Это действие не удаляет данные карточек, контакты, изменения — только снимает пометку «архив». Восстановить?";
      case "restore-all-archived-tps":
        return "Все торговые точки вернутся в активную базу. Восстановить?";
      case "move-archived-dealers-to-trash":
        return "Клиенты исчезнут из активной базы и из архива, и через 14 дней будут безвозвратно удалены, если их не восстановить. Восстановить можно из раздела Корзина.";
      case "move-archived-tps-to-trash":
        return "Торговые точки исчезнут из архива и через 14 дней будут безвозвратно удалены, если их не восстановить. Восстановить можно из раздела Корзина.";
      case "force-delete-archived-dealers":
        return "Это действие нельзя отменить. Будут удалены сами клиенты, их карточки, контакты и все ручные изменения. Подтвердите удаление.";
      case "force-delete-archived-tps":
        return "Это действие нельзя отменить. Будут удалены торговые точки и связанные ручные изменения. Подтвердите удаление.";
      default:
        return "";
    }
  })();

  const confirmActionLabel = (() => {
    if (!confirmFD) return "Подтвердить";
    switch (confirmFD.kind) {
      case "restore-all-archived-dealers":
      case "restore-all-archived-tps":
        return "Восстановить всех";
      case "move-archived-dealers-to-trash":
      case "move-archived-tps-to-trash":
        return "Переместить в Корзину";
      case "force-delete-archived-dealers":
      case "force-delete-archived-tps":
      case "force-delete-dealer":
      case "force-delete-tp":
        return "Удалить навсегда";
      case "request-purge-dealer":
      case "request-purge-tp":
      case "request-purge-all-dealers":
      case "request-purge-all-tps":
      case "request-purge-selected-dealers":
      case "request-purge-selected-tps":
        return "Продолжить";
      default:
        return "Подтвердить";
    }
  })();

  const confirmDestructive =
    confirmFD?.kind === "force-delete-dealer" ||
    confirmFD?.kind === "force-delete-tp" ||
    confirmFD?.kind === "force-delete-archived-dealers" ||
    confirmFD?.kind === "force-delete-archived-tps" ||
    confirmFD?.kind === "request-purge-dealer" ||
    confirmFD?.kind === "request-purge-tp" ||
    confirmFD?.kind === "request-purge-all-dealers" ||
    confirmFD?.kind === "request-purge-all-tps" ||
    confirmFD?.kind === "request-purge-selected-dealers" ||
    confirmFD?.kind === "request-purge-selected-tps";

  if (actx.loading) {
    return <TrashBinSkeleton />;
  }

  const onConfirmAction = () => {
    if (!confirmFD) return;
    switch (confirmFD.kind) {
      case "force-delete-dealer":
        void onForceDeleteDealer(confirmFD.dealerId);
        break;
      case "force-delete-tp":
        void onForceDeleteTp(confirmFD.tradePointId);
        break;
      case "request-purge-dealer":
        void onRequestPurgeDealer(confirmFD.dealerId);
        break;
      case "request-purge-tp":
        void onRequestPurgeTp(confirmFD.tradePointId);
        break;
      case "request-purge-all-dealers":
        void onRequestPurgeAllDealers(confirmFD.ids);
        break;
      case "request-purge-all-tps":
        void onRequestPurgeAllTps(confirmFD.ids);
        break;
      case "request-purge-selected-dealers":
        void onBulkRequestPurgeTrashDealers(confirmFD.ids);
        break;
      case "request-purge-selected-tps":
        void onBulkRequestPurgeTrashTps(confirmFD.ids);
        break;
      case "restore-all-archived-dealers":
        void onRestoreAllArchivedDealers(confirmFD.count);
        break;
      case "restore-all-archived-tps":
        void onRestoreAllArchivedTps(confirmFD.count);
        break;
      case "move-archived-dealers-to-trash":
        void onMoveArchivedDealersToTrash(confirmFD.ids);
        break;
      case "move-archived-tps-to-trash":
        void onMoveArchivedTpsToTrash(confirmFD.ids);
        break;
      case "force-delete-archived-dealers":
        void onForceDeleteArchivedDealers(confirmFD.ids);
        break;
      case "force-delete-archived-tps":
        void onForceDeleteArchivedTps(confirmFD.ids);
        break;
    }
    setConfirmFD(null);
  };

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-20" data-testid="page-trash-bin">
      <BackNav breadcrumbs={breadcrumbsFor("/trash")} fallbackHref="/dealer-base" />
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            <Trash2 className="h-5 w-5 text-primary" aria-hidden />
            Корзина
          </h1>
          <p className="text-xs text-muted-foreground">
            Удалённые клиенты и ТТ. Хранятся 14 дней, затем удаляются окончательно.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRunPurge ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={purgeBusy}
              onClick={() => void onRunPurge()}
              data-testid="button-trash-purge-now"
            >
              {purgeBusy ? "Очистка…" : "Запустить очистку сейчас"}
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="rounded-xl border border-border bg-card text-card-foreground">
        <CardContent className="space-y-1 p-3 text-sm">
          <p className="text-foreground">
            В корзине: <span className="font-semibold tabular-nums">{trashedDealers.length}</span> клиентов,{" "}
            <span className="font-semibold tabular-nums">{trashedTps.length}</span> ТТ. В архиве:{" "}
            <span className="font-semibold tabular-nums">{archivedDealerDisplays.length}</span> клиентов,{" "}
            <span className="font-semibold tabular-nums">{archivedTpDisplays.length}</span> ТТ.
          </p>
          {earliestExpires ? (
            <p className="text-[11px] text-muted-foreground">
              Ближайшее окончательное удаление из корзины: {formatDisplayDate(earliestExpires)}.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">В корзине пусто.</p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3" data-testid="section-archive">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Archive className="h-5 w-5 text-muted-foreground" aria-hidden />
          Архив
        </h2>
        <Tabs value={archiveTab} onValueChange={(v) => setArchiveTab(v as "clients" | "tps")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="clients" className="text-xs" data-testid="tab-archive-clients">
              Клиенты ({archivedDealerDisplays.length})
            </TabsTrigger>
            <TabsTrigger value="tps" className="text-xs" data-testid="tab-archive-tps">
              Торговые точки ({archivedTpDisplays.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="clients" className="mt-3 space-y-3">
            {renderDealerArchiveToolbar()}
            {archivedDealerDisplays.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">В архиве нет клиентов</p>
            ) : filteredArchivedDealers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Ничего не найдено по запросу</p>
            ) : (
              <>
                {renderArchivePagination(filteredArchivedDealers.length, dealerPageMeta, setArchiveDealerPage)}
                <div className="space-y-2">{pagedArchivedDealers.map(renderDealerArchiveRow)}</div>
                {renderArchivePagination(filteredArchivedDealers.length, dealerPageMeta, setArchiveDealerPage)}
              </>
            )}
          </TabsContent>
          <TabsContent value="tps" className="mt-3 space-y-3">
            {renderTpArchiveToolbar()}
            {archivedTpDisplays.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">В архиве нет торговых точек</p>
            ) : filteredArchivedTps.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Ничего не найдено по запросу</p>
            ) : (
              <>
                {renderArchivePagination(filteredArchivedTps.length, tpPageMeta, setArchiveTpPage)}
                <div className="space-y-2">{pagedArchivedTps.map(renderTpArchiveRow)}</div>
                {renderArchivePagination(filteredArchivedTps.length, tpPageMeta, setArchiveTpPage)}
              </>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <section className="space-y-3" data-testid="section-trash">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Корзина</h2>
          {trashTab === "clients" && trashedDealers.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() =>
                setConfirmFD({
                  kind: "request-purge-all-dealers",
                  count: trashedDealers.length,
                  ids: trashedDealers.map((d) => d.dealerId),
                })
              }
              data-testid="button-trash-clear-all-dealers"
            >
              Очистить корзину ({trashedDealers.length})
            </Button>
          ) : null}
          {trashTab === "tps" && trashedTps.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() =>
                setConfirmFD({
                  kind: "request-purge-all-tps",
                  count: trashedTps.length,
                  ids: trashedTps.map((t) => t.tradePointId),
                })
              }
              data-testid="button-trash-clear-all-tps"
            >
              Очистить корзину ({trashedTps.length})
            </Button>
          ) : null}
        </div>
        <Tabs value={trashTab} onValueChange={(v) => setTrashTab(v as "clients" | "tps")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="clients" className="text-xs" data-testid="tab-trash-clients">
              Клиенты ({trashedDealers.length})
            </TabsTrigger>
            <TabsTrigger value="tps" className="text-xs" data-testid="tab-trash-tps">
              Торговые точки ({trashedTps.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="clients" className="mt-3 space-y-2">
            {renderTrashDealerToolbar()}
            {trashedDealers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                В корзине пусто. Удалённые клиенты будут появляться здесь.
              </p>
            ) : (
              <VirtualizedStackList
                listRef={trashDealersListRef}
                items={trashedDealerDisplays}
                estimateSize={112}
                className="space-y-2"
                data-testid="trash-dealers-virtual-list"
                getKey={(display) => display.info.dealerId}
                renderItem={(display) => {
                  const t = display.info;
                  return (
                    <Card
                      className="rounded-xl border border-border bg-card text-card-foreground"
                      data-testid={`card-trash-dealer-${t.dealerId}`}
                    >
                      <CardContent className="flex items-start justify-between gap-2 p-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <Checkbox
                            checked={selectedTrashDealerIds.has(t.dealerId)}
                            onCheckedChange={(v) => toggleTrashDealer(t.dealerId, v === true)}
                            data-testid={`checkbox-trash-dealer-${t.dealerId}`}
                          />
                          <ClientAvatar size={36} shape="circle" name={display.name} seed={t.dealerId} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{display.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {display.city} · ИНН {display.inn} · код {display.dealerCode}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              удалил {t.trashedByName} · {formatDisplayDateTime(t.trashedAt)} · истекает{" "}
                              {formatDisplayDate(t.expiresAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === `restore-dealer:${t.dealerId}`}
                            onClick={() => void onRestoreDealer(t.dealerId)}
                            data-testid={`button-trash-dealer-restore-${t.dealerId}`}
                          >
                            Восстановить
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy === `request-purge-dealer:${t.dealerId}`}
                            onClick={() =>
                              setConfirmFD({
                                kind: "request-purge-dealer",
                                dealerId: t.dealerId,
                                name: display.name,
                              })
                            }
                            data-testid={`button-trash-dealer-request-purge-${t.dealerId}`}
                          >
                            Удалить
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }}
              />
            )}
          </TabsContent>
          <TabsContent value="tps" className="mt-3 space-y-2">
            {renderTrashTpToolbar()}
            {trashedTps.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                В корзине пусто. Удалённые торговые точки будут появляться здесь.
              </p>
            ) : (
              <VirtualizedStackList
                listRef={trashTpsListRef}
                items={trashedTps}
                estimateSize={112}
                className="space-y-2"
                data-testid="trash-tps-virtual-list"
                getKey={(t) => t.tradePointId}
                renderItem={(t) => (
                  <Card
                    className="rounded-xl border border-border bg-card text-card-foreground"
                    data-testid={`card-trash-tp-${t.tradePointId}`}
                  >
                    <CardContent className="flex items-start justify-between gap-2 p-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <Checkbox
                          checked={selectedTrashTpIds.has(t.tradePointId)}
                          onCheckedChange={(v) => toggleTrashTp(t.tradePointId, v === true)}
                          data-testid={`checkbox-trash-tp-${t.tradePointId}`}
                        />
                        <ClientAvatar
                          size={32}
                          shape="circle"
                          name={t.snapshot.dealerFullName ?? t.snapshot.name ?? "—"}
                          seed={t.dealerId}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{t.snapshot.name ?? "—"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {t.snapshot.city ?? "—"}
                            {t.snapshot.address ? ` · ${t.snapshot.address}` : ""}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            клиент: {t.snapshot.dealerFullName ?? t.dealerId}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            удалил {t.trashedByName} · {formatDisplayDateTime(t.trashedAt)} · истекает{" "}
                            {formatDisplayDate(t.expiresAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `restore-tp:${t.tradePointId}`}
                          onClick={() => void onRestoreTp(t)}
                          data-testid={`button-trash-tp-restore-${t.tradePointId}`}
                        >
                          Восстановить
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy === `request-purge-tp:${t.tradePointId}`}
                          onClick={() =>
                            setConfirmFD({
                              kind: "request-purge-tp",
                              tradePointId: t.tradePointId,
                              name: t.snapshot.name ?? t.tradePointId,
                            })
                          }
                          data-testid={`button-trash-tp-request-purge-${t.tradePointId}`}
                        >
                          Удалить
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              />
            )}
          </TabsContent>
        </Tabs>
      </section>

      <AlertDialog open={confirmFD !== null} onOpenChange={(o) => !o && setConfirmFD(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle || "Подтвердите действие"}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">
                Отмена
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant={confirmDestructive ? "destructive" : "default"} onClick={onConfirmAction}>
                {confirmActionLabel}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default TrashBinPage;
