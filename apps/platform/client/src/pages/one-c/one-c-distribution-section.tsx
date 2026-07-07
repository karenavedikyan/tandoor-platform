import { useCallback, useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDisplayDateTime } from "@/lib/format-display-date";
import {
  deleteOneCStoreOverride,
  postOneCStoreMatrix,
  postOneCStoreOverride,
  type OneCHistoryRowDto,
  type OneCMatrixRowDto,
  type OneCOverrideDto,
  type OneCStoreDistributionState,
} from "@/lib/one-c-showroom-api";
import {
  allowedTypesForSegment,
  PLACEMENT_SEGMENT_LABEL_RU,
  PLACEMENT_TYPE_LABEL_RU,
} from "@/lib/showcase-placement-labels";
import type { ShowcasePlacementSegment, ShowcasePlacementType } from "@/lib/showcase-matrix-api";
import { cn } from "@/lib/utils";
import { OneCDetailSection } from "./one-c-ui";

const CATEGORY_LABEL: Record<string, string> = {
  entrance_doors: "Входные двери",
  interior_doors: "Межкомнатные двери",
  hardware: "Фурнитура",
  molding: "Плинтусы и доборы",
};

const SEGMENTS: ShowcasePlacementSegment[] = ["vh", "mk", "hardware"];

function newClientOpId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}`;
}

type Props = {
  storeId1c: string;
  matrix: OneCMatrixRowDto[];
  overrides: OneCOverrideDto[];
  history: OneCHistoryRowDto[];
  distributionFill: { filled: number; total: number };
  canEdit: boolean;
  onStateChange: (state: OneCStoreDistributionState) => void;
};

export function OneCDistributionSection({
  storeId1c,
  matrix,
  overrides,
  history,
  distributionFill,
  canEdit,
  onStateChange,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const [segment, setSegment] = useState<ShowcasePlacementSegment>("vh");
  const [placementType, setPlacementType] = useState<ShowcasePlacementType>("portal");
  const [capacityInput, setCapacityInput] = useState("4");
  const [actualInput, setActualInput] = useState("0");

  const placementBlocks = useMemo(
    () => overrides.filter((o) => o.targetKind === "placement"),
    [overrides],
  );

  const typeOptions = useMemo(() => allowedTypesForSegment(segment), [segment]);

  const applyState = useCallback(
    (state: OneCStoreDistributionState) => {
      onStateChange(state);
    },
    [onStateChange],
  );

  const saveMatrixRow = async (row: OneCMatrixRowDto, actualCount: number) => {
    if (!canEdit || saving) return;
    setSaving(row.categoryId);
    try {
      const res = await postOneCStoreMatrix(storeId1c, {
        category_id: row.categoryId,
        actual_count: actualCount,
        status: row.status,
        comment: row.comment,
      });
      if (!res.success) throw new Error("Ошибка сохранения");
      applyState({
        matrix: res.matrix,
        overrides: res.overrides,
        distributionFill: res.distributionFill,
      });
    } catch (e) {
      toast({
        title: "Не удалось сохранить",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const addPlacement = async () => {
    if (!canEdit || saving) return;
    const capacity = parseInt(capacityInput, 10);
    const actual = parseInt(actualInput, 10);
    if (!Number.isFinite(capacity) || capacity < 0 || !Number.isFinite(actual) || actual < 0) {
      toast({ title: "Проверьте вместимость и факт", variant: "destructive" });
      return;
    }
    setSaving("placement-add");
    try {
      const res = await postOneCStoreOverride(storeId1c, {
        target_kind: "placement",
        client_op_id: newClientOpId(),
        placement_type: placementType,
        placement_segment: segment,
        placement_capacity: capacity,
        placement_actual: actual,
        placement_our_models: [],
        placement_competitors: [],
      });
      if (!res.success) throw new Error("Ошибка сохранения");
      applyState({
        matrix: res.matrix,
        overrides: res.overrides,
        distributionFill: res.distributionFill,
      });
    } catch (e) {
      toast({
        title: "Не удалось добавить блок",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const removePlacement = async (id: string) => {
    if (!canEdit || saving) return;
    setSaving(id);
    try {
      const res = await deleteOneCStoreOverride(storeId1c, id);
      if (!res.success) throw new Error("Ошибка удаления");
      applyState({
        matrix: res.matrix,
        overrides: res.overrides,
        distributionFill: res.distributionFill,
      });
    } catch (e) {
      toast({
        title: "Не удалось удалить",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const fillPct =
    distributionFill.total > 0
      ? Math.round((distributionFill.filled / distributionFill.total) * 100)
      : 0;

  return (
    <div className="space-y-4" data-testid="section-one-c-distribution">
      <OneCDetailSection title="Дистрибуция" testId="section-one-c-distribution-matrix">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Заполнено {distributionFill.filled}/{distributionFill.total} категорий
          </p>
          {!canEdit ? (
            <Badge variant="secondary">Только просмотр</Badge>
          ) : null}
        </div>
        <Progress value={fillPct} className="h-2" />
        <div className="divide-y rounded-md border">
          {matrix.map((row) => (
            <MatrixCategoryRow
              key={row.categoryId}
              row={row}
              canEdit={canEdit}
              saving={saving === row.categoryId}
              onSave={(n) => void saveMatrixRow(row, n)}
            />
          ))}
        </div>
      </OneCDetailSection>

      <Card data-testid="section-one-c-distribution-placements">
        <CardHeader>
          <CardTitle className="text-lg">Размещения на точке</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit ? (
            <div className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <Label>Сегмент</Label>
                <Select value={segment} onValueChange={(v) => setSegment(v as ShowcasePlacementSegment)}>
                  <SelectTrigger>
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
                <Label>Тип</Label>
                <Select value={placementType} onValueChange={(v) => setPlacementType(v as ShowcasePlacementType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {PLACEMENT_TYPE_LABEL_RU[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Вместимость</Label>
                <Input value={capacityInput} onChange={(e) => setCapacityInput(e.target.value)} inputMode="numeric" />
              </div>
              <div className="space-y-1">
                <Label>Наши (факт)</Label>
                <Input value={actualInput} onChange={(e) => setActualInput(e.target.value)} inputMode="numeric" />
              </div>
              <div className="flex items-end">
                <Button type="button" className="w-full gap-2" disabled={!!saving} onClick={() => void addPlacement()}>
                  <Plus className="h-4 w-4" />
                  Добавить
                </Button>
              </div>
            </div>
          ) : null}

          {placementBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Размещения не добавлены</p>
          ) : (
            <div className="space-y-2">
              {placementBlocks.map((block) => {
                const cap = block.placementCapacity ?? 0;
                const act = block.placementActual ?? 0;
                const pct = cap > 0 ? Math.min(100, Math.round((act / cap) * 100)) : 0;
                return (
                  <div key={block.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {block.placementSegment
                            ? PLACEMENT_SEGMENT_LABEL_RU[block.placementSegment as ShowcasePlacementSegment]
                            : "—"}{" "}
                          ·{" "}
                          {block.placementType
                            ? PLACEMENT_TYPE_LABEL_RU[block.placementType as ShowcasePlacementType]
                            : "—"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {act} / {cap} · обновлено {formatDisplayDateTime(block.updatedAt)}
                        </p>
                      </div>
                      {canEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={!!saving}
                          onClick={() => void removePlacement(block.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    <Progress value={pct} className="mt-2 h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <OneCDetailSection title="История изменений" testId="section-one-c-distribution-history">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Изменений пока нет</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{h.action}</span>
                  <span className="text-muted-foreground">{formatDisplayDateTime(h.createdAt)}</span>
                </div>
                <p className="text-muted-foreground">{h.actorFullName ?? "—"}</p>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/1c/store/${storeId1c}/history`}
          className="inline-block text-sm text-primary hover:underline"
        >
          Показать все
        </Link>
      </OneCDetailSection>
    </div>
  );
}

