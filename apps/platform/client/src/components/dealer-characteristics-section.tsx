import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  DEALER_CHARACTERISTIC_IDS,
  DEALER_CHARACTERISTIC_LABELS,
  DEALER_CHARACTERISTICS_EVENT,
  canEditDealerCharacteristics,
  getDealerCharacteristicsOverride,
  loadDealerCharacteristicsState,
  updateDealerCharacteristics,
  type DealerCharacteristicEntry,
  type DealerCharacteristicId,
  type DealerCharacteristicValue,
} from "@/lib/dealer-characteristics";

type DraftMap = Record<DealerCharacteristicId, DealerCharacteristicEntry>;

function isCashbackAgentCharacteristic(id: DealerCharacteristicId): boolean {
  return id === "has_cashback_agent";
}

function characteristicRowTestId(id: DealerCharacteristicId): string {
  return isCashbackAgentCharacteristic(id)
    ? "row-dealer-characteristic-cashback-agent"
    : `row-dealer-characteristic-${id}`;
}

function characteristicNoteTextareaTestId(id: DealerCharacteristicId): string {
  return isCashbackAgentCharacteristic(id)
    ? "textarea-dealer-characteristic-note-cashback-agent"
    : `textarea-dealer-characteristic-note-${id}`;
}

function characteristicValueControlTestId(id: DealerCharacteristicId, v: DealerCharacteristicValue): string {
  if (isCashbackAgentCharacteristic(id)) {
    if (v === "yes") return "toggle-dealer-characteristic-cashback-agent-yes";
    if (v === "no") return "toggle-dealer-characteristic-cashback-agent-no";
    return "toggle-dealer-characteristic-cashback-agent-unset";
  }
  return `button-dealer-characteristic-${id}-${v}`;
}

function emptyDraft(): DraftMap {
  return {
    has_warehouse: { value: "unset", note: "" },
    has_hardware_warehouse: { value: "unset", note: "" },
    is_franchise: { value: "unset", note: "" },
    has_special_conditions: { value: "unset", note: "" },
    has_tandoor_club: { value: "unset", note: "" },
    has_cashback_agent: { value: "unset", note: "" },
  };
}

function draftFromState(dealerId: string): DraftMap {
  const ov = getDealerCharacteristicsOverride(dealerId, loadDealerCharacteristicsState());
  const draft = emptyDraft();
  if (!ov) return draft;
  for (const id of DEALER_CHARACTERISTIC_IDS) {
    const e = ov.characteristics[id];
    if (!e) continue;
    draft[id] = { value: e.value, note: e.note ?? "" };
  }
  return draft;
}

function valueBadgeClass(v: DealerCharacteristicValue): string {
  if (v === "yes") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  if (v === "no") return "border-rose-300 bg-rose-50 text-rose-950";
  return "border-slate-300 bg-slate-50 text-slate-700";
}

function valueLabel(v: DealerCharacteristicValue): string {
  if (v === "yes") return "Да";
  if (v === "no") return "Нет";
  return "Не указано";
}

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
};

