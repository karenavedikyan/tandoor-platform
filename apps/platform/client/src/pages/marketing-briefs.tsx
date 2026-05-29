import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { LayoutGrid, List, Loader2, Table2 } from "lucide-react";
import { BrandBriefView } from "@/components/marketing-brief/brand-brief-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useRouteSearchParams } from "@/lib/hash-route-utils";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { canManageMarketingBriefs } from "@/lib/auth-access";
import {
  BriefBulkActionBar,
  BriefCardsListView,
  BriefCardsSelectAllLink,
  BriefCompactListView,
  BriefTableListView,
  readBriefListViewMode,
  writeBriefListViewMode,
  type BriefListViewMode,
  type BriefRowMenuHandlers,
} from "@/components/marketing-brief/brief-list-views";
import { TEMPLATE_BLOCKS } from "@/lib/marketing-briefs-template";
import {
  archiveBrief,
  createBlock,
  createBrief,
  DEFAULT_MARKETING_BRIEF_ACCENT,
  deleteBrief,
  getBrief,
  last12PeriodOptions,
  listBlocks,
  listBriefs,
  publishBrief,
  restoreBrief,
  unpublishBrief,
  type MarketingBriefBlockRow,
  type MarketingBriefRow,
  type MarketingBriefStatus,
  type MarketingBriefVisibility,
} from "@/lib/marketing-briefs-api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | MarketingBriefStatus;

