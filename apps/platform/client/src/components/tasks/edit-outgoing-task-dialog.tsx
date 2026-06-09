import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { listManagerPickerUsers, pickerUserById, type PickerUser } from "@/lib/users-picker-api";
import { updateAssignment } from "@/lib/showcase-assignments-api";
import type { UnifiedTask } from "@/lib/tasks-inbox-model";

type Props = {
  open: boolean;
  task: UnifiedTask | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function EditOutgoingTaskDialog({ open, task, onOpenChange, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState<string>("");
  const [managers, setManagers] = useState<PickerUser[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !task) return;
    setTitle(task.title);
    setComment(task.comment ?? "");
    setDueDate(task.dueDate ?? "");
    setAssigneeUserId("");
    setError("");
    setLoadingManagers(true);
    void listManagerPickerUsers()
      .then((users) => {
        setManagers(users);
        const match = users.find((u) => u.full_name === task.assigneeName);
        if (match) setAssigneeUserId(match.id);
      })
      .catch(() => setManagers([]))
      .finally(() => setLoadingManagers(false));
  }, [open, task]);

  const handleSave = async () => {
    if (!task || saving) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Укажите заголовок");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const picked = pickerUserById(managers, assigneeUserId || null);
      await updateAssignment({
        assignmentId: task.entityId,
        title: trimmedTitle,
        comment: comment.trim() || null,
        dueDate: dueDate || null,
        assigneeUserId: assigneeUserId || null,
        assigneeName: picked?.full_name ?? null,
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-edit-outgoing-task">
        <DialogHeader>
          <DialogTitle>Редактировать задание</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-title">Заголовок</Label>
            <Input
              id="edit-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              data-testid="input-edit-task-title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-comment">Комментарий</Label>
            <Textarea
              id="edit-task-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={saving}
              rows={3}
              data-testid="textarea-edit-task-comment"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-due">Срок</Label>
            <Input
              id="edit-task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={saving}
              data-testid="input-edit-task-due-date"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Исполнитель</Label>
            <Select
              value={assigneeUserId || "__none__"}
              onValueChange={(v) => setAssigneeUserId(v === "__none__" ? "" : v)}
              disabled={saving || loadingManagers}
            >
              <SelectTrigger data-testid="select-edit-task-assignee">
                <SelectValue placeholder={loadingManagers ? "Загрузка…" : "Не назначен"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Не назначен</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving} data-testid="button-edit-task-save">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
