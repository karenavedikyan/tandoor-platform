import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  canEditClientNextStep,
  CLIENT_NEXT_STEP_CHANGED_EVENT,
  type ClientNextStepActionType,
  getClientNextStepForDealer,
  loadClientNextStepsStorage,
  saveClientNextStep,
} from "@/lib/client-next-step-data";
import { canViewShowcaseDistribution } from "@/lib/showcase-distribution-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

const ACTION_OPTIONS: { id: ClientNextStepActionType; label: string }[] = [
  { id: "call", label: "Звонок" },
  { id: "visit", label: "Визит" },
  { id: "message", label: "Сообщение" },
  { id: "showcase_check", label: "Проверка витрины" },
];

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorLabel: string;
  onSaved: () => void;
};

export function DealerClientNextStepSection({ row, profile, actorUserId, actorLabel, onSaved }: Props) {
  const canView = canViewShowcaseDistribution(profile, row);
  if (!canView) return null;

  const canEdit = canEditClientNextStep(profile, row);
  const [tick, setTick] = useState(0);
  const [actionType, setActionType] = useState<ClientNextStepActionType>("visit");
  const [contactDate, setContactDate] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    window.addEventListener(CLIENT_NEXT_STEP_CHANGED_EVENT, fn);
    return () => window.removeEventListener(CLIENT_NEXT_STEP_CHANGED_EVENT, fn);
  }, []);

  useEffect(() => {
    const s = loadClientNextStepsStorage();
    const cur = getClientNextStepForDealer(row.id, s);
    if (cur) {
      setActionType(cur.actionType);
      setContactDate(cur.contactDate);
      setComment(cur.comment);
    } else {
      setActionType("visit");
      setContactDate("");
      setComment("");
    }
  }, [row.id, tick]);

  const stored = getClientNextStepForDealer(row.id, loadClientNextStepsStorage());

  const onSave = useCallback(() => {
    if (!canEdit || !contactDate.trim()) return;
    saveClientNextStep(row.id, {
      actionType,
      contactDate: contactDate.trim(),
      comment: comment.trim(),
      updatedByUserId: actorUserId,
      updatedByLabel: actorLabel,
    });
    onSaved();
  }, [canEdit, row.id, actionType, contactDate, comment, actorUserId, actorLabel, onSaved]);

  return (
    <section
      id="dealer-section-next-step"
      data-testid="section-dealer-next-step"
      className="scroll-mt-28 space-y-4 sm:scroll-mt-32"
    >
      <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base sm:text-lg">Следующий шаг</CardTitle>
          <CardDescription>
            Запланируйте контакт или проверку витрины. Сохраняется в браузере для этой вкладки.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canEdit ? (
            <p className="text-sm text-muted-foreground" data-testid="text-dealer-next-step-readonly">
              {stored
                ? `Только просмотр. Последнее изменение: ${stored.updatedByLabel} · ${ACTION_OPTIONS.find((o) => o.id === stored.actionType)?.label ?? ""} на ${stored.contactDate}.`
                : "Только просмотр: редактирование доступно менеджеру клиента, РОПу команды и руководителю продаж."}
            </p>
          ) : null}
          {stored && canEdit ? (
            <p className="text-xs text-muted-foreground">
              Последнее сохранение: {stored.updatedByLabel} · {new Date(stored.updatedAt).toLocaleString("ru-RU")}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Тип действия</Label>
              <Select
                value={actionType}
                onValueChange={(v) => setActionType(v as ClientNextStepActionType)}
                disabled={!canEdit}
              >
                <SelectTrigger className="min-h-11" data-testid="select-dealer-next-step-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Дата следующего контакта</Label>
              <Input
                type="date"
                value={contactDate}
                onChange={(e) => setContactDate(e.target.value)}
                disabled={!canEdit}
                className="min-h-11"
                data-testid="input-dealer-next-step-date"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Комментарий</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={!canEdit}
              rows={3}
              className="min-h-[88px] resize-y"
              data-testid="textarea-dealer-next-step-comment"
              placeholder="Например: проверить выставление образцов на витрине"
            />
          </div>
          {canEdit ? (
            <Button
              type="button"
              className="min-h-11 w-full font-semibold sm:w-auto"
              data-testid="button-dealer-next-step-save"
              onClick={onSave}
              disabled={!contactDate.trim()}
            >
              Сохранить
            </Button>
          ) : null}
          {stored && !canEdit ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
              <p className="font-medium">{ACTION_OPTIONS.find((o) => o.id === stored.actionType)?.label}</p>
              <p className="mt-1 text-muted-foreground">Дата контакта: {stored.contactDate}</p>
              {stored.comment ? <p className="mt-2 whitespace-pre-line">{stored.comment}</p> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
