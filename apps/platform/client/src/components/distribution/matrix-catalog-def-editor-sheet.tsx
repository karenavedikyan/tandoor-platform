import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarIcon, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  MatrixCatalogProductPicker,
  type Catalog1cPicked,
} from "@/components/distribution/matrix-catalog-product-picker";
import { CLIENT_CATEGORY_META, type ClientCategoryId } from "@/lib/client-category";
import { formatMatrixDefUpdatedLabel, inferMatrixSegmentFrom1c, isMatrixPeriodRangeValid } from "@/lib/distribution-matrix-catalog-view-model";
import { PLACEMENT_SEGMENT_LABEL_RU } from "@/lib/showcase-placement-labels";
import type {
  ShowcaseMatrixCatalogPriority,
  ShowcaseMatrixCatalogScopeKind,
  ShowcaseMatrixCatalogSegment,
  ShowcaseMatrixCatalogStatus,
  ShowcaseMatrixCatalogTargetKind,
  ShowcaseMatrixDefDto,
  ShowcaseMatrixDefModelInput,
} from "@/lib/showcase-matrix-catalog-api";
import {
  loadCachedMatrixDef,
  refreshMatrixDefFromServer,
  replaceMatrixDefModelsLocal,
  upsertMatrixDefLocal,
} from "@/lib/showcase-matrix-catalog-store";
import { priorityLabelRu } from "@/lib/trade-point-showcase-matrix-models";
import { cn } from "@/lib/utils";

export type MatrixCatalogEditorMode = "create" | "edit";

export type MatrixCatalogDefEditorSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: MatrixCatalogEditorMode;
  defId: string | null;
  initialClientCategory?: ClientCategoryId;
  canEdit: boolean;
  onSaved: () => void;
};

type EditorModelRow = ShowcaseMatrixDefModelInput & {
  key: string;
  displayName?: string | null;
  imageUrl?: string | null;
  brand?: string | null;
};

const PRIORITIES: ShowcaseMatrixCatalogPriority[] = ["high", "medium", "low"];
const SEGMENTS: ShowcaseMatrixCatalogSegment[] = ["vh", "mk", "hardware"];
const TARGET_KINDS: ShowcaseMatrixCatalogTargetKind[] = ["model", "variant"];

function parseIsoDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toIsoDate(d: Date | undefined): string | null {
  if (!d) return null;
  return format(d, "yyyy-MM-dd");
}

