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
  clientNextStepActionLabel,
  getClientNextStepForDealer,
  loadClientNextStepsStorage,
  saveClientNextStep,
} from "@/lib/client-next-step-data";
import { canViewShowcaseDistribution } from "@/lib/showcase-distribution-data";
import { canActualizeClientBase } from "@/lib/client-base-actualization-permissions";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { cn } from "@/lib/utils";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { SectionSaveButton } from "@/components/section-save-button";

const ACTION_OPTIONS: { id: ClientNextStepActionType; label: string }[] = [
  { id: "call", label: "Звонок" },
  { id: "visit", label: "Визит" },
  { id: "message", label: "Сообщение" },
  { id: "showcase_check", label: "Проверка витрины" },
];

function formatIsoDayToRu(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso.trim();
  return `${m[3]}.${m[2]}.${m[1]}`;
}

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorLabel: string;
  onSaved: () => void;
  /** Карточка ручного клиента в актуализации: показать блок без витрины release. */
  allowManualActualizationCard?: boolean;
  readOnly?: boolean;
};

export function DealerClientNextStepSection({
  row,
  profile,
  actorUserId,
  actorLabel,
  onSaved,
  allowManualActualizationCard,
  readOnly = false,
}: Props) {
  const canView = allowManualActualizationCard
    ? canActualizeClientBase(profile)
    : canViewShowcaseDistribution(profile, row);
  if (!canView) return null;

  const canEdit = canEditClientNextStep(profile, row) && !readOnly;
  const nextStepSave = useSectionSaveFeedback();
  const [tick, setTick] = useState(0);
  const [actionType, setActionType] = useState<ClientNextStepActionType>("visit");
  const [contactDate, setContactDate] = useState("");
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);

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

  useEffect(() => {
    const s = loadClientNextStepsStorage();
    const cur = getClientNextStepForDealer(row.id, s);
    setEditing(!cur);
  }, [row.id]);

  const stored = getClientNextStepForDealer(row.id, loadClientNextStepsStorage());

  const onSave = useCallback((): boolean => {
    if (!canEdit || !contactDate.trim()) return false;
    saveClientNextStep(row.id, {
      actionType,
      contactDate: contactDate.trim(),
      comment: comment.trim(),
      updatedByUserId: actorUserId,
      updatedByLabel: actorLabel,
    });
    setEditing(false);
    onSaved();
    return true;
  }, [canEdit, row.id, actionType, contactDate, comment, actorUserId, actorLabel, onSaved]);

  const summaryText = stored
    ? `${clientNextStepActionLabel(stored.actionType)} · ${formatIsoDayToRu(stored.contactDate)}${
        stored.comment?.trim() ? ` · ${stored.comment.trim()}` : ""
      } · обновил(а): ${stored.updatedByLabel}`
    : canEdit
      ? "Шаг не запланирован — укажите дату контакта и сохраните."
      : "Шаг не запланирован.";

  const showForm = !stored || editing;

  return (
    <section
      id="dealer-section-next-step"
      data-testid="section-dealer-next-step"
      className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
    >
      <Card className="rounded-xl border border-border/70 bg-card shadow-xs">
        <CardHeader className="space-y-1 p-3 pb-2 sm:p-4">
          <CardTitle className="text-sm sm:text-base">Следующий шаг</CardTitle>
          {stored && canEdit && !showForm ? null : (
            <CardDescription className="text-xs">
              План контакта сохраняется в браузере до закрытия вкладки.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3 p-3 pt-0 sm:p-4 sm:pt-0">
          {!canEdit ? (
            <p className="text-xs text-muted-foreground" data-testid="text-dealer-next-step-readonly">
              {stored
                ? `Только просмотр. Последнее изменение: ${stored.updatedByLabel}.`
                : "Только просмотр: редактирование доступно менеджеру клиента, РОПу команды и руководителю продаж."}
            </p>
          ) : null}

          {stored && canEdit && !showForm ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <p className="text-sm font-medium leading-snug text-foreground" data-testid="text-dealer-next-step-summary">
                {summaryText}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 w-full shrink-0 font-semibold sm:w-auto"
                data-testid="button-dealer-next-step-edit"
                onClick={() => setEditing(true)}
              >
                Изменить
              </Button>
            </div>
          ) : (
            <p
              className={cn("text-sm font-medium leading-snug text-foreground", !stored && "text-muted-foreground")}
              data-testid="text-dealer-next-step-summary"
            >
              {summaryText}
            </p>
          )}

          {showForm ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Тип действия</Label>
                  <Select
                    value={actionType}
                    onValueChange={(v) => {
                      setActionType(v as ClientNextStepActionType);
                      nextStepSave.markDirty();
                    }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="min-h-10" data-testid="select-dealer-next-step-type">
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Дата следующего контакта</Label>
                  <Input
                    type="date"
                    value={contactDate}
                    onChange={(e) => {
                      setContactDate(e.target.value);
                      nextStepSave.markDirty();
                    }}
                    disabled={!canEdit}
                    className="min-h-10"
                    data-testid="input-dealer-next-step-date"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Комментарий</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    nextStepSave.markDirty();
                  }}
                  disabled={!canEdit}
                  rows={3}
                  className="min-h-[72px] resize-y text-sm"
                  data-testid="textarea-dealer-next-step-comment"
                  placeholder="Например: проверить выставление образцов на витрине"
                />
              </div>
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <SectionSaveButton
                    testId="button-dealer-next-step-save"
                    statusTestId="text-save-status-next-step"
                    phase={nextStepSave.phase}
                    onSave={() => void nextStepSave.runSave(async () => Promise.resolve(onSave()))}
                    disabled={!contactDate.trim()}
                  />
                  {stored ? (
                    <Button type="button" variant="ghost" size="sm" className="min-h-9" onClick={() => setEditing(false)}>
                      Отмена
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
