import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { createBitrix24LkTask } from "@/lib/bitrix24-integration";
import {
  BITRIX24_TASK_LINKS_CHANGED_EVENT,
  addDealerBitrix24TaskLink,
  addTradePointBitrix24TaskLink,
  getDealerBitrix24TaskLinks,
  getTradePointBitrix24TaskLinks,
  newBitrix24TaskLinkId,
  type Bitrix24TaskLink,
} from "@/lib/bitrix24-task-links";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const LIST_LIMIT = 10;

function formatCreatedAt(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return iso;
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(d));
  } catch {
    return iso;
  }
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
}: Bitrix24TasksPanelProps) {
  const tidPrefix = scope === "dealer" ? "dealer" : "trade-point";
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    window.addEventListener(BITRIX24_TASK_LINKS_CHANGED_EVENT, fn);
    return () => window.removeEventListener(BITRIX24_TASK_LINKS_CHANGED_EVENT, fn);
  }, []);

  const links: Bitrix24TaskLink[] = useMemo(() => {
    if (scope === "dealer") {
      return getDealerBitrix24TaskLinks(dealerId).slice(0, LIST_LIMIT);
    }
    if (!tradePointId) return [];
    return getTradePointBitrix24TaskLinks(dealerId, tradePointId).slice(0, LIST_LIMIT);
  }, [scope, dealerId, tradePointId, tick]);

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
    dealerId,
    dealerName,
    description,
    handleOpenChange,
    scope,
    title,
    tradePointId,
    tradePointName,
  ]);

  if (!canCreate && links.length === 0) {
    return null;
  }

  return (
    <section
      data-testid={`section-${tidPrefix}-bitrix24-tasks`}
      className={cn("scroll-mt-28 space-y-3 sm:scroll-mt-32")}
    >
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Задачи Bitrix24</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Создание задачи в портале Bitrix24 из ЛК. Связь с задачей хранится в этом браузере (без синхронизации статусов из
          Bitrix24).
        </p>
      </div>
      <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
        <CardHeader className="space-y-1 pb-2 pt-5 sm:pb-3">
          <CardTitle className="text-sm font-semibold">Поставленные задачи</CardTitle>
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
                    {formatCreatedAt(l.createdAt)}
                    {" · "}
                    {l.createdByName}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {canCreate ? (
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
        </CardContent>
      </Card>

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
