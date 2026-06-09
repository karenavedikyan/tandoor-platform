import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import type { ShowcaseMatrixModelDefinition } from "@/lib/trade-point-showcase-matrix-models";
import { priorityLabelRu } from "@/lib/trade-point-showcase-matrix-models";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  model: ShowcaseMatrixModelDefinition | null;
};

async function copyText(label: string, text: string, onFallback: (v: string) => void): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(trimmed);
      return;
    }
  } catch {
    /* fallback */
  }
  onFallback(`${label}\n\n${trimmed}`);
}

function Block({ title, children }: { title: string; children: string }) {
  if (!children.trim()) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="break-words whitespace-pre-wrap text-[13px] leading-relaxed text-foreground sm:text-sm">{children}</p>
    </div>
  );
}

export function ShowcaseModelPresentationDialog({ open, onOpenChange, model }: Props) {
  const [fallbackText, setFallbackText] = useState("");

  useEffect(() => {
    if (!open) setFallbackText("");
  }, [open]);

  const handleCopyChars = useCallback(() => {
    if (!model) return;
    void copyText("Характеристики", model.characteristics, setFallbackText);
  }, [model]);

  const handleCopyAdv = useCallback(() => {
    if (!model) return;
    const block = [model.advantages, model.benefitsDealer, model.benefitsBuyer].filter(Boolean).join("\n\n");
    void copyText("Преимущества и выгоды", block, setFallbackText);
  }, [model]);

  const handleCopyMsg = useCallback(() => {
    if (!model) return;
    void copyText("Сообщение клиенту", model.copyMessage, setFallbackText);
  }, [model]);

  if (!model) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-h-[min(90vh,720px)] gap-0 overflow-y-auto p-0 sm:w-full sm:max-w-lg"
        data-testid="dialog-showcase-model-presentation"
      >
        <DialogHeader className="sticky top-0 z-10 border-b border-border bg-card px-4 pb-3 pt-4 sm:px-5">
          <DialogTitle className="text-left text-base leading-snug">Презентация модели</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
            <img
              src={model.imageUrl}
              alt=""
              className="aspect-[4/3] w-full object-cover"
              loading="lazy"
            />
          </div>
          <div>
            <p className="break-words text-base font-semibold leading-snug text-foreground sm:text-lg">{model.name}</p>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              Тип: {model.typeLabelRu} · Приоритет матрицы: {priorityLabelRu(model.basePriority)}
            </p>
          </div>
          <Separator />
          <Block title="Характеристики" children={model.characteristics} />
          <Block title="Преимущества" children={model.advantages} />
          <Block title="Выгоды для дилера" children={model.benefitsDealer} />
          <Block title="Выгоды для конечного покупателя" children={model.benefitsBuyer} />
          <Block title="Типовые возражения" children={model.objections} />
          <Block title="Ответы на возражения" children={model.objectionAnswers} />
          <Block title="Текст для сообщения клиенту" children={model.copyMessage} />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 w-full font-semibold sm:min-h-9 sm:w-auto"
              data-testid="button-showcase-copy-characteristics"
              onClick={handleCopyChars}
            >
              Скопировать характеристики
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 w-full font-semibold sm:min-h-9 sm:w-auto"
              data-testid="button-showcase-copy-benefits"
              onClick={handleCopyAdv}
            >
              Скопировать преимущества
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="min-h-10 w-full font-semibold sm:min-h-9 sm:w-auto"
              data-testid="button-showcase-copy-message"
              onClick={handleCopyMsg}
            >
              Скопировать сообщение клиенту
            </Button>
          </div>
          {fallbackText ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/20">
              <Label className="text-xs text-amber-950 dark:text-amber-50">Скопируйте вручную</Label>
              <Textarea readOnly rows={6} className="resize-y text-xs" value={fallbackText} onFocus={(e) => e.target.select()} />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
