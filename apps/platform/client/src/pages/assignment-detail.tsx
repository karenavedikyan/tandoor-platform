import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BackNav } from "@/components/navigation/back-nav";
import { breadcrumbsFor } from "@/lib/navigation/route-hierarchy";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Grid2x2,
  Grid3x3,
  List,
  Loader2,
  Package,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import { prepareImageFileForUpload } from "@/lib/client-image-upload-pipeline";
import { uploadClientBaseImagePair } from "@/lib/client-base-actualization-upload-api";
import { ShowcaseModelPresentationDialog } from "@/components/showcase-model-presentation-dialog";
import { ModelDoorPhotoFrame } from "@/components/showcase/model-door-photo-frame";
import type { ModelDoorPhotoFrameSize } from "@/components/showcase/model-door-photo-frame";
import type { ShowcaseMatrixModelDefinition } from "@/lib/trade-point-showcase-matrix-models";
import {
  addAssignmentComment,
  createFollowup,
  getAssignment,
  listAssignmentComments,
  setItemStatus,
  submitAssignment,
  verifyAssignment,
  type AssignmentCommentDto,
  type AssignmentDto,
  type AssignmentItemStatus,
} from "@/lib/showcase-assignments-api";
import type { AssignmentStatus } from "@shared/showcase-assignments-handlers";

type AssignmentViewMode = "list" | "m" | "s";

type CatalogImageEntry = {
  id: string;
  name: string;
  image_path: string | null;
  image_url: string | null;
};

type AssignmentImageMaps = {
  byTargetId: Map<string, CatalogImageEntry>;
  byModelName: Map<string, CatalogImageEntry>;
};

const CATALOG_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeModelName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function isCatalogProductUuid(id: string): boolean {
  return CATALOG_UUID_RE.test(id);
}

const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  open: "Открыто",
  in_progress: "В работе",
  submitted: "Отправлено",
  verified: "Подтверждено",
  closed: "Закрыто",
};

const ITEM_STATUS_LABEL: Record<AssignmentItemStatus, string> = {
  pending: "Ожидает",
  shipped: "Отгружено",
  installed: "На витрине",
  problem: "Проблема",
  not_relevant: "Уже не актуально",
};

const PROBLEM_PRESETS = [
  { value: "Нет на складе", label: "Нет на складе" },
  { value: "Клиент отказался", label: "Клиент отказался" },
  { value: "__other__", label: "Другое" },
] as const;

const DONE_STATUSES = new Set<AssignmentItemStatus>(["shipped", "installed", "not_relevant"]);

function assignmentStatusTone(status: AssignmentStatus): string {
  if (status === "verified" || status === "closed") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "submitted") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted/60 text-foreground";
}

function itemStatusTone(status: AssignmentItemStatus): string {
  if (status === "installed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (status === "shipped") return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400";
  if (status === "problem") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400";
  if (status === "not_relevant") return "border-border bg-muted/60 text-muted-foreground";
  return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-400";
}

function isItemDone(item: AssignmentDto["items"][number]): boolean {
  return item.done || DONE_STATUSES.has(item.itemStatus);
}

function isDueOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}

function itemsGridClass(viewMode: AssignmentViewMode): string {
  if (viewMode === "list") return "flex flex-col gap-2";
  if (viewMode === "m") return "grid grid-cols-2 gap-3";
  return "grid grid-cols-2 gap-2 sm:grid-cols-3";
}

function photoSizeForView(viewMode: AssignmentViewMode): ModelDoorPhotoFrameSize {
  return viewMode;
}

const VERIFY_ROLES = new Set(["admin", "director", "rop", "regional_manager"]);

function isVerifyCandidate(item: AssignmentDto["items"][number]): boolean {
  return !item.verified && (item.itemStatus === "shipped" || item.done);
}

function canUserEditAssignment(
  assignment: AssignmentDto,
  userId: string | undefined,
  role: string | undefined,
): boolean {
  if (!userId || !role) return false;
  const elevated = role === "admin" || role === "director" || role === "rop";
  const isAssignee = Boolean(assignment.assigneeUserId && assignment.assigneeUserId === userId);
  if (!elevated && !isAssignee) return false;
  if (assignment.status === "submitted" || assignment.status === "verified" || assignment.status === "closed") {
    return false;
  }
  return true;
}