export function DealerCharacteristicsSection({ row, profile }: Props) {
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState<DraftMap>(() => draftFromState(row.id));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    window.addEventListener(DEALER_CHARACTERISTICS_EVENT, fn);
    return () => window.removeEventListener(DEALER_CHARACTERISTICS_EVENT, fn);
  }, []);

  useEffect(() => {
    setDraft(draftFromState(row.id));
    setEditing(false);
  }, [row.id]);

  useEffect(() => {
    if (!editing) setDraft(draftFromState(row.id));
  }, [row.id, tick, editing]);

  const canEdit = useMemo(() => canEditDealerCharacteristics(profile, row), [profile, row]);

  const onValueChange = useCallback((id: DealerCharacteristicId, next: DealerCharacteristicValue) => {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], value: next } }));
  }, []);

  const onNoteChange = useCallback((id: DealerCharacteristicId, next: string) => {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], note: next } }));
  }, []);

  const onSave = useCallback(() => {
    updateDealerCharacteristics(row.id, draft, profile);
    setEditing(false);
  }, [draft, row.id, profile]);

  const onCancel = useCallback(() => {
    setDraft(draftFromState(row.id));
    setEditing(false);
  }, [row.id]);

  const filledCount = useMemo(() => {
    let n = 0;
    for (const id of DEALER_CHARACTERISTIC_IDS) {
      if (draft[id].value !== "unset" || (draft[id].note ?? "").trim() !== "") n += 1;
    }
    return n;
  }, [draft]);

  return (
    <section
      id="dealer-section-characteristics"
      data-testid="section-dealer-characteristics"
      className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Характеристики клиента
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Отметьте да/нет и оставьте примечание по нужным признакам — это уточняет фильтры и сигналы по клиенту.
          </p>
        </div>
        {canEdit ? (
          editing ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 font-semibold"
                onClick={onCancel}
                data-testid="button-dealer-characteristics-cancel"
              >
                Отменить
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-9 font-semibold"
                onClick={onSave}
                data-testid="button-dealer-characteristics-save"
              >
                Сохранить
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 font-semibold"
              onClick={() => setEditing(true)}
              data-testid="button-dealer-characteristics-edit"
            >
              Редактировать
            </Button>
          )
        ) : null}
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="space-y-2 px-3 py-3 sm:px-4">
          {!editing && filledCount === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-dealer-characteristics-empty">
              Характеристики не заполнены.
            </p>
          ) : null}
          {DEALER_CHARACTERISTIC_IDS.map((id) => {
            const entry = draft[id];
            const value = entry.value;
            const note = entry.note ?? "";
            if (!editing && value === "unset" && note.trim() === "") return null;
            return (
              <div
                key={id}
                data-testid={characteristicRowTestId(id)}
                className="flex flex-col gap-1.5 border-b border-border py-2 last:border-b-0 sm:flex-row sm:items-start sm:gap-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground">{DEALER_CHARACTERISTIC_LABELS[id]}</p>
                  {!editing ? (
                    <>
                      <Badge
                        variant="outline"
                        className={cn("text-[11px] font-semibold", valueBadgeClass(value))}
                        data-testid={`badge-dealer-characteristic-value-${id}`}
                      >
                        {valueLabel(value)}
                      </Badge>
                      {note.trim() ? (
                        <p
                          className="whitespace-pre-line break-words text-xs text-muted-foreground"
                          data-testid={`text-dealer-characteristic-note-${id}`}
                        >
                          {note.trim()}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={DEALER_CHARACTERISTIC_LABELS[id]}>
                        {(["yes", "no", "unset"] as DealerCharacteristicValue[]).map((v) => {
                          const active = value === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              data-testid={characteristicValueControlTestId(id, v)}
                              onClick={() => onValueChange(id, v)}
                              className={cn(
                                "min-h-9 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                                active
                                  ? v === "yes"
                                    ? "border-emerald-400 bg-emerald-100 text-emerald-950"
                                    : v === "no"
                                      ? "border-rose-400 bg-rose-100 text-rose-950"
                                      : "border-slate-400 bg-slate-100 text-slate-900"
                                  : "border-border bg-card text-muted-foreground hover:bg-muted",
                              )}
                            >
                              {valueLabel(v)}
                            </button>
                          );
                        })}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`dealer-characteristic-note-${id}`} className="text-[11px] text-muted-foreground">
                          Примечание
                        </Label>
                        <Textarea
                          id={`dealer-characteristic-note-${id}`}
                          value={note}
                          onChange={(e) => onNoteChange(id, e.target.value)}
                          placeholder="Короткий комментарий"
                          rows={2}
                          className="min-h-[44px] resize-y text-sm"
                          data-testid={characteristicNoteTextareaTestId(id)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
