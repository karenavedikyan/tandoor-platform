import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { createBitrix24LkTask, listBitrix24Tasks } from "@/lib/bitrix24-integration";
import {
  getBitrix24UserIdForProfile,
  hasBitrix24UserMapping,
} from "@/lib/bitrix24-user-mapping";
import {
  BITRIX24_IMPORTED_TASKS_CHANGED_EVENT,
  getBitrix24ImportedTasks,
  upsertBitrix24ImportedTasks,
  type Bitrix24ImportedTask,
} from "@/lib/bitrix24-imported-tasks";
import {
  BITRIX24_TASK_LINKS_CHANGED_EVENT,
  addDealerBitrix24TaskLink,
  addTradePointBitrix24TaskLink,
  getDealerBitrix24TaskLinks,
  getTradePointBitrix24TaskLinks,
  newBitrix24TaskLinkId,
  type Bitrix24TaskLink,
} from "@/lib/bitrix24-task-links";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import { cn } from "@/lib/utils";

const LIST_LIMIT = 10;
const IMPORT_FETCH_LIMIT = 50;
const IMPORT_PREVIEW = 5;

function formatRuDateTime(iso: string): string {
  return formatDisplayDateTime(iso);
}

type Scope = "dealer" | "trade_point";

export type Bitrix24TasksPanelProps = {
  scope: Scope;
  dealerId: string;
  dealerName: string;
  tradePointId?: string;
  tradePointName?: string;
  canCreate: boolean;
  actorUserId: string;
  actorLabel: string;
  /** Компактный аккордеон: по умолчанию свёрнут, краткая строка статуса в заголовке */
  compact?: boolean;
  /** При compact: изначально раскрыть блок */
  defaultExpanded?: boolean;
};

