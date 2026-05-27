import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { canEditDealerLegalEntities } from "@/lib/dealer-legal-entities";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  createLegalEntity,
  deleteLegalEntity,
  EDO_OPERATOR_SUGGESTIONS,
  fetchLegalEntitiesForClient,
  patchLegalEntity,
  PAYMENT_FORM_OPTIONS,
  type LegalEntityDto,
  type LegalEntityPaymentForm,
  type LegalEntityUpsertFields,
} from "@/lib/legal-entities-payment-api";
import { formatMoney } from "@/lib/sales-manager-kpi-data";
import { SectionSaveButton } from "@/components/section-save-button";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
  readOnly?: boolean;
};

type EntityDraft = {
  name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  paymentForm: LegalEntityPaymentForm | "";
  paymentDelayDays: string;
  creditLimitRub: string;
  edoEnabled: boolean;
  edoOperator: string;
};

function draftFromEntity(e: LegalEntityDto): EntityDraft {
  return {
    name: e.name ?? "",
    inn: e.inn ?? "",
    kpp: e.kpp ?? "",
    ogrn: e.ogrn ?? "",
    legalAddress: e.legalAddress ?? "",
    paymentForm: e.paymentForm ?? "",
    paymentDelayDays: e.paymentDelayDays != null ? String(e.paymentDelayDays) : "",
    creditLimitRub: e.creditLimitRub != null && e.creditLimitRub !== "" ? String(e.creditLimitRub) : "",
    edoEnabled: e.edoEnabled === true,
    edoOperator: e.edoOperator ?? "",
  };
}

function draftToPayload(d: EntityDraft): LegalEntityUpsertFields {
  const delay = d.paymentDelayDays.trim() === "" ? null : Math.max(0, Math.floor(Number(d.paymentDelayDays)));
  const limit = d.creditLimitRub.trim() === "" ? null : Number(d.creditLimitRub.replace(/\s/g, "").replace(",", "."));
  return {
    name: d.name.trim() || null,
    inn: d.inn.trim() || null,
    kpp: d.kpp.trim() || null,
    ogrn: d.ogrn.trim() || null,
    legalAddress: d.legalAddress.trim() || null,
    paymentForm: d.paymentForm === "" ? null : d.paymentForm,
    paymentDelayDays: delay != null && !Number.isNaN(delay) ? delay : null,
    creditLimitRub: limit != null && !Number.isNaN(limit) ? limit : null,
    edoEnabled: d.edoEnabled,
    edoOperator: d.edoEnabled ? d.edoOperator.trim() || null : null,
  };
}

const EMPTY_DRAFT: EntityDraft = {
  name: "",
  inn: "",
  kpp: "",
  ogrn: "",
  legalAddress: "",
  paymentForm: "",
  paymentDelayDays: "",
  creditLimitRub: "",
  edoEnabled: false,
  edoOperator: "",
};

