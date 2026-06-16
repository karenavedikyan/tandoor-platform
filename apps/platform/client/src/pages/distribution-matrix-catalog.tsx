import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatrixCatalogDefEditorSheet } from "@/components/distribution/matrix-catalog-def-editor-sheet";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { canManageShowcaseMatrixCatalog } from "@/lib/auth-access";
import { CLIENT_CATEGORY_META, type ClientCategoryId } from "@/lib/client-category";
import {
  filterMatrixDefs,
  formatMatrixDefPeriodLabel,
  formatMatrixDefScopeLabel,
  formatMatrixDefUpdatedLabel,
  groupMatrixDefsByClientCategory,
  matrixDefStatusMeta,
  type MatrixCatalogListFilters,
} from "@/lib/distribution-matrix-catalog-view-model";
import type { ShowcaseMatrixCatalogStatus, ShowcaseMatrixDefDto } from "@/lib/showcase-matrix-catalog-api";
import {
  deleteMatrixDefLocal,
  loadCachedMatrixDef,
  loadCachedMatrixDefs,
  refreshMatrixCatalogFromServer,
  refreshMatrixDefFromServer,
  setMatrixDefStatusLocal,
  SHOWCASE_MATRIX_CATALOG_CHANGED_EVENT,
  SHOWCASE_MATRIX_CATALOG_REMOTE_UPDATE_EVENT,
} from "@/lib/showcase-matrix-catalog-store";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { cn } from "@/lib/utils";

type EditorState =
  | { kind: "closed" }
  | { kind: "create"; clientCategory?: ClientCategoryId }
  | { kind: "edit"; defId: string };

const STATUS_FILTER_OPTIONS: { value: ShowcaseMatrixCatalogStatus | "all"; label: string }[] = [
  { value: "all", label: "Все статусы" },
  { value: "draft", label: "Черновик" },
  { value: "published", label: "Опубликовано" },
  { value: "archived", label: "Архив" },
];