export function Bitrix24TasksPanel({
  scope,
  dealerId,
  dealerName,
  tradePointId,
  tradePointName,
  canCreate,
  actorUserId,
  actorLabel,
  compact,
  defaultExpanded,
}: Bitrix24TasksPanelProps) {
  const tidPrefix = scope === "dealer" ? "dealer" : "trade-point";
  const isCompact = compact === true;
  const [compactOpen, setCompactOpen] = useState(defaultExpanded === true);
  const [tick, setTick] = useState(0);
  const [importTick, setImportTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [onlyOpenImport, setOnlyOpenImport] = useState(true);
  const [showAllImported, setShowAllImported] = useState(false);
  const { profile } = useReleaseDemoProfile();

  const bitrixUserId = useMemo(() => getBitrix24UserIdForProfile(profile), [profile]);
  const bitrixTasksAllowed = useMemo(() => hasBitrix24UserMapping(profile), [profile]);
  const canUseBitrixRestActions = canCreate && bitrixTasksAllowed;

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    window.addEventListener(BITRIX24_TASK_LINKS_CHANGED_EVENT, fn);
    return () => window.removeEventListener(BITRIX24_TASK_LINKS_CHANGED_EVENT, fn);
  }, []);

  useEffect(() => {
    const fn = () => setImportTick((n) => n + 1);
    window.addEventListener(BITRIX24_IMPORTED_TASKS_CHANGED_EVENT, fn);
    return () => window.removeEventListener(BITRIX24_IMPORTED_TASKS_CHANGED_EVENT, fn);
  }, []);

  useEffect(() => {
    setCompactOpen(defaultExpanded === true);
  }, [defaultExpanded, dealerId, tradePointId, scope]);

  const links: Bitrix24TaskLink[] = useMemo(() => {
    if (scope === "dealer") {
      return getDealerBitrix24TaskLinks(dealerId).slice(0, LIST_LIMIT);
    }
    if (!tradePointId) return [];
    return getTradePointBitrix24TaskLinks(dealerId, tradePointId).slice(0, LIST_LIMIT);
  }, [scope, dealerId, tradePointId, tick]);

  const linkedBitrixIds = useMemo(() => new Set(links.map((l) => l.bitrixTaskId)), [links]);

  const importedVisible: Bitrix24ImportedTask[] = useMemo(() => {
    return getBitrix24ImportedTasks().filter((t) => !linkedBitrixIds.has(t.bitrixTaskId));
  }, [linkedBitrixIds, importTick]);

  const importedPreview = useMemo(
    () => (showAllImported ? importedVisible : importedVisible.slice(0, IMPORT_PREVIEW)),
    [importedVisible, showAllImported],
  );

  const canSeeSection = canCreate || links.length > 0 || importedVisible.length > 0;

  const compactSummary = useMemo(() => {
    const idTxt = bitrixUserId != null ? String(bitrixUserId) : "—";
    return `ID: ${idTxt} · задач из ЛК: ${links.length} · из Bitrix24: ${importedVisible.length}`;
  }, [bitrixUserId, links.length, importedVisible.length]);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setFormErr("");
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) resetForm();
    },
    [resetForm],
  );

  const handleSubmit = useCallback(async () => {
    setFormErr("");
    const t = title.trim();
    if (t.length < 3) {
      setFormErr("Укажите заголовок не короче 3 символов.");
      return;
    }
    if (t.length > 180) {
      setFormErr("Заголовок не длиннее 180 символов.");
      return;
    }
    if (description.length > 4000) {
      setFormErr("Описание не длиннее 4000 символов.");
      return;
    }
    if (!bitrixTasksAllowed || bitrixUserId == null) {
      setFormErr("Для вашего пользователя не настроена связка с Bitrix24. Обратитесь к администратору.");
      return;
    }
    const returnUrl = typeof window !== "undefined" ? window.location.href : undefined;
    setSubmitting(true);
    const res = await createBitrix24LkTask({
      title: t,
      description,
      dealerId,
      dealerName,
      tradePointId: scope === "trade_point" ? tradePointId : undefined,
      tradePointName: scope === "trade_point" ? tradePointName : undefined,
      returnUrl,
      responsibleId: bitrixUserId,
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormErr(res.message);
      return;
    }
    const now = new Date().toISOString();
    const link: Bitrix24TaskLink = {
      id: newBitrix24TaskLinkId(),
      bitrixTaskId: res.taskId,
      title: t,
      dealerId,
      dealerName,
      tradePointId: scope === "trade_point" ? tradePointId : undefined,
      tradePointName: scope === "trade_point" ? tradePointName : undefined,
      createdAt: now,
      createdBy: actorUserId,
      createdByName: actorLabel,
      source: scope === "dealer" ? "dealer" : "trade_point",
      status: "created",
    };
    if (scope === "dealer") {
      addDealerBitrix24TaskLink(link);
    } else if (tradePointId) {
      addTradePointBitrix24TaskLink(dealerId, tradePointId, link);
    }
    toast({ title: res.message || "Задача создана в Bitrix24" });
    handleOpenChange(false);
  }, [
    actorLabel,
    actorUserId,
    bitrixTasksAllowed,
    bitrixUserId,
    dealerId,
    dealerName,
    description,
    handleOpenChange,
    scope,
    title,
    tradePointId,
    tradePointName,
  ]);

  const handleImport = useCallback(async () => {
    setImportErr("");
    if (!bitrixTasksAllowed || bitrixUserId == null) {
      setImportErr("Для вашего пользователя не настроена связка с Bitrix24. Обратитесь к администратору.");
      return;
    }
    setImportLoading(true);
    const res = await listBitrix24Tasks({
      limit: IMPORT_FETCH_LIMIT,
      onlyOpen: onlyOpenImport,
      responsibleId: bitrixUserId,
    });
    setImportLoading(false);
    if (!res.ok) {
      setImportErr(res.message);
      return;
    }
    upsertBitrix24ImportedTasks(res.tasks);
    setShowAllImported(false);
    toast({ title: "Задачи загружены из Bitrix24" });
  }, [bitrixTasksAllowed, bitrixUserId, onlyOpenImport]);

  if (!canSeeSection) {
    return null;
  }

  const compactToggleTestId = scope === "dealer" ? "button-dealer-bitrix24-toggle" : "button-trade-point-bitrix24-toggle";
  const compactWrapTestId = scope === "dealer" ? "section-dealer-bitrix24-compact" : "section-trade-point-bitrix24-compact";

  const tasksCards = (
    <>
      <Card className={cn("rounded-2xl border border-border/80 bg-card shadow-md", isCompact && "shadow-xs")}>
        <CardHeader className="space-y-1 pb-2 pt-5 sm:pb-3">
          <CardTitle className="text-sm font-semibold">Поставленные из ЛК</CardTitle>
          <CardDescription className="text-xs">
            Последние записи по {scope === "dealer" ? "клиенту" : "торговой точке"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pb-5">
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет задач, созданных из ЛК.</p>
          ) : (
            <ul className="space-y-2">
              {links.map((l) => (
                <li
                  key={l.id}
                  data-testid={`row-${tidPrefix}-bitrix24-task-${l.id}`}
                  className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5 text-sm"
                >
                  <p className="font-medium text-foreground">{l.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span data-testid={`text-${tidPrefix}-bitrix24-task-id-${l.id}`}>Bitrix24 #{l.bitrixTaskId}</span>
                    {" · "}
                    {formatRuDateTime(l.createdAt)}
                    {" · "}
                    {l.createdByName}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
            {canUseBitrixRestActions ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-9 w-full font-semibold sm:w-auto"
                data-testid={`button-${tidPrefix}-bitrix24-task-create`}
                onClick={() => {
                  resetForm();
                  setOpen(true);
                }}
              >
                Создать задачу в Bitrix24
              </Button>
            ) : null}
            {canUseBitrixRestActions ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9 w-full font-semibold sm:w-auto"
                  data-testid="button-bitrix24-tasks-import"
                  disabled={importLoading}
                  onClick={() => void handleImport()}
                >
                  {importLoading ? "Загрузка…" : "Загрузить из Bitrix24"}
                </Button>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                  <Checkbox
                    checked={onlyOpenImport}
                    onCheckedChange={(v) => setOnlyOpenImport(v === true)}
                    data-testid="checkbox-bitrix24-tasks-only-open"
                  />
                  <span>Только открытые</span>
                </label>
              </>
            ) : null}
          </div>
          {importErr ? <p className="text-xs font-medium text-destructive">{importErr}</p> : null}
        </CardContent>
      </Card>

      {importedVisible.length > 0 ? (
        <Card
          className={cn("rounded-2xl border border-border/80 bg-card shadow-md", isCompact && "shadow-xs")}
          data-testid="section-bitrix24-imported-tasks"
        >
          <CardHeader className="space-y-1 pb-2 pt-5 sm:pb-3">
            <CardTitle className="text-sm font-semibold">Задачи из Bitrix24</CardTitle>
            <CardDescription className="text-xs">
              Последняя загрузка по кнопке выше (без автоматического обновления). Задачи, уже есть в списке «Поставленные
              из ЛК», здесь не показываются.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-5">
            <ul className="space-y-2">
              {importedPreview.map((st) => (
                <li
                  key={st.id}
                  data-testid={`row-bitrix24-imported-task-${st.id}`}
                  className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5 text-sm"
                >
                  <p className="font-medium text-foreground">{st.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span data-testid={`text-bitrix24-imported-task-id-${st.id}`}>Bitrix24 #{st.bitrixTaskId}</span>
                    {" · "}
                    <span data-testid={`text-bitrix24-imported-task-status-${st.id}`}>Статус: {st.status}</span>
                    {st.deadline ? (
                      <>
                        {" · "}
                        <span data-testid={`text-bitrix24-imported-task-deadline-${st.id}`}>
                          Срок: {formatRuDateTime(st.deadline)}
                        </span>
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Создана: {st.createdDate ? formatRuDateTime(st.createdDate) : "—"}
                    {st.changedDate ? ` · Изменена: ${formatRuDateTime(st.changedDate)}` : null}
                  </p>
                </li>
              ))}
            </ul>
            {importedVisible.length > IMPORT_PREVIEW ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setShowAllImported((v) => !v)}
              >
                {showAllImported ? "Свернуть" : "Показать все"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  );

  return (
    <section
      data-testid={`section-${tidPrefix}-bitrix24-tasks`}
      className={cn("scroll-mt-28 space-y-3 sm:scroll-mt-32", isCompact && "space-y-2")}
    >
      {isCompact ? (
        <div data-testid={compactWrapTestId}>
          <Collapsible open={compactOpen} onOpenChange={setCompactOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 text-left sm:px-4"
                data-testid={compactToggleTestId}
              >
                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", compactOpen && "rotate-180")} aria-hidden />
                <span className="shrink-0 font-semibold text-foreground">Bitrix24</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{compactSummary}</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-3">
              <p className="text-xs text-muted-foreground">
                Не коммерческие данные: задачи из ЛК и загрузка из Bitrix24. Подробности — внутри блока ниже.
              </p>
              {canCreate && !bitrixTasksAllowed ? (
                <Alert
                  variant="destructive"
                  className="border-destructive/40 py-3"
                  data-testid="alert-bitrix24-user-not-mapped"
                >
                  <AlertDescription className="text-sm">
                    Для вашего пользователя не настроена связка с Bitrix24. Обратитесь к администратору.
                  </AlertDescription>
                </Alert>
              ) : null}
              {bitrixUserId ? (
                <p className="text-xs text-muted-foreground" data-testid="text-bitrix24-user-id">
                  Bitrix24 ID: {bitrixUserId}
                </p>
              ) : null}
              {tasksCards}
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Задачи Bitrix24</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Создание задачи в портале Bitrix24 из ЛК и загрузка списка задач по вашему ответственному в Bitrix24. Данные о
              созданных и импортированных задачах хранятся в этом браузере; синхронизация статусов из Bitrix24 не выполняется.
            </p>
            {canCreate && !bitrixTasksAllowed ? (
              <Alert
                variant="destructive"
                className="mt-2 border-destructive/40 py-3"
                data-testid="alert-bitrix24-user-not-mapped"
              >
                <AlertDescription className="text-sm">
                  Для вашего пользователя не настроена связка с Bitrix24. Обратитесь к администратору.
                </AlertDescription>
              </Alert>
            ) : null}
            {bitrixUserId ? (
              <p className="text-xs text-muted-foreground" data-testid="text-bitrix24-user-id">
                Bitrix24 ID: {bitrixUserId}
              </p>
            ) : null}
          </div>
          {tasksCards}
        </>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg" data-testid={`dialog-${tidPrefix}-bitrix24-task-create`}>
          <DialogHeader>
            <DialogTitle className="text-base">Новая задача в Bitrix24</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor={`${tidPrefix}-b24-title`} className="text-xs text-muted-foreground">
                Заголовок
              </Label>
              <Input
                id={`${tidPrefix}-b24-title`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-h-10"
                maxLength={200}
                data-testid={`input-${tidPrefix}-bitrix24-task-title`}
                placeholder="Не короче 3 символов"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${tidPrefix}-b24-desc`} className="text-xs text-muted-foreground">
                Описание
              </Label>
              <Textarea
                id={`${tidPrefix}-b24-desc`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="min-h-[88px] resize-y text-sm"
                data-testid={`textarea-${tidPrefix}-bitrix24-task-description`}
                placeholder="Необязательно, до 4000 символов"
              />
            </div>
            {formErr ? <p className="text-xs font-medium text-destructive">{formErr}</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" className="min-h-9" onClick={() => handleOpenChange(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              className="min-h-9 font-semibold"
              data-testid={`button-${tidPrefix}-bitrix24-task-submit`}
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? "Создание…" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