function LegalEntityCard({
  entity,
  canEdit,
  onSaved,
  onDeleted,
}: {
  entity: LegalEntityDto;
  canEdit: boolean;
  onSaved: (e: LegalEntityDto) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [draft, setDraft] = useState(() => draftFromEntity(entity));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const saveFeedback = useSectionSaveFeedback();

  useEffect(() => {
    setDraft(draftFromEntity(entity));
  }, [entity]);

  const save = useCallback(
    () =>
      saveFeedback.runSave(async () => {
        try {
          const item = await patchLegalEntity(entity.id, draftToPayload(draft));
          onSaved(item);
          toast({ title: "Сохранено", description: entity.name ?? "Юрлицо обновлено" });
          return true;
        } catch (e) {
          toast({
            title: "Ошибка",
            description: e instanceof Error ? e.message : "Не удалось сохранить",
            variant: "destructive",
          });
          return false;
        }
      }),
    [draft, entity.id, entity.name, onSaved, saveFeedback],
  );

  const title = draft.name.trim() || entity.name?.trim() || "Юрлицо без названия";

  return (
    <Card className="rounded-xl border border-border" data-testid={`card-legal-entity-${entity.id}`}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <CardTitle className="truncate text-sm font-semibold">{title}</CardTitle>
        </button>
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Удалить юрлицо"
            data-testid={`button-delete-legal-entity-${entity.id}`}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </CardHeader>
      {expanded ? (
        <CardContent className="space-y-4 pt-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`le-name-${entity.id}`}>Название</Label>
              <Input
                id={`le-name-${entity.id}`}
                value={draft.name}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`le-inn-${entity.id}`}>ИНН</Label>
              <Input id={`le-inn-${entity.id}`} value={draft.inn} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, inn: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`le-kpp-${entity.id}`}>КПП</Label>
              <Input id={`le-kpp-${entity.id}`} value={draft.kpp} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, kpp: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`le-ogrn-${entity.id}`}>ОГРН</Label>
              <Input id={`le-ogrn-${entity.id}`} value={draft.ogrn} disabled={!canEdit} onChange={(e) => setDraft((d) => ({ ...d, ogrn: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`le-addr-${entity.id}`}>Юридический адрес</Label>
              <Input
                id={`le-addr-${entity.id}`}
                value={draft.legalAddress}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, legalAddress: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Платёжные реквизиты</p>
            <div className="space-y-2">
              <Label>Форма оплаты</Label>
              <RadioGroup
                value={draft.paymentForm === "" ? "unset" : draft.paymentForm}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    paymentForm: v === "unset" ? "" : (v as LegalEntityPaymentForm),
                  }))
                }
                className="flex flex-wrap gap-3"
                disabled={!canEdit}
              >
                {PAYMENT_FORM_OPTIONS.map((opt) => (
                  <div key={opt.value || "unset"} className="flex items-center gap-2">
                    <RadioGroupItem value={opt.value === "" ? "unset" : opt.value} id={`pf-${entity.id}-${opt.value || "unset"}`} />
                    <Label htmlFor={`pf-${entity.id}-${opt.value || "unset"}`} className="font-normal">
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`le-delay-${entity.id}`}>Отсрочка (дней)</Label>
                <Input
                  id={`le-delay-${entity.id}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={draft.paymentDelayDays}
                  disabled={!canEdit}
                  onChange={(e) => setDraft((d) => ({ ...d, paymentDelayDays: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`le-limit-${entity.id}`}>Кредитный лимит (₽)</Label>
                <Input
                  id={`le-limit-${entity.id}`}
                  inputMode="decimal"
                  value={draft.creditLimitRub}
                  disabled={!canEdit}
                  placeholder="0"
                  onChange={(e) => setDraft((d) => ({ ...d, creditLimitRub: e.target.value }))}
                />
                {draft.creditLimitRub.trim() && !Number.isNaN(Number(draft.creditLimitRub.replace(/\s/g, "").replace(",", "."))) ? (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatMoney(Number(draft.creditLimitRub.replace(/\s/g, "").replace(",", ".")))}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`le-edo-${entity.id}`}
                checked={draft.edoEnabled}
                disabled={!canEdit}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, edoEnabled: v === true }))}
              />
              <Label htmlFor={`le-edo-${entity.id}`} className="font-normal">
                ЭДО включён
              </Label>
            </div>
            {draft.edoEnabled ? (
              <div className="space-y-1.5">
                <Label htmlFor={`le-edo-op-${entity.id}`}>Оператор ЭДО</Label>
                <Input
                  id={`le-edo-op-${entity.id}`}
                  list={`edo-suggestions-${entity.id}`}
                  value={draft.edoOperator}
                  disabled={!canEdit}
                  placeholder="Диадок, СБИС, Контур…"
                  onChange={(e) => setDraft((d) => ({ ...d, edoOperator: e.target.value }))}
                />
                <datalist id={`edo-suggestions-${entity.id}`}>
                  {EDO_OPERATOR_SUGGESTIONS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            ) : null}
          </div>

          {canEdit ? (
            <div className="flex justify-end">
              <SectionSaveButton
                testId={`button-save-legal-entity-${entity.id}`}
                phase={saveFeedback.phase}
                onSave={() => void save()}
              />
            </div>
          ) : null}
        </CardContent>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить юрлицо?</AlertDialogTitle>
            <AlertDialogDescription>Запись «{title}» будет удалена без возможности восстановления.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void (async () => {
                  try {
                    await deleteLegalEntity(entity.id);
                    onDeleted(entity.id);
                    toast({ title: "Удалено" });
                  } catch (e) {
                    toast({
                      title: "Ошибка",
                      description: e instanceof Error ? e.message : "Не удалось удалить",
                      variant: "destructive",
                    });
                  }
                })();
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function DealerLegalEntityRequisitesSection({ row, profile, readOnly }: Props) {
  const canEdit = !readOnly && canEditDealerLegalEntities(profile, row);
  const [items, setItems] = useState<LegalEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchLegalEntitiesForClient(row.id);
      setItems(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Не удалось загрузить юрлица");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [row.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addEntity = async () => {
    setCreating(true);
    try {
      const item = await createLegalEntity(row.id, { name: "Новое юрлицо", ...draftToPayload(EMPTY_DRAFT) });
      setItems((prev) => [...prev, item]);
      toast({ title: "Юрлицо добавлено" });
    } catch (e) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : "Не удалось создать",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <section
      id="dealer-section-payment-requisites"
      data-testid="section-dealer-payment-requisites"
      className="scroll-mt-28 space-y-3 sm:scroll-mt-32"
    >
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Реквизиты</h2>
        <p className="text-sm text-muted-foreground">
          Старые поля платёжных условий доступны в разделе «Условия». Новые юрлица — здесь.
        </p>
      </div>

      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>{loadError}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">Загрузка юрлиц…</p> : null}

      {!loading && !loadError ? (
        <div className={cn("space-y-3", items.length === 0 && "rounded-xl border border-dashed border-border p-4")}>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Юрлица не добавлены. Создайте первое для платёжных реквизитов.</p>
          ) : (
            items.map((e) => (
              <LegalEntityCard
                key={e.id}
                entity={e}
                canEdit={canEdit}
                onSaved={(next) => setItems((prev) => prev.map((x) => (x.id === next.id ? next : x)))}
                onDeleted={(id) => setItems((prev) => prev.filter((x) => x.id !== id))}
              />
            ))
          )}
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={creating}
              data-testid="button-add-legal-entity-requisites"
              onClick={() => void addEntity()}
            >
              <Plus className="h-4 w-4" />
              Добавить юрлицо
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