export default function DistributionMatrixCatalogPage() {
  const { profile } = useReleaseDemoProfile();
  const { user } = useAuthUser();
  const canManage = canManageShowcaseMatrixCatalog(user?.role, profile.role);

  const [bump, setBump] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<MatrixCatalogListFilters>({
    clientCategory: "all",
    status: "all",
    search: "",
  });
  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<ShowcaseMatrixDefDto | null>(null);

  useEffect(() => {
    const fn = () => setBump((n) => n + 1);
    window.addEventListener(SHOWCASE_MATRIX_CATALOG_CHANGED_EVENT, fn);
    window.addEventListener(SHOWCASE_MATRIX_CATALOG_REMOTE_UPDATE_EVENT, fn);
    return () => {
      window.removeEventListener(SHOWCASE_MATRIX_CATALOG_CHANGED_EVENT, fn);
      window.removeEventListener(SHOWCASE_MATRIX_CATALOG_REMOTE_UPDATE_EVENT, fn);
    };
  }, []);

  const refreshFromServer = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshMatrixCatalogFromServer();
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshFromServer();
  }, [refreshFromServer]);

  useEffect(() => {
    const onOnline = () => void refreshFromServer();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refreshFromServer]);

  const allDefs = useMemo(() => {
    void bump;
    return loadCachedMatrixDefs();
  }, [bump]);

  const filteredDefs = useMemo(() => filterMatrixDefs(allDefs, filters), [allDefs, filters]);
  const groups = useMemo(() => groupMatrixDefsByClientCategory(filteredDefs), [filteredDefs]);

  const openEdit = (defId: string) => {
    const cached = loadCachedMatrixDef(defId);
    if (!cached?.models.length) void refreshMatrixDefFromServer(defId);
    setEditor({ kind: "edit", defId });
  };

  const handleArchive = (def: ShowcaseMatrixDefDto) => {
    if (!canManage) return;
    setMatrixDefStatusLocal(def.id, "archived");
  };

  const handlePublish = (def: ShowcaseMatrixDefDto) => {
    if (!canManage) return;
    setMatrixDefStatusLocal(def.id, "published");
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget || !canManage) return;
    deleteMatrixDefLocal(deleteTarget.id);
    setDeleteTarget(null);
  };

  const modelCountFor = (defId: string): number => loadCachedMatrixDef(defId)?.models.length ?? 0;

  const editorOpen = editor.kind !== "closed";

  return (
    <div
      className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-6"
      data-testid="page-distribution-matrix-catalog"
    >
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative flex min-w-0 flex-col gap-3 pl-3 sm:flex-row sm:items-start sm:justify-between sm:pl-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Справочник матриц</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Управляемые матрицы моделей по типам клиентов, периодам и регионам.
            </p>
          </div>
          {canManage ? (
            <Button
              type="button"
              className="shrink-0"
              onClick={() => setEditor({ kind: "create" })}
              data-testid="button-matrix-catalog-create"
            >
              <Plus className="mr-1 h-4 w-4" />
              Создать матрицу
            </Button>
          ) : null}
        </div>
      </header>

      {refreshing ? <p className="text-sm text-muted-foreground">Обновление справочника…</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Поиск по региону, городу, названию"
            className="pl-9"
            data-testid="input-matrix-catalog-search"
          />
        </div>
        <Select
          value={filters.clientCategory}
          onValueChange={(v) => setFilters((f) => ({ ...f, clientCategory: v as ClientCategoryId | "all" }))}
        >
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-matrix-catalog-filter-category">
            <SelectValue placeholder="Тип клиента" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы клиентов</SelectItem>
            {CLIENT_CATEGORY_META.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v as ShowcaseMatrixCatalogStatus | "all" }))}
        >
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-matrix-catalog-filter-status">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {groups.length === 0 ? (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="px-3 py-6 sm:px-4">
            <p className="text-sm text-muted-foreground">
              {allDefs.length === 0 ? "Матрицы пока не созданы." : "По выбранным фильтрам матрицы не найдены."}
            </p>
            {canManage && allDefs.length === 0 ? (
              <Button type="button" className="mt-4" onClick={() => setEditor({ kind: "create" })}>
                <Plus className="mr-1 h-4 w-4" />
                Создать матрицу
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.clientCategory} className="space-y-3" data-testid={`section-matrix-catalog-${group.clientCategory}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("font-normal", group.badgeClassName)}>
                {group.label}
              </Badge>
              <span className="text-sm text-muted-foreground">{group.defs.length} версий</span>
            </div>

            <Card className="rounded-xl border border-border bg-card shadow-xs">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium sm:px-4">Область</th>
                        <th className="px-3 py-2 font-medium sm:px-4">Период</th>
                        <th className="hidden px-3 py-2 font-medium sm:table-cell sm:px-4">Сезон</th>
                        <th className="px-3 py-2 font-medium sm:px-4">Статус</th>
                        <th className="px-3 py-2 font-medium sm:px-4">Позиций</th>
                        <th className="hidden px-3 py-2 font-medium md:table-cell md:px-4">Обновлено</th>
                        <th className="w-10 px-3 py-2 font-medium sm:px-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {group.defs.map((def) => {
                        const statusMeta = matrixDefStatusMeta(def.status);
                        const positions = modelCountFor(def.id);
                        return (
                          <tr
                            key={def.id}
                            className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                            data-testid={`row-matrix-catalog-${def.id}`}
                          >
                            <td className="px-3 py-3 sm:px-4">
                              <button
                                type="button"
                                className="text-left font-medium text-foreground hover:underline"
                                onClick={() => openEdit(def.id)}
                              >
                                {def.title?.trim() || formatMatrixDefScopeLabel(def)}
                              </button>
                              {def.title?.trim() ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">{formatMatrixDefScopeLabel(def)}</p>
                              ) : null}
                              <p
                                className="mt-0.5 text-xs text-muted-foreground md:hidden"
                                data-testid={`text-matrix-catalog-updated-${def.id}`}
                              >
                                Обновлено: {formatMatrixDefUpdatedLabel(def)}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground sm:px-4">
                              {formatMatrixDefPeriodLabel(def.effectiveFrom, def.effectiveTo)}
                            </td>
                            <td className="hidden px-3 py-3 text-muted-foreground sm:table-cell sm:px-4">
                              {def.seasonLabel?.trim() || "—"}
                            </td>
                            <td className="px-3 py-3 sm:px-4">
                              <Badge variant="outline" className={cn("font-normal", statusMeta.badgeClassName)}>
                                {statusMeta.label}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 sm:px-4">{positions}</td>
                            <td className="hidden px-3 py-3 text-xs text-muted-foreground md:table-cell md:px-4">
                              {formatMatrixDefUpdatedLabel(def)}
                            </td>
                            <td className="px-3 py-3 sm:px-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Действия">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEdit(def.id)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    {canManage ? "Редактировать" : "Просмотр"}
                                  </DropdownMenuItem>
                                  {canManage && def.status === "draft" ? (
                                    <DropdownMenuItem onClick={() => handlePublish(def)}>Опубликовать</DropdownMenuItem>
                                  ) : null}
                                  {canManage && def.status !== "archived" ? (
                                    <DropdownMenuItem onClick={() => handleArchive(def)}>
                                      <Archive className="mr-2 h-4 w-4" />
                                      В архив
                                    </DropdownMenuItem>
                                  ) : null}
                                  {canManage ? (
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => setDeleteTarget(def)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Удалить
                                    </DropdownMenuItem>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        ))
      )}

      <MatrixCatalogDefEditorSheet
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open) setEditor({ kind: "closed" });
        }}
        mode={editor.kind === "create" ? "create" : "edit"}
        defId={editor.kind === "edit" ? editor.defId : null}
        initialClientCategory={editor.kind === "create" ? editor.clientCategory : undefined}
        canEdit={canManage}
        onSaved={() => setBump((n) => n + 1)}
      />

      <AlertDialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить матрицу</AlertDialogTitle>
            <AlertDialogDescription>
              Матрица будет удалена из справочника. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FloatingBackButton href="/distribution" label="К дистрибуции" testId="button-floating-back-matrix-catalog" />
    </div>
  );
}