function MatrixDateField(props: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
  testId?: string;
}): ReactElement {
  const { label, value, onChange, disabled, testId } = props;
  const selected = parseIsoDate(value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
            data-testid={testId}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selected ? format(selected, "dd.MM.yyyy", { locale: ru }) : "Не задано"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={selected} onSelect={(d) => onChange(toIsoDate(d))} locale={ru} initialFocus />
          {value ? (
            <div className="border-t border-border p-2">
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange(null)}>
                Очистить
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function newRowKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function modelsFromDef(defId: string | null): EditorModelRow[] {
  if (!defId) return [];
  const full = loadCachedMatrixDef(defId);
  if (!full?.models.length) return [];
  return full.models
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({
      key: m.id,
      id: m.id,
      targetKind: m.targetKind,
      targetId: m.targetId,
      priority: m.priority,
      segment: m.segment,
      valueWeight: m.valueWeight,
      sortOrder: m.sortOrder,
    }));
}

export function MatrixCatalogDefEditorSheet(props: MatrixCatalogDefEditorSheetProps): ReactElement {
  const { open, onOpenChange, mode, defId, initialClientCategory, canEdit, onSaved } = props;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [periodError, setPeriodError] = useState(false);

  const [clientCategory, setClientCategory] = useState<ClientCategoryId>("top150");
  const [scopeKind, setScopeKind] = useState<ShowcaseMatrixCatalogScopeKind>("global");
  const [scopeRegion, setScopeRegion] = useState("");
  const [scopeCity, setScopeCity] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null);
  const [effectiveTo, setEffectiveTo] = useState<string | null>(null);
  const [seasonLabel, setSeasonLabel] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<ShowcaseMatrixCatalogStatus>("draft");
  const [models, setModels] = useState<EditorModelRow[]>([]);
  const [loadedDefMeta, setLoadedDefMeta] = useState<Pick<
    ShowcaseMatrixDefDto,
    "id" | "updatedAt" | "updatedByName"
  > | null>(null);

  const resetForm = useCallback(() => {
    setClientCategory(initialClientCategory ?? "top150");
    setScopeKind("global");
    setScopeRegion("");
    setScopeCity("");
    setEffectiveFrom(null);
    setEffectiveTo(null);
    setSeasonLabel("");
    setTitle("");
    setComment("");
    setStatus("draft");
    setModels([]);
    setLoadedDefMeta(null);
    setPeriodError(false);
  }, [initialClientCategory]);

  const applyDef = useCallback((def: ShowcaseMatrixDefDto) => {
    setClientCategory(def.clientCategory as ClientCategoryId);
    setScopeKind(def.scopeKind);
    setScopeRegion(def.scopeRegion ?? "");
    setScopeCity(def.scopeCity ?? "");
    setEffectiveFrom(def.effectiveFrom);
    setEffectiveTo(def.effectiveTo);
    setSeasonLabel(def.seasonLabel ?? "");
    setTitle(def.title ?? "");
    setComment(def.comment ?? "");
    setStatus(def.status === "archived" ? "draft" : def.status);
    setModels(modelsFromDef(def.id));
    setLoadedDefMeta(
      def.id
        ? { id: def.id, updatedAt: def.updatedAt, updatedByName: def.updatedByName }
        : null,
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      resetForm();
      return;
    }
    if (!defId) return;
    const cached = loadCachedMatrixDef(defId);
    if (cached) {
      applyDef(cached);
      return;
    }
    setLoading(true);
    void refreshMatrixDefFromServer(defId).then((full) => {
      setLoading(false);
      if (full) applyDef(full);
    });
  }, [open, mode, defId, resetForm, applyDef]);

  const excludeProductIds = useMemo(() => new Set(models.map((m) => m.targetId)), [models]);

  const moveModel = (index: number, dir: -1 | 1) => {
    const next = [...models];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[j]!;
    next[j] = tmp;
    setModels(next.map((m, i) => ({ ...m, sortOrder: i })));
  };

  const removeModel = (key: string) => {
    setModels((prev) => prev.filter((m) => m.key !== key).map((m, i) => ({ ...m, sortOrder: i })));
  };

  const patchModel = (key: string, patch: Partial<EditorModelRow>) => {
    setModels((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  };

  const addProducts = (products: Catalog1cPicked[]) => {
    setModels((prev) => {
      const next = [...prev];
      for (const p of products) {
        if (next.some((m) => m.targetId === p.id)) continue;
        const hint = [p.doorTypeHint, p.categoryHint, p.name, p.displayName].filter(Boolean).join(" ");
        next.push({
          key: newRowKey(),
          targetKind: "model",
          targetId: p.id,
          priority: "medium",
          segment: inferMatrixSegmentFrom1c(hint),
          valueWeight: null,
          sortOrder: next.length,
          displayName: p.displayName ?? p.name,
          imageUrl: p.imageUrl ?? null,
          brand: p.brand ?? null,
        });
      }
      return next;
    });
  };

  const handleSave = () => {
    if (!canEdit) return;
    const validPeriod = isMatrixPeriodRangeValid(effectiveFrom, effectiveTo);
    setPeriodError(!validPeriod);
    if (!validPeriod) return;
    if (scopeKind === "region" && !scopeRegion.trim()) return;
    if (scopeKind === "city" && (!scopeCity.trim() || !scopeRegion.trim())) return;

    setSaving(true);
    try {
      const { def } = upsertMatrixDefLocal({
        id: mode === "edit" && defId ? defId : undefined,
        clientCategory,
        scopeKind,
        scopeRegion: scopeKind === "global" ? null : scopeRegion.trim() || null,
        scopeCity: scopeKind === "city" ? scopeCity.trim() || null : null,
        effectiveFrom,
        effectiveTo,
        seasonLabel: seasonLabel.trim() || null,
        title: title.trim() || null,
        comment: comment.trim() || null,
        status,
      });

      const modelInputs: ShowcaseMatrixDefModelInput[] = models.map((m, index) => ({
        id: m.id,
        targetKind: m.targetKind,
        targetId: m.targetId,
        priority: m.priority ?? "medium",
        segment: m.segment,
        valueWeight: m.valueWeight ?? null,
        sortOrder: index,
      }));
      replaceMatrixDefModelsLocal(def.id, modelInputs);
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const sheetTitle = mode === "create" ? "Новая матрица" : canEdit ? "Редактирование матрицы" : "Просмотр матрицы";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col overflow-hidden sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{sheetTitle}</SheetTitle>
            {loadedDefMeta?.id ? (
              <p className="text-xs text-muted-foreground" data-testid="text-matrix-catalog-editor-updated">
                Обновлено: {formatMatrixDefUpdatedLabel(loadedDefMeta)}
              </p>
            ) : null}
          </SheetHeader>

          {loading ? (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          ) : (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
              <section className="space-y-4">
                <h3 className="text-sm font-medium text-foreground">Заголовок</h3>

                <div className="space-y-2">
                  <Label>Тип клиента</Label>
                  <Select
                    value={clientCategory}
                    onValueChange={(v) => setClientCategory(v as ClientCategoryId)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger data-testid="select-matrix-catalog-client-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_CATEGORY_META.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Область действия</Label>
                  <RadioGroup
                    value={scopeKind}
                    onValueChange={(v) => setScopeKind(v as ShowcaseMatrixCatalogScopeKind)}
                    className="flex flex-col gap-2"
                  >
                    {(["global", "region", "city"] as const).map((sk) => (
                      <div key={sk} className="flex items-center gap-2">
                        <RadioGroupItem value={sk} id={`scope-${sk}`} disabled={!canEdit} />
                        <Label htmlFor={`scope-${sk}`} className="font-normal">
                          {sk === "global" ? "Глобально" : sk === "region" ? "Регион" : "Город"}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {scopeKind === "region" || scopeKind === "city" ? (
                  <div className="space-y-2">
                    <Label htmlFor="matrix-scope-region">Регион</Label>
                    <Input
                      id="matrix-scope-region"
                      value={scopeRegion}
                      onChange={(e) => setScopeRegion(e.target.value)}
                      disabled={!canEdit}
                      placeholder="Например, Краснодарский край"
                    />
                  </div>
                ) : null}

                {scopeKind === "city" ? (
                  <div className="space-y-2">
                    <Label htmlFor="matrix-scope-city">Город</Label>
                    <Input
                      id="matrix-scope-city"
                      value={scopeCity}
                      onChange={(e) => setScopeCity(e.target.value)}
                      disabled={!canEdit}
                      placeholder="Например, Краснодар"
                    />
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <MatrixDateField
                    label="Период с"
                    value={effectiveFrom}
                    onChange={setEffectiveFrom}
                    disabled={!canEdit}
                    testId="button-matrix-catalog-effective-from"
                  />
                  <MatrixDateField
                    label="Период по"
                    value={effectiveTo}
                    onChange={setEffectiveTo}
                    disabled={!canEdit}
                    testId="button-matrix-catalog-effective-to"
                  />
                </div>
                {periodError ? (
                  <p className="text-sm text-destructive">Дата начала не может быть позже даты окончания.</p>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="matrix-season">Сезон</Label>
                  <Input
                    id="matrix-season"
                    value={seasonLabel}
                    onChange={(e) => setSeasonLabel(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Например, Зима 2026"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="matrix-title">Название версии</Label>
                  <Input id="matrix-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="matrix-comment">Комментарий</Label>
                  <Textarea
                    id="matrix-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={!canEdit}
                    rows={3}
                  />
                </div>

                {canEdit ? (
                  <div className="space-y-2">
                    <Label>Статус</Label>
                    <RadioGroup
                      value={status}
                      onValueChange={(v) => setStatus(v as ShowcaseMatrixCatalogStatus)}
                      className="flex flex-wrap gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="draft" id="status-draft" />
                        <Label htmlFor="status-draft" className="font-normal">
                          Черновик
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="published" id="status-published" />
                        <Label htmlFor="status-published" className="font-normal">
                          Опубликовано
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                ) : null}
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground">Состав моделей</h3>
                  {canEdit ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                      <Plus className="mr-1 h-4 w-4" />
                      Добавить модели
                    </Button>
                  ) : null}
                </div>

                {models.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Позиции не добавлены.</p>
                ) : (
                  <ul className="space-y-3">
                    {models.map((m, index) => {
                      const typeShort =
                        m.segment === "vh" ? "ВХ" : m.segment === "mk" ? "МК" : m.segment === "hardware" ? "Фурн." : "—";
                      const label = m.displayName?.trim() || m.targetId;
                      return (
                        <li key={m.key} className="rounded-lg border border-border bg-card p-3">
                          <div className="flex gap-2">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted/40">
                              {m.imageUrl ? (
                                <img src={m.imageUrl} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">{label}</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                                  {typeShort}
                                </Badge>
                                {m.brand?.trim() ? (
                                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                                    {m.brand}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                            {canEdit ? (
                              <div className="flex shrink-0 flex-col gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={index === 0}
                                  onClick={() => moveModel(index, -1)}
                                  aria-label="Выше"
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={index === models.length - 1}
                                  onClick={() => moveModel(index, 1)}
                                  aria-label="Ниже"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Приоритет</Label>
                              <Select
                                value={m.priority ?? "medium"}
                                onValueChange={(v) => patchModel(m.key, { priority: v as ShowcaseMatrixCatalogPriority })}
                                disabled={!canEdit}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRIORITIES.map((p) => (
                                    <SelectItem key={p} value={p}>
                                      {priorityLabelRu(p)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Сегмент</Label>
                              <Select
                                value={m.segment}
                                onValueChange={(v) => patchModel(m.key, { segment: v as ShowcaseMatrixCatalogSegment })}
                                disabled={!canEdit}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SEGMENTS.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {PLACEMENT_SEGMENT_LABEL_RU[s]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Тип цели</Label>
                              <Select
                                value={m.targetKind}
                                onValueChange={(v) => patchModel(m.key, { targetKind: v as ShowcaseMatrixCatalogTargetKind })}
                                disabled={!canEdit}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TARGET_KINDS.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t === "model" ? "Модель" : "Вариант"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Вес (качественная дистрибуция)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                className="h-9"
                                value={m.valueWeight ?? ""}
                                onChange={(e) => {
                                  const raw = e.target.value.trim();
                                  patchModel(m.key, { valueWeight: raw === "" ? null : Number(raw) });
                                }}
                                disabled={!canEdit}
                                placeholder="Необязательно"
                              />
                            </div>
                          </div>

                          {canEdit ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="mt-2 text-destructive hover:text-destructive"
                              onClick={() => removeModel(m.key)}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Удалить позицию
                            </Button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}

          {canEdit ? (
            <div className="flex shrink-0 gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button
                type="button"
                disabled={saving || loading}
                onClick={handleSave}
                data-testid="button-matrix-catalog-save"
              >
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {canEdit ? (
        <MatrixCatalogProductPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          excludeIds={excludeProductIds}
          onConfirm={addProducts}
        />
      ) : null}
    </>
  );
}