function canUserCommentAssignment(
  assignment: AssignmentDto,
  userId: string | undefined,
  role: string | undefined,
): boolean {
  if (!userId || !role) return false;
  if (VERIFY_ROLES.has(role)) return true;
  return assignment.createdBy === userId || assignment.assigneeUserId === userId;
}

async function fetchCatalogBatch(query: { ids?: string; names?: string }): Promise<CatalogImageEntry[]> {
  const params = new URLSearchParams();
  if (query.ids) params.set("ids", query.ids);
  if (query.names) params.set("names", query.names);
  const res = await fetch(`/api/catalog/products?${params.toString()}`, { credentials: "include" });
  if (!res.ok) return [];
  const json = (await res.json()) as { success?: boolean; items?: CatalogImageEntry[] };
  if (json.success !== true || !Array.isArray(json.items)) return [];
  return json.items;
}

async function fetchAssignmentCatalogImages(items: AssignmentDto["items"]): Promise<AssignmentImageMaps> {
  const byTargetId = new Map<string, CatalogImageEntry>();
  const byModelName = new Map<string, CatalogImageEntry>();

  const uuidIds: string[] = [];
  const legacyNames: string[] = [];

  for (const item of items) {
    if (item.targetId && isCatalogProductUuid(item.targetId) && !uuidIds.includes(item.targetId)) {
      uuidIds.push(item.targetId);
    } else if (item.modelName) {
      const norm = normalizeModelName(item.modelName);
      if (norm && !legacyNames.includes(norm)) legacyNames.push(norm);
    }
  }

  if (uuidIds.length) {
    const entries = await fetchCatalogBatch({ ids: uuidIds.join(",") });
    for (const entry of entries) byTargetId.set(entry.id, entry);
  }
  if (legacyNames.length) {
    const entries = await fetchCatalogBatch({ names: legacyNames.join(",") });
    for (const entry of entries) byModelName.set(normalizeModelName(entry.name), entry);
  }

  return { byTargetId, byModelName };
}

function itemToPresentationModel(
  item: AssignmentDto["items"][number],
  imageUrl: string | null,
): ShowcaseMatrixModelDefinition {
  const targetId = item.targetId ?? item.id;
  const isEntrance = !targetId.includes("tc-mk");
  const type = isEntrance ? ("entrance" as const) : ("interior" as const);
  return {
    id: targetId,
    catalog1cId: isCatalogProductUuid(targetId) ? targetId : undefined,
    name: item.modelName,
    type,
    typeLabelRu: isEntrance ? "ВХ" : "МК",
    imageUrl: imageUrl ?? "",
    basePriority: "medium",
    importanceReason: "",
    characteristics: "",
    advantages: "",
    benefitsDealer: "",
    benefitsBuyer: "",
    objections: "",
    objectionAnswers: "",
    copyMessage: "",
    categoryRules: [],
  };
}

function resolveItemModelImage(item: AssignmentDto["items"][number], maps: AssignmentImageMaps): string | null {
  if (item.targetId && isCatalogProductUuid(item.targetId)) {
    const entry = maps.byTargetId.get(item.targetId);
    if (entry) return entry.image_url ?? entry.image_path ?? null;
  }
  if (item.modelName) {
    const entry = maps.byModelName.get(normalizeModelName(item.modelName));
    if (entry) return entry.image_url ?? entry.image_path ?? null;
  }
  return null;
}

function formatCommentDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ChatInputRow({
  value,
  onChange,
  onSend,
  placeholder,
  disabled,
  testIdInput,
  testIdSend,
  hideSendButton,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  disabled?: boolean;
  testIdInput?: string;
  testIdSend?: string;
  hideSendButton?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!hideSendButton && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={testIdInput}
        className="min-h-9 max-h-[120px] flex-1 resize-none rounded-full border border-input bg-background px-3 py-2 text-sm leading-snug shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      {hideSendButton ? null : (
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          disabled={disabled || !value.trim()}
          onClick={onSend}
          data-testid={testIdSend}
          aria-label="Отправить"
        >
          <Send className="h-4 w-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}

function AssignmentCommentsBlock({
  assignmentId,
  userId,
  canComment,
}: {
  assignmentId: string;
  userId: string | undefined;
  canComment: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const commentsQ = useQuery({
    queryKey: ["assignment-comments", assignmentId],
    queryFn: () => listAssignmentComments(assignmentId),
    enabled: canComment && Boolean(assignmentId),
    retry: false,
  });

  if (!canComment) return null;

  const comments = commentsQ.data ?? [];

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await addAssignmentComment(assignmentId, text);
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["assignment-comments", assignmentId] });
      toast({ title: "Комментарий отправлен" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Не удалось отправить комментарий",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="rounded-xl border border-border/80" data-testid="card-assignment-comments">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Комментарии</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {commentsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : commentsQ.isError ? null : (
          <ul className="space-y-2" data-testid="assignment-comments-list">
            {comments.length === 0 ? (
              <li className="text-sm text-muted-foreground">Комментариев пока нет</li>
            ) : (
              comments.map((c: AssignmentCommentDto) => {
                const isOwn = c.authorId === userId;
                return (
                  <li
                    key={c.id}
                    className={cn("flex", isOwn ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2",
                        isOwn
                          ? "rounded-br-sm bg-primary/15 text-foreground"
                          : "rounded-bl-sm bg-muted/60 text-foreground",
                      )}
                    >
                      <p className="text-[11px] leading-tight text-muted-foreground">
                        {c.authorName ?? "—"}
                        {c.authorRole ? ` · ${c.authorRole}` : ""}
                        {" · "}
                        {formatCommentDate(c.createdAt)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.body}</p>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        )}
        <div className="border-t border-border/60 pt-3">
          <ChatInputRow
            value={draft}
            onChange={setDraft}
            onSend={() => void handleSend()}
            placeholder="Написать комментарий…"
            disabled={sending}
            testIdInput="textarea-assignment-comment-new"
            testIdSend="button-assignment-comment-send"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AssignmentNotFound() {
  return (
    <div className="mx-auto max-w-md space-y-6 py-8" data-testid="page-assignment-not-found">
      <BackNav breadcrumbs={breadcrumbsFor("/assignments")} fallbackHref="/assignments" />
      <Card className="rounded-2xl border border-border bg-card shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Задание не найдено</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Задание не найдено или у вас нет доступа.</p>
        </CardContent>
      </Card>
    </div>
  );
}

type ItemCardProps = {
  assignment: AssignmentDto;
  item: AssignmentDto["items"][number];
  canEdit: boolean;
  viewMode: AssignmentViewMode;
  modelImageSrc: string | null;
  onUpdated: (assignment: AssignmentDto) => void;
  onOpenPresentation: (item: AssignmentDto["items"][number], imageUrl: string | null) => void;
};

function stopCardClick(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation();
}

function openPresentationFromKey(
  e: KeyboardEvent,
  onOpen: () => void,
) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onOpen();
  }
}

function AssignmentItemCard({
  assignment,
  item,
  canEdit,
  viewMode,
  modelImageSrc,
  onUpdated,
  onOpenPresentation,
}: ItemCardProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [customReason, setCustomReason] = useState("");
  const [problemOpen, setProblemOpen] = useState(false);
  const [problemPreset, setProblemPreset] = useState<string>(PROBLEM_PRESETS[0].value);
  const [problemOther, setProblemOther] = useState("");

  const readOnly = !canEdit || item.itemStatus === "installed";
  const done = isItemDone(item);
  const photoSize = photoSizeForView(viewMode);
  const isList = viewMode === "list";

  const applyStatus = useCallback(
    async (itemStatus: AssignmentItemStatus, problemReason?: string | null) => {
      setBusy(true);
      try {
        const next = await setItemStatus({
          assignmentId: assignment.id,
          itemId: item.id,
          itemStatus,
          problemReason: problemReason ?? null,
        });
        onUpdated(next);
        setMenuOpen(false);
        setProblemOpen(false);
        setCustomReason("");
        setProblemOther("");
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : "Не удалось обновить позицию",
          variant: "destructive",
        });
      } finally {
        setBusy(false);
      }
    },
    [assignment.id, item.id, onUpdated, toast],
  );

  const onPhotoSelected = useCallback(
    async (file: File) => {
      setUploadingPhoto(true);
      try {
        const prep = await prepareImageFileForUpload(file);
        if (!prep.ok) {
          toast({ title: "Файл не подходит", description: prep.error, variant: "destructive" });
          return;
        }
        const up = await uploadClientBaseImagePair({
          image: prep.image,
          thumbnail: prep.thumbnail,
          fileName: file.name,
        });
        if (!up.success) {
          toast({ title: "Ошибка загрузки", description: up.message, variant: "destructive" });
          return;
        }
        const next = await setItemStatus({
          assignmentId: assignment.id,
          itemId: item.id,
          itemStatus: item.itemStatus === "pending" ? "shipped" : item.itemStatus,
          photoUrl: up.url,
          photoThumbUrl: up.thumbnailUrl,
        });
        onUpdated(next);
        toast({ title: "Фото добавлено" });
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : "Не удалось загрузить фото",
          variant: "destructive",
        });
      } finally {
        setUploadingPhoto(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [assignment.id, item.id, item.itemStatus, onUpdated, toast],
  );

  const confirmProblem = () => {
    const reason = problemPreset === "__other__" ? problemOther.trim() : problemPreset;
    if (!reason) {
      toast({ title: "Укажите причину проблемы", variant: "destructive" });
      return;
    }
    void applyStatus("problem", reason);
  };

  const completionMenu = (
    <PopoverContent className="w-56 space-y-2 p-2" align="start" side="bottom">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-start"
        disabled={busy}
        onClick={() => void applyStatus("shipped")}
        data-testid={`button-item-shipped-${item.id}`}
      >
        <Check className="mr-2 h-4 w-4" aria-hidden />
        Отгружено
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-start"
        disabled={busy}
        onClick={() => void applyStatus("not_relevant", "Уже не актуально")}
        data-testid={`button-item-not-relevant-${item.id}`}
      >
        Уже не актуально
      </Button>
      <div className="space-y-1.5 border-t border-border/60 pt-2">
        <Input
          value={customReason}
          onChange={(e) => setCustomReason(e.target.value)}
          placeholder="Свой вариант…"
          className="h-8 text-sm"
          disabled={busy}
          data-testid={`input-item-custom-reason-${item.id}`}
        />
        <Button
          type="button"
          size="sm"
          className="h-8 w-full"
          disabled={busy || !customReason.trim()}
          onClick={() => void applyStatus("not_relevant", customReason.trim())}
          data-testid={`button-item-custom-reason-${item.id}`}
        >
          Готово
        </Button>
      </div>
    </PopoverContent>
  );

  const checkboxButton = (
    <button
      type="button"
      disabled={readOnly || busy || uploadingPhoto}
      onClick={() => {
        if (readOnly || busy || uploadingPhoto) return;
        if (done) void applyStatus("pending");
        else setMenuOpen(true);
      }}
      data-testid={`checkbox-item-${item.id}`}
      aria-label={done ? "Сбросить позицию" : "Отметить позицию"}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        done
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:border-primary/50",
      )}
    >
      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : null}
    </button>
  );

  const checkboxControl =
    readOnly || done ? (
      checkboxButton
    ) : (
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>{checkboxButton}</PopoverTrigger>
        {completionMenu}
      </Popover>
    );

  const actionButtons = !readOnly ? (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn(
          "h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
          item.itemStatus === "problem" && "text-destructive hover:text-destructive",
        )}
        disabled={busy || uploadingPhoto}
        onClick={() => setProblemOpen((v) => !v)}
        data-testid={`button-item-problem-${item.id}`}
        aria-label="Проблема"
        title="Проблема"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden />
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPhotoSelected(f);
        }}
        data-testid={`input-item-photo-${item.id}`}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        disabled={busy || uploadingPhoto}
        onClick={() => fileRef.current?.click()}
        data-testid={`button-item-photo-${item.id}`}
        aria-label={item.photoUrl ? "Заменить фото" : "Добавить фото"}
        title={item.photoUrl ? "Заменить фото" : "Добавить фото"}
      >
        {uploadingPhoto ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Camera className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </div>
  ) : null;

  const statusBadge = (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        itemStatusTone(item.itemStatus),
      )}
    >
      {ITEM_STATUS_LABEL[item.itemStatus]}
    </span>
  );

  const reasonNote =
    item.itemStatus === "problem" && item.problemReason ? (
      <p className="text-xs text-red-800">{item.problemReason}</p>
    ) : item.itemStatus === "not_relevant" && item.problemReason ? (
      <p className="text-xs text-muted-foreground">{item.problemReason}</p>
    ) : null;

  const proofPhoto =
    item.photoThumbUrl || item.photoUrl ? (
      <a
        href={item.photoUrl ?? item.photoThumbUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block shrink-0"
      >
        <img
          src={item.photoThumbUrl ?? item.photoUrl ?? ""}
          alt={`Фото-доказательство: ${item.modelName}`}
          className="h-8 w-8 rounded border border-border object-cover"
        />
      </a>
    ) : null;

  const problemForm =
    !readOnly && problemOpen ? (
      <div className="col-span-full space-y-2 rounded-md border border-border/80 bg-muted/20 p-2">
        <Select value={problemPreset} onValueChange={setProblemPreset}>
          <SelectTrigger className="h-8 text-sm" data-testid={`select-problem-reason-${item.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROBLEM_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {problemPreset === "__other__" ? (
          <Input
            value={problemOther}
            onChange={(e) => setProblemOther(e.target.value)}
            placeholder="Опишите проблему"
            className="h-8 text-sm"
            data-testid={`input-problem-other-${item.id}`}
          />
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="h-8"
          disabled={busy}
          onClick={confirmProblem}
          data-testid={`button-problem-confirm-${item.id}`}
        >
          Сохранить проблему
        </Button>
      </div>
    ) : null;

  const openPresentation = () => onOpenPresentation(item, modelImageSrc);

  const presentationTrigger = (
    <button
      type="button"
      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={openPresentation}
      onKeyDown={(e) => openPresentationFromKey(e, openPresentation)}
      data-testid={`button-item-presentation-${item.id}`}
      aria-label={`Презентация: ${item.modelName || item.targetId}`}
    >
      <ModelDoorPhotoFrame
        src={modelImageSrc}
        alt={item.modelName}
        size={photoSize}
        variant="assignment"
        imgPaddingClass="p-1"
        placeholderDensity="compact"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "line-clamp-2 font-medium leading-snug",
            isList ? "text-sm" : viewMode === "s" ? "text-xs" : "text-sm",
            done && "text-muted-foreground line-through",
          )}
        >
          {item.modelName || item.targetId}
        </p>
        {isList ? reasonNote : null}
      </div>
    </button>
  );

  if (isList) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/40",
          done && "opacity-60",
        )}
        data-testid={`assignment-item-${item.id}`}
      >
        <div className="flex items-center gap-3">
          <div onClick={stopCardClick} onKeyDown={stopCardClick}>
            {checkboxControl}
          </div>
          {presentationTrigger}
          <div
            className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center"
            onClick={stopCardClick}
            onKeyDown={stopCardClick}
          >
            {proofPhoto}
            {statusBadge}
            {actionButtons}
          </div>
        </div>
        {problemForm}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/40",
        done && "opacity-60",
      )}
      data-testid={`assignment-item-${item.id}`}
    >
      <div className="relative">
        <button
          type="button"
          className="block w-full cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={openPresentation}
          onKeyDown={(e) => openPresentationFromKey(e, openPresentation)}
          data-testid={`button-item-presentation-${item.id}`}
          aria-label={`Презентация: ${item.modelName || item.targetId}`}
        >
          <ModelDoorPhotoFrame
            src={modelImageSrc}
            alt={item.modelName}
            size={photoSize}
            variant="assignment"
            imgPaddingClass="p-1.5"
            placeholderDensity="compact"
          />
        </button>
        <div className="absolute left-2 top-2" onClick={stopCardClick} onKeyDown={stopCardClick}>
          {checkboxControl}
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        <button
          type="button"
          className="w-full cursor-pointer rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={openPresentation}
          onKeyDown={(e) => openPresentationFromKey(e, openPresentation)}
        >
          <p
            className={cn(
              "line-clamp-2 font-medium leading-snug",
              viewMode === "s" ? "text-xs" : "text-sm",
              done && "text-muted-foreground line-through",
            )}
          >
            {item.modelName || item.targetId}
          </p>
        </button>
        {reasonNote}
        <div
          className="flex items-center justify-between gap-2"
          onClick={stopCardClick}
          onKeyDown={stopCardClick}
        >
          <div className="flex items-center gap-1.5">
            {statusBadge}
            {proofPhoto}
          </div>
          {viewMode === "s" ? null : actionButtons}
        </div>
        {viewMode === "s" ? (
          <div className="flex justify-end" onClick={stopCardClick} onKeyDown={stopCardClick}>
            {actionButtons}
          </div>
        ) : null}
      </div>
      {problemForm}
    </div>
  );
}

function AssignmentDetailContent({ initial }: { initial: AssignmentDto }) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [assignment, setAssignment] = useState(initial);
  const [viewMode, setViewMode] = useState<AssignmentViewMode>("list");
  const [imageMaps, setImageMaps] = useState<AssignmentImageMaps>({
    byTargetId: new Map(),
    byModelName: new Map(),
  });
  const [shippedDate, setShippedDate] = useState(initial.shippedDate ?? "");
  const [comment, setComment] = useState(initial.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [followupBusy, setFollowupBusy] = useState(false);
  const [followupComment, setFollowupComment] = useState("");
  const [presentationModel, setPresentationModel] = useState<ShowcaseMatrixModelDefinition | null>(null);
  const [presentationOpen, setPresentationOpen] = useState(false);

  const canEdit = canUserEditAssignment(assignment, user?.id, user?.role);
  const isViewOnly = !canEdit;
  const canVerify = VERIFY_ROLES.has(user?.role ?? "");
  const canComment = canUserCommentAssignment(assignment, user?.id, user?.role);

  useEffect(() => {
    let cancelled = false;
    void fetchAssignmentCatalogImages(assignment.items).then((maps) => {
      if (!cancelled) setImageMaps(maps);
    });
    return () => {
      cancelled = true;
    };
  }, [assignment.items]);

  const verifyCandidates = useMemo(
    () => assignment.items.filter(isVerifyCandidate),
    [assignment.items],
  );

  const [selectedVerifyIds, setSelectedVerifyIds] = useState<Set<string>>(
    () => new Set(verifyCandidates.map((i) => i.id)),
  );

  useEffect(() => {
    setSelectedVerifyIds(new Set(verifyCandidates.map((i) => i.id)));
  }, [assignment.id, verifyCandidates]);

  const hasUnverifiedItems = assignment.items.some((i) => !i.verified);
  const showVerifyBlock = canVerify && (verifyCandidates.length > 0 || assignment.status === "verified");

  const summary = useMemo(() => {
    const shipped = assignment.items.filter((i) => i.itemStatus === "shipped").length;
    const problems = assignment.items.filter((i) => i.itemStatus === "problem").length;
    const installed = assignment.items.filter((i) => i.itemStatus === "installed").length;
    const pending = assignment.items.filter((i) => i.itemStatus === "pending").length;
    const notRelevant = assignment.items.filter((i) => i.itemStatus === "not_relevant").length;
    return { shipped, problems, installed, pending, notRelevant, total: assignment.items.length };
  }, [assignment.items]);

  const canSubmit = canEdit && summary.pending === 0 && summary.total > 0;

  const backHref =
    assignment.dealerId && assignment.tradePointId
      ? `/dealers/${assignment.dealerId}/trade-points/${assignment.tradePointId}`
      : null;

  const onAssignmentUpdated = useCallback(
    (next: AssignmentDto) => {
      setAssignment(next);
      void qc.setQueryData(["assignment", assignment.id], next);
    },
    [assignment.id, qc],
  );

  const openPresentation = useCallback(
    (item: AssignmentDto["items"][number], imageUrl: string | null) => {
      setPresentationModel(itemToPresentationModel(item, imageUrl));
      setPresentationOpen(true);
    },
    [],
  );

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const next = await submitAssignment({
        assignmentId: assignment.id,
        shippedDate: shippedDate || null,
        comment: comment.trim() || null,
      });
      onAssignmentUpdated(next);
      toast({ title: "Задание отправлено" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Не удалось завершить задание",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleVerifyItem = (itemId: string, checked: boolean) => {
    setSelectedVerifyIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  };

  const handleVerify = async () => {
    if (verifying || selectedVerifyIds.size === 0) return;
    setVerifying(true);
    try {
      const next = await verifyAssignment({
        assignmentId: assignment.id,
        itemIds: Array.from(selectedVerifyIds),
      });
      onAssignmentUpdated(next);
      toast({ title: "Подтверждено на витрине" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Не удалось подтвердить на витрине",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleFollowup = async () => {
    if (followupBusy) return;
    setFollowupBusy(true);
    try {
      const next = await createFollowup({
        assignmentId: assignment.id,
        comment: followupComment.trim() || null,
      });
      toast({ title: "Создано повторное задание" });
      setLocation(`/assignment/${next.id}`);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Не удалось создать повторное задание",
        variant: "destructive",
      });
    } finally {
      setFollowupBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "mx-auto space-y-4 pb-28 pt-2",
        viewMode === "list" ? "max-w-lg" : "max-w-2xl",
      )}
      data-testid="page-assignment-detail"
    >
      <BackNav
        breadcrumbs={breadcrumbsFor(`/assignment/${assignment.id}`, {
          assignment: assignment.title || "Задание",
        })}
        fallbackHref={backHref ?? "/assignments"}
        testId="button-assignment-back"
      />

      <Card className="rounded-xl border border-border/60 shadow-sm">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Package className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <CardTitle className="text-lg font-semibold leading-tight">{assignment.title}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge className={cn("border", assignmentStatusTone(assignment.status))}>
                  {ASSIGNMENT_STATUS_LABEL[assignment.status]}
                </Badge>
                {isViewOnly ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    Просмотр
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5 pb-4 text-sm">
          <p className="text-muted-foreground">
            <span className="text-foreground/70">Торговая точка: </span>
            {assignment.tradePointId}
          </p>
          {assignment.createdByName ? (
            <p className="text-muted-foreground">
              <span className="text-foreground/70">Создатель: </span>
              {assignment.createdByName}
            </p>
          ) : null}
          {assignment.assigneeName ? (
            <p className="text-muted-foreground">
              <span className="text-foreground/70">Исполнитель: </span>
              {assignment.assigneeName}
            </p>
          ) : null}
          {assignment.dueDate ? (
            <p className="text-muted-foreground">
              <span className="text-foreground/70">Срок: </span>
              <span
                className={cn(
                  isDueOverdue(assignment.dueDate) &&
                    assignment.status !== "verified" &&
                    assignment.status !== "closed" &&
                    "font-medium text-destructive",
                )}
              >
                {assignment.dueDate}
                {isDueOverdue(assignment.dueDate) &&
                assignment.status !== "verified" &&
                assignment.status !== "closed"
                  ? " · просрочено"
                  : ""}
              </span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          {
            label: "Отгружено",
            value: `${summary.shipped}/${summary.total}`,
            tone: "text-primary",
            testId: "text-assignment-shipped-count",
          },
          {
            label: "Проблемы",
            value: String(summary.problems),
            tone: summary.problems > 0 ? "text-destructive" : "text-foreground",
            testId: "text-assignment-problems-count",
          },
          {
            label: "На витрине",
            value: String(summary.installed),
            tone: "text-emerald-600 dark:text-emerald-400",
            testId: "text-assignment-installed-count",
          },
          {
            label: "Ожидает",
            value: String(summary.pending),
            tone: summary.pending > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground",
            testId: "text-assignment-pending-count",
          },
        ].map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-border/60 bg-card px-3 py-2.5"
          >
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <p className={cn("mt-0.5 text-xl font-bold tabular-nums", tile.tone)} data-testid={tile.testId}>
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Позиции</h2>
          <div className="flex shrink-0 rounded-lg bg-muted/50 p-0.5">
            {(
              [
                ["list", List, "Список"],
                ["m", Grid2x2, "Крупнее"],
                ["s", Grid3x3, "Мельче"],
              ] as const
            ).map(([mode, Icon, label]) => (
              <button
                key={mode}
                type="button"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                  viewMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setViewMode(mode)}
                data-testid={`button-assignment-view-${mode}`}
                aria-label={label}
                title={label}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
        <div className={itemsGridClass(viewMode)}>
          {assignment.items.map((item) => (
            <AssignmentItemCard
              key={item.id}
              assignment={assignment}
              item={item}
              canEdit={canEdit}
              viewMode={viewMode}
              modelImageSrc={resolveItemModelImage(item, imageMaps)}
              onUpdated={onAssignmentUpdated}
              onOpenPresentation={openPresentation}
            />
          ))}
        </div>
      </div>

      <Card className="rounded-xl border border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Завершение задания</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="assignment-shipped-date">Дата отгрузки</Label>
            <Input
              id="assignment-shipped-date"
              type="date"
              value={shippedDate}
              onChange={(e) => setShippedDate(e.target.value)}
              disabled={!canEdit || submitting}
              className="h-10"
              data-testid="input-assignment-shipped-date"
            />
          </div>
          {canEdit ? (
            <div className="space-y-1.5">
              <Label htmlFor="assignment-comment">Комментарий</Label>
              <ChatInputRow
                value={comment}
                onChange={setComment}
                onSend={() => {}}
                placeholder="Комментарий к завершению…"
                disabled={!canEdit || submitting}
                testIdInput="textarea-assignment-comment"
                hideSendButton
              />
            </div>
          ) : comment.trim() ? (
            <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">{comment}</p>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              className="min-h-11 w-full"
              disabled={!canSubmit || submitting}
              onClick={() => void handleSubmit()}
              data-testid="button-assignment-submit"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
              )}
              Завершить задание
            </Button>
          ) : null}
          {canEdit && summary.pending > 0 ? (
            <p className="text-xs text-muted-foreground">
              Отметьте все позиции, чтобы завершить задание.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {showVerifyBlock ? (
        assignment.status === "verified" ? (
          <p className="rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900">
            Витрина подтверждена
            {assignment.verifiedByName ? `: ${assignment.verifiedByName}` : ""}
          </p>
        ) : (
          <Card className="rounded-xl border border-border/80" data-testid="card-assignment-verify">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Подтверждение витрины</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {verifyCandidates.length > 0 ? (
                <ul className="space-y-2">
                  {verifyCandidates.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/20 px-2 py-2"
                      data-testid={`verify-item-${item.id}`}
                    >
                      <Checkbox
                        id={`verify-check-${item.id}`}
                        checked={selectedVerifyIds.has(item.id)}
                        onCheckedChange={(v) => toggleVerifyItem(item.id, v === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor={`verify-check-${item.id}`} className="min-w-0 flex-1 cursor-pointer text-sm">
                        <span className="font-medium">{item.modelName || item.targetId}</span>
                        <span className="block text-xs text-muted-foreground">Отгружено · ожидает подтверждения</span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Нет отгруженных позиций для подтверждения</p>
              )}
              <Button
                type="button"
                className="min-h-11 w-full"
                disabled={verifying || selectedVerifyIds.size === 0}
                onClick={() => void handleVerify()}
                data-testid="button-assignment-verify"
              >
                {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Подтвердить на витрине
              </Button>
              {hasUnverifiedItems ? (
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <Label htmlFor="followup-comment" className="text-xs text-muted-foreground">
                    Комментарий к повторному заданию (необязательно)
                  </Label>
                  <ChatInputRow
                    value={followupComment}
                    onChange={setFollowupComment}
                    onSend={() => void handleFollowup()}
                    placeholder="Комментарий…"
                    disabled={followupBusy}
                    testIdInput="textarea-assignment-followup-comment"
                    testIdSend="button-assignment-followup"
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        )
      ) : null}

      <AssignmentCommentsBlock assignmentId={assignment.id} userId={user?.id} canComment={canComment} />

      <ShowcaseModelPresentationDialog
        open={presentationOpen}
        onOpenChange={setPresentationOpen}
        model={presentationModel}
      />
    </div>
  );
}

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const assignmentId = id?.trim() ?? "";

  const q = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => getAssignment(assignmentId),
    enabled: Boolean(assignmentId),
    retry: false,
  });

  if (!assignmentId) {
    return <AssignmentNotFound />;
  }

  if (q.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" data-testid="page-assignment-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return <AssignmentNotFound />;
  }

  return <AssignmentDetailContent initial={q.data} />;
}