function MatrixCategoryRow({
  row,
  canEdit,
  saving,
  onSave,
}: {
  row: OneCMatrixRowDto;
  canEdit: boolean;
  saving: boolean;
  onSave: (actualCount: number) => void;
}) {
  const [draft, setDraft] = useState(String(row.actualCount));
  const [commentDraft, setCommentDraft] = useState(row.comment ?? "");
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2">
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            {CATEGORY_LABEL[row.categoryId] ?? row.categoryId}
          </Button>
        </CollapsibleTrigger>
        <div className="ml-auto flex items-center gap-2">
          {canEdit ? (
            <Input
              className="h-8 w-20 tabular-nums"
              value={draft}
              inputMode="numeric"
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const n = parseInt(draft, 10);
                if (Number.isFinite(n) && n >= 0 && n !== row.actualCount) onSave(n);
              }}
              data-testid={`input-one-c-matrix-${row.categoryId}`}
            />
          ) : (
            <span className="font-semibold tabular-nums">{row.actualCount}</span>
          )}
        </div>
      </div>
      <CollapsibleContent className="border-t bg-muted/20 px-3 py-2">
        {canEdit ? (
          <Textarea
            value={commentDraft}
            disabled={saving}
            placeholder="Комментарий"
            className="min-h-[60px]"
            onChange={(e) => setCommentDraft(e.target.value)}
            onBlur={() => {
              const n = parseInt(draft, 10);
              if (!Number.isFinite(n) || n < 0) return;
              if (commentDraft !== (row.comment ?? "") || n !== row.actualCount) {
                onSave(n);
              }
            }}
          />
        ) : row.comment ? (
          <p className="text-sm text-muted-foreground">{row.comment}</p>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
