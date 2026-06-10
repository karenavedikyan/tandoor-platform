import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MatrixCatalogProductPicker,
  type Catalog1cPicked,
} from "@/components/distribution/matrix-catalog-product-picker";
import { useToast } from "@/hooks/use-toast";
import { createAssignmentsBatch, type AssignmentItemInput } from "@/lib/showcase-assignments-api";
import type { TaskSelectTarget } from "@/lib/task-select-mode";
import { listManagerPickerUsers, pickerUserById, type PickerUser } from "@/lib/users-picker-api";

type Props = {
  open: boolean;
  targets: TaskSelectTarget[];
  onOpenChange: (open: boolean) => void;
  onRemoveTarget: (tradePointId: string) => void;
  onSuccess: () => void;
};

export function CreateTaskBatchDialog({
  open,
  targets,
  onOpenChange,
  onRemoveTarget,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [managers, setManagers] = useState<PickerUser[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [selectedModels, setSelectedModels] = useState<Map<string, string>>(() => new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setComment("");
    setDueDate("");
    setAssigneeUserId("");
    setSelectedModels(new Map());
    setError("");
    setLoadingManagers(true);
    void listManagerPickerUsers()
      .then(setManagers)
      .catch(() => setManagers([]))
      .finally(() => setLoadingManagers(false));
  }, [open]);

  const items: AssignmentItemInput[] = useMemo(
    () =>
      Array.from(selectedModels.entries()).map(([targetId, modelName]) => ({
        targetKind: "model" as const,
        targetId,
        modelName,
      })),
    [selectedModels],
  );

  const excludeCatalogIds = useMemo(() => new Set(selectedModels.keys()), [selectedModels]);

  const handleCatalogConfirm = useCallback((products: Catalog1cPicked[]) => {
    setSelectedModels((prev) => {
      const next = new Map(prev);
      for (const p of products) next.set(p.id, p.displayName?.trim() || p.name);
      return next;
    });
  }, []);

  const removeModel = (id: string) => {
    setSelectedModels((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting || targets.length === 0) return;
    if (items.length === 0) {
      setError("Выберите хотя бы одну модель");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const picked = pickerUserById(managers, assigneeUserId || null);
      const result = await createAssignmentsBatch({
        targets: targets.map((t) => ({ dealerId: t.dealerId, tradePointId: t.tradePointId })),
        items,
        title: title.trim() || undefined,
        comment: comment.trim() || null,
        dueDate: dueDate || null,
        assigneeUserId: picked?.id ?? null,
        assigneeName: picked?.full_name ?? null,
      });
      toast({
        title: `Создано: ${result.createdCount}, пропущено: ${result.skippedCount}`,
      });
      onOpenChange(false);
      onSuccess();
      setLocation("/assignments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать задания");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden"
          data-testid="dialog-create-task-batch"
        >
          <DialogHeader>
            <DialogTitle>Пакетное создание задания</DialogTitle>
            <DialogDescription>
              Одни и те же модели будут добавлены в задания для {targets.length} торговых точек.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Торговые точки</p>
              <ul className="space-y-1.5">
                {targets.map((t) => (
                  <li
                    key={t.tradePointId}
                    className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 leading-snug">
                      {t.dealerName} · {t.tradePointName}
                      {t.city ? ` · ${t.city}` : ""}
                    </span>
                    {targets.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => onRemoveTarget(t.tradePointId)}
                        aria-label="Убрать из набора"
                        data-testid={`button-batch-remove-tp-${t.tradePointId}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Модели</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setCatalogOpen(true)}
                  data-testid="button-batch-add-models"
                >
                  <Plus className="h-4 w-4" />
                  Добавить из каталога
                </Button>
              </div>
              {selectedModels.size === 0 ? (
                <p className="text-sm text-muted-foreground">Модели не выбраны</p>
              ) : (
                <ul className="space-y-1">
                  {Array.from(selectedModels.entries()).map(([id, name]) => (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                    >
                      <span className="line-clamp-2 min-w-0">{name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => removeModel(id)}
                        aria-label="Убрать модель"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="batch-task-title">Заголовок (необязательно)</Label>
                <Input
                  id="batch-task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting}
                  placeholder="Отгрузить на витрину"
                  data-testid="input-batch-task-title"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="batch-task-comment">Комментарий</Label>
                <Textarea
                  id="batch-task-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={submitting}
                  rows={2}
                  data-testid="textarea-batch-task-comment"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-task-due">Срок</Label>
                <Input
                  id="batch-task-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={submitting}
                  data-testid="input-batch-task-due"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Исполнитель</Label>
                <Select
                  value={assigneeUserId || "__none__"}
                  onValueChange={(v) => setAssigneeUserId(v === "__none__" ? "" : v)}
                  disabled={submitting || loadingManagers}
                >
                  <SelectTrigger data-testid="select-batch-task-assignee">
                    <SelectValue placeholder={loadingManagers ? "Загрузка…" : "Авто по каждой ТТ"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Авто по каждой ТТ</SelectItem>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Отмена
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || targets.length === 0 || items.length === 0}
              data-testid="button-batch-create-assignments"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Создать задания ({targets.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MatrixCatalogProductPicker
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        excludeIds={excludeCatalogIds}
        onConfirm={handleCatalogConfirm}
      />
    </>
  );
}