function currentPeriodLabel(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parsePreviewFromLocation(location: string): boolean {
  const q = location.includes("?") ? location.split("?")[1] : "";
  return new URLSearchParams(q).get("preview") === "1";
}

export function MarketingBriefPublishedPage() {
  const { profile } = useReleaseDemoProfile();
  const canManage = canManageMarketingBriefs(profile.role);
  const [location] = useLocation();
  const routeSearch = useRouteSearchParams();
  const [, params] = useRoute("/marketing-briefs/view/:id");
  const id = params?.id ?? "";
  const isPreview =
    routeSearch.get("preview") === "1" || parsePreviewFromLocation(location);

  const [brief, setBrief] = useState<MarketingBriefRow | null>(null);
  const [blocks, setBlocks] = useState<MarketingBriefBlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("not_found");
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        console.debug("[brief-preview] fetch", { id, isPreview, canManage, role: profile.role });
        const data = await getBrief(id);
        if (cancelled) return;
        const allowDraftPreview = isPreview && canManage;
        if (data.brief.status !== "published" && !allowDraftPreview) {
          console.warn("[brief-preview] denied", {
            status: data.brief.status,
            isPreview,
            canManage,
            role: profile.role,
          });
          setBrief(null);
          setError(isPreview && !canManage ? "no_permission" : "not_found");
        } else {
          setBrief(data.brief);
          try {
            const blockRows = await listBlocks(data.brief.id);
            if (!cancelled) setBlocks(blockRows);
          } catch {
            if (!cancelled) setBlocks([]);
          }
        }
      } catch {
        if (!cancelled) {
          setBrief(null);
          setError("not_found");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isPreview, canManage, profile.role]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" data-testid="page-marketing-brief-view">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!brief || error) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-24" data-testid="page-marketing-brief-view">
        <FloatingBackButton href="/marketing-briefs" label="К брифам" testId="button-floating-back-marketing-brief-view" />
        {error === "no_permission" ? (
          <p className="text-sm text-muted-foreground" data-testid="text-marketing-brief-no-permission">
            Предпросмотр черновика доступен только маркетологу или руководителю. Текущая роль: {profile.role}.
          </p>
        ) : null}
        {error === "not_found" ? (
          <p className="text-sm text-muted-foreground">Бриф не найден или ещё в черновике.</p>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/marketing-briefs">К списку</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-8" data-testid="page-marketing-brief-view">
      <div className="px-4 pt-4 sm:px-6">
        <FloatingBackButton href="/marketing-briefs" label="К брифам" testId="button-floating-back-marketing-brief-view" />
      </div>
      <BrandBriefView
        brief={brief}
        blocks={blocks}
        previewMode={isPreview && brief.status !== "published"}
        showShare
        showPrint
        onBriefChange={setBrief}
      />
      <div className="mx-auto max-w-4xl px-4 pt-4 sm:px-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/marketing-briefs">К списку брифов</Link>
        </Button>
      </div>
    </div>
  );
}

export default function MarketingBriefsPage() {
  const { profile } = useReleaseDemoProfile();
  const [, setLocation] = useLocation();
  const canManage = canManageMarketingBriefs(profile.role);

  const [briefs, setBriefs] = useState<MarketingBriefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(canManage ? "all" : "published");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createPeriod, setCreatePeriod] = useState(currentPeriodLabel);
  const [createTitle, setCreateTitle] = useState("");
  const [createAccent, setCreateAccent] = useState(DEFAULT_MARKETING_BRIEF_ACCENT);
  const [createVisibility, setCreateVisibility] = useState<MarketingBriefVisibility>("private");
  const [creating, setCreating] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [viewMode, setViewMode] = useState<BriefListViewMode>(() => readBriefListViewMode());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const singleDeleteBrief = useMemo(
    () => (singleDeleteId ? briefs.find((b) => b.id === singleDeleteId) : undefined),
    [singleDeleteId, briefs],
  );
  const isArchiveTab = statusFilter === "archived";
  const selectAllRef = useRef<HTMLInputElement>(null);

  const periodOptions = useMemo(() => last12PeriodOptions(), []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  useEffect(() => {
    clearSelection();
  }, [statusFilter, periodFilter, viewMode, clearSelection]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allPageSelected = briefs.length > 0 && briefs.every((b) => selectedSet.has(b.id));
  const someSelected = briefs.some((b) => selectedSet.has(b.id));

  const selection = useMemo(() => {
    if (!canManage) return null;
    return {
      selectedIds,
      selectionActive: selectedIds.length > 0,
      isSelected: (id: string) => selectedSet.has(id),
      onToggle: (id: string) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      },
      onToggleAll: () => {
        if (allPageSelected) clearSelection();
        else setSelectedIds(briefs.map((b) => b.id));
      },
      allSelected: allPageSelected,
      someSelected,
    };
  }, [canManage, selectedIds, selectedSet, allPageSelected, someSelected, briefs, clearSelection]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listBriefs({
        status: statusFilter === "all" ? undefined : statusFilter,
        period: periodFilter,
      });
      setBriefs(list);
    } catch (e) {
      toast({
        title: "Не удалось загрузить брифы",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
      setBriefs([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, periodFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await createBrief({
        period_label: createPeriod,
        title: createTitle.trim() || undefined,
        visibility: createVisibility,
        accent_color: createAccent,
      });
      setCreateOpen(false);
      setCreateTitle("");
      setCreateVisibility("private");
      setLocation(`/marketing-briefs/${created.id}`);
    } catch (e) {
      toast({
        title: "Не удалось создать бриф",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateFromTemplate() {
    setCreatingTemplate(true);
    try {
      const created = await createBrief({
        period_label: createPeriod,
        title: (createTitle.trim() || "Пример брифа") + " (шаблон)",
        visibility: createVisibility,
        accent_color: createAccent,
      });
      let prevId: string | undefined;
      for (const tb of TEMPLATE_BLOCKS) {
        const block = await createBlock({
          brief_id: created.id,
          type: tb.type,
          payload: tb.payload,
          insert_after_id: prevId,
        });
        prevId = block.id;
      }
      setCreateOpen(false);
      setCreateTitle("");
      setCreateVisibility("private");
      setLocation(`/marketing-briefs/${created.id}`);
    } catch (e) {
      toast({
        title: "Не удалось создать бриф из шаблона",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCreatingTemplate(false);
    }
  }

  async function runAction(
    label: string,
    fn: (id: string) => Promise<MarketingBriefRow>,
    id: string,
  ) {
    try {
      await fn(id);
      toast({ title: label });
      clearSelection();
      await reload();
    } catch (e) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  }

  const setViewModePersisted = useCallback((mode: BriefListViewMode) => {
    setViewMode(mode);
    writeBriefListViewMode(mode);
  }, []);

  async function runBulkSequential(
    ids: string[],
    actionLabel: string,
    fn: (id: string) => Promise<unknown>,
  ): Promise<{ ok: number; fail: number }> {
    let ok = 0;
    let fail = 0;
    const progress = toast({
      title: actionLabel,
      description: `0 / ${ids.length}`,
    });
    for (let i = 0; i < ids.length; i++) {
      try {
        await fn(ids[i]!);
        ok++;
      } catch {
        fail++;
      }
      progress.update({
        id: progress.id,
        description: `${ok + fail} / ${ids.length}`,
      });
    }
    progress.dismiss();
    return { ok, fail };
  }

  async function confirmBulkArchive() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkBusy(true);
    const { ok, fail } = await runBulkSequential(ids, "Архивирование…", archiveBrief);
    toast({
      title: fail > 0 ? `Архивировано ${ok} из ${ids.length}` : `Архивировано ${ok} из ${ok}`,
      variant: fail > 0 ? "destructive" : undefined,
    });
    clearSelection();
    await reload();
    setBulkBusy(false);
  }

  async function confirmBulkRestore() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkBusy(true);
    const { ok, fail } = await runBulkSequential(ids, "Восстановление…", restoreBrief);
    toast({
      title: fail > 0 ? `Восстановлено ${ok} из ${ids.length}` : `Восстановлено ${ok} из ${ok}`,
      variant: fail > 0 ? "destructive" : undefined,
    });
    clearSelection();
    await reload();
    setBulkBusy(false);
  }

  async function confirmBulkDelete() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkDeleteOpen(false);
    setBulkBusy(true);
    const { ok, fail } = await runBulkSequential(ids, "Удаление…", deleteBrief);
    toast({
      title: fail > 0 ? `Удалено ${ok}, ошибок ${fail}` : `Удалено ${ok} из ${ok}`,
      variant: fail > 0 ? "destructive" : undefined,
    });
    clearSelection();
    await reload();
    setBulkBusy(false);
  }

  async function confirmSingleDelete() {
    if (!singleDeleteId) return;
    const id = singleDeleteId;
    setSingleDeleteId(null);
    try {
      await deleteBrief(id);
      toast({ title: "Бриф удалён" });
      clearSelection();
      await reload();
    } catch (e) {
      toast({
        title: "Не удалось удалить",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  }

  const menuHandlers: BriefRowMenuHandlers = {
    onOpen: (brief) => setLocation(`/marketing-briefs/${brief.id}`),
    onArchive: (id) => void runAction("В архиве", archiveBrief, id),
    onRestore: (id) => void runAction("Восстановлено", restoreBrief, id),
    onDelete: (id) => setSingleDeleteId(id),
  };

  function renderCardFooter(b: MarketingBriefRow) {
    if (!canManage) {
      return (
        <Button asChild variant="outline" size="sm" className="min-h-9">
          <Link href={`/marketing-briefs/view/${b.id}`}>Открыть</Link>
        </Button>
      );
    }
    return (
      <>
        <Button asChild variant="outline" size="sm" className="min-h-9">
          <Link href={`/marketing-briefs/${b.id}`}>Открыть</Link>
        </Button>
        {b.status === "draft" || b.status === "archived" ? (
          <Button
            type="button"
            size="sm"
            className="min-h-9"
            data-testid={`button-marketing-brief-publish-${b.id}`}
            onClick={() => void runAction("Опубликовано", publishBrief, b.id)}
          >
            Опубликовать
          </Button>
        ) : null}
        {b.status === "published" ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-9"
            onClick={() => void runAction("Снято с публикации", unpublishBrief, b.id)}
          >
            Снять с публикации
          </Button>
        ) : null}
        {b.status !== "archived" ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-9 text-muted-foreground"
            onClick={() => void runAction("В архиве", archiveBrief, b.id)}
          >
            В архив
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-9"
            onClick={() => void runAction("Восстановлено", restoreBrief, b.id)}
          >
            Восстановить
          </Button>
        )}
      </>
    );
  }

  const emptyMessage = canManage
    ? "Брифов пока нет. Создайте первый — он появится у команды после публикации."
    : "Опубликованных брифов пока нет. Маркетинг готовит свежие материалы.";

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24" data-testid="page-marketing-briefs">
      <FloatingBackButton href="/main" label="На главную" testId="button-floating-back-marketing-briefs" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Маркетинговые брифы</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {canManage ? (
              <>Ежемесячные материалы для команды продаж. Создание и публикация ведутся в этом кабинете.</>
            ) : (
              <span data-testid="text-marketing-briefs-readonly">
                Опубликованные брифы для команды продаж. Редактирование доступно руководителям и маркетологам.
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div
            className="flex rounded-lg border border-border p-0.5"
            role="group"
            aria-label="Режим отображения списка"
            data-testid="brief-list-view-mode"
          >
            {(
              [
                { mode: "cards" as const, icon: LayoutGrid, label: "Карточки" },
                { mode: "table" as const, icon: Table2, label: "Таблица" },
                { mode: "compact" as const, icon: List, label: "Компактный список" },
              ] as const
            ).map(({ mode, icon: Icon, label }) => (
              <Button
                key={mode}
                type="button"
                size="icon"
                variant="ghost"
                className={cn("h-9 w-9", viewMode === mode && "bg-secondary")}
                aria-label={label}
                aria-pressed={viewMode === mode}
                data-testid={`button-brief-view-${mode}`}
                onClick={() => setViewModePersisted(mode)}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
          {canManage ? (
            <Button type="button" className="min-h-10" data-testid="button-marketing-brief-new" onClick={() => setCreateOpen(true)}>
              Новый бриф
            </Button>
          ) : null}
        </div>
      </div>

      {canManage ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="all">Все</TabsTrigger>
              <TabsTrigger value="draft">Черновики</TabsTrigger>
              <TabsTrigger value="published">Опубликованные</TabsTrigger>
              <TabsTrigger value="archived">Архив</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full min-w-[180px] sm:w-[220px]">
              <SelectValue placeholder="Период" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : briefs.length === 0 ? (
        <p
          className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground"
          data-testid={canManage ? "text-marketing-briefs-empty-manage" : "text-marketing-briefs-empty-published"}
        >
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-3" data-testid="section-marketing-briefs-list">
          {canManage && selection && viewMode === "cards" ? (
            <BriefCardsSelectAllLink selection={selection} />
          ) : null}
          {viewMode === "cards" ? (
            <BriefCardsListView
              briefs={briefs}
              canManage={canManage}
              selection={selection}
              renderCardFooter={renderCardFooter}
            />
          ) : null}
          {viewMode === "table" ? (
            <BriefTableListView
              briefs={briefs}
              canManage={canManage}
              selection={selection}
              selectAllRef={selectAllRef}
              menuHandlers={menuHandlers}
            />
          ) : null}
          {viewMode === "compact" ? (
            <BriefCompactListView
              briefs={briefs}
              canManage={canManage}
              selection={selection}
              selectAllRef={selectAllRef}
              menuHandlers={menuHandlers}
            />
          ) : null}
        </div>
      )}

      {canManage ? (
        <BriefBulkActionBar
          count={selectedIds.length}
          busy={bulkBusy}
          primaryLabel={isArchiveTab ? "Восстановить" : "Архивировать"}
          onPrimary={() => void (isArchiveTab ? confirmBulkRestore() : confirmBulkArchive())}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={clearSelection}
        />
      ) : null}

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => !bulkBusy && setBulkDeleteOpen(o)}>
        <AlertDialogContent data-testid="dialog-brief-bulk-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isArchiveTab ? "Удалить выбранные брифы из архива?" : "Удалить выбранные брифы?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              ({selectedIds.length} шт.) Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkBusy}
              onClick={(e) => {
                e.preventDefault();
                void confirmBulkDelete();
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={singleDeleteId != null} onOpenChange={(o) => !o && setSingleDeleteId(null)}>
        <AlertDialogContent data-testid="dialog-brief-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {singleDeleteBrief?.status === "archived" ? "Удалить бриф из архива?" : "Удалить бриф?"}
            </AlertDialogTitle>
            <AlertDialogDescription>Действие необратимо.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmSingleDelete();
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="dialog-marketing-brief-create">
          <DialogHeader>
            <DialogTitle>Создание брифа</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Период</Label>
              <Select value={createPeriod} onValueChange={setCreatePeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions
                    .filter((o) => o.value !== "all")
                    .map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Заголовок (необязательно)</Label>
              <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Автозаголовок по периоду" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Доступ</Label>
              <div className="space-y-2 text-sm" role="radiogroup" aria-label="Доступ к брифу">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="create-visibility"
                    value="private"
                    checked={createVisibility === "private"}
                    onChange={() => setCreateVisibility("private")}
                    className="mt-0.5"
                    data-testid="radio-brief-visibility-private"
                  />
                  <span>
                    <span className="font-medium">Приватный (по умолчанию)</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Видят только сотрудники ЛК</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="create-visibility"
                    value="public"
                    checked={createVisibility === "public"}
                    onChange={() => setCreateVisibility("public")}
                    className="mt-0.5"
                    data-testid="radio-brief-visibility-public"
                  />
                  <span>
                    <span className="font-medium">Публичный</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">После публикации — ссылка без входа</span>
                  </span>
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Цвет акцента</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={createAccent}
                  onChange={(e) => setCreateAccent(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-border"
                  aria-label="Цвет акцента"
                />
                <Input value={createAccent} onChange={(e) => setCreateAccent(e.target.value)} className="font-mono text-sm" />
              </div>
            </div>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Шаблон создаст бриф с примерами всех типов блоков (раздел, текст, сегменты, выделенный блок, продукты,
            таблица цен, бонус) — удобно посмотреть как заполнить, и редактировать под себя.
          </p>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCreateFromTemplate()}
              disabled={creating || creatingTemplate}
              data-testid="button-create-from-template"
            >
              {creatingTemplate ? "Создание шаблона…" : "Создать из шаблона"}
            </Button>
            <Button
              type="button"
              disabled={creating || creatingTemplate}
              onClick={() => void handleCreate()}
              data-testid="button-create-brief"
            >
              {creating ? "Создание…" : "Создать черновик"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
