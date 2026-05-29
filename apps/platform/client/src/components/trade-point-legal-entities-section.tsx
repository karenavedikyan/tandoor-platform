import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  fetchLegalEntitiesForClient,
  fetchTradePointLegalEntityLinks,
  upsertTradePointLegalEntityLinks,
  type LegalEntityDto,
} from "@/lib/legal-entities-payment-api";
import { buildHashPath } from "@/lib/hash-route-utils";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Props = {
  dealerId: string;
  tradePointId: string;
  canEdit: boolean;
};

function entityLabel(e: LegalEntityDto): string {
  return e.name?.trim() || e.inn?.trim() || "Юрлицо без названия";
}

export function TradePointLegalEntitiesSection({ dealerId, tradePointId, canEdit }: Props) {
  const [clientEntities, setClientEntities] = useState<LegalEntityDto[]>([]);
  const [linked, setLinked] = useState<LegalEntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [pickerIds, setPickerIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const requisitesHref = buildHashPath(`/dealers/${dealerId}`, { section: "legal_entities" });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [all, links] = await Promise.all([
        fetchLegalEntitiesForClient(dealerId),
        fetchTradePointLegalEntityLinks(tradePointId),
      ]);
      setClientEntities(all);
      setLinked(links);
      setPickerIds(new Set(links.map((e) => e.id)));
    } catch (e) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : "Не удалось загрузить юрлица",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [dealerId, tradePointId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveLinks = async (nextIds: string[]) => {
    setSaving(true);
    try {
      const items = await upsertTradePointLegalEntityLinks(tradePointId, dealerId, nextIds);
      setLinked(items);
      setPickerIds(new Set(items.map((e) => e.id)));
      toast({ title: "Привязки сохранены" });
    } catch (e) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : "Не удалось сохранить",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeLink = (legalEntityId: string) => {
    const next = linked.filter((e) => e.id !== legalEntityId).map((e) => e.id);
    void saveLinks(next);
  };

  const onPopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (open) {
      setPickerIds(new Set(linked.map((e) => e.id)));
    }
  };

  const togglePicker = (id: string, checked: boolean) => {
    setPickerIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const applyPicker = async () => {
    setPopoverOpen(false);
    await saveLinks(Array.from(pickerIds));
  };

  const hasClientEntities = clientEntities.length > 0;

  return (
    <section className="min-w-0 space-y-2" data-testid="section-trade-point-legal-entities">
      <h3 className="text-sm font-semibold text-foreground">Юр.лицо(а)</h3>

      {loading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}

      {!loading && !hasClientEntities ? (
        <p className="text-sm text-muted-foreground">
          У клиента ещё нет юр.лиц. Добавьте их в{" "}
          <Link href={requisitesHref} className="font-medium text-primary underline-offset-4 hover:underline">
            карточке клиента → раздел «Реквизиты»
          </Link>
          .
        </p>
      ) : null}

      {!loading && linked.length > 0 ? (
        <div className="flex flex-wrap gap-2" data-testid="trade-point-legal-entity-chips">
          {linked.map((e) => (
            <span
              key={e.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-sm"
              data-testid={`chip-tp-legal-entity-${e.id}`}
            >
              <Link
                href={requisitesHref}
                className="min-w-0 truncate font-medium text-primary underline-offset-4 hover:underline"
              >
                {entityLabel(e)}
              </Link>
              {canEdit ? (
                <button
                  type="button"
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Отвязать ${entityLabel(e)}`}
                  data-testid={`button-unlink-tp-legal-entity-${e.id}`}
                  disabled={saving}
                  onClick={() => removeLink(e.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      {!loading && hasClientEntities && canEdit ? (
        <Popover open={popoverOpen} onOpenChange={onPopoverOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving}
              data-testid="button-trade-point-link-legal-entity"
            >
              <Plus className="h-4 w-4" />
              Привязать юр.лицо
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Юрлица клиента</p>
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {clientEntities.map((e) => {
                const checked = pickerIds.has(e.id);
                const id = `tp-le-pick-${e.id}`;
                return (
                  <li key={e.id} className="flex items-start gap-2">
                    <Checkbox
                      id={id}
                      checked={checked}
                      disabled={saving}
                      onCheckedChange={(v) => togglePicker(e.id, v === true)}
                    />
                    <Label htmlFor={id} className={cn("cursor-pointer font-normal leading-snug", saving && "opacity-60")}>
                      {entityLabel(e)}
                      {e.inn ? <span className="block text-xs text-muted-foreground">ИНН {e.inn}</span> : null}
                    </Label>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex justify-end border-t border-border pt-2">
              <Button
                type="button"
                size="sm"
                disabled={saving}
                data-testid="button-trade-point-link-legal-entity-done"
                onClick={() => void applyPicker()}
              >
                {saving ? "Сохраняем…" : "Готово"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      {!loading && hasClientEntities && !canEdit && linked.length === 0 ? (
        <p className="text-sm text-muted-foreground">Юрлица не привязаны.</p>
      ) : null}

      {!loading && !hasClientEntities && canEdit ? (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled data-testid="button-trade-point-link-legal-entity-disabled">
          <Plus className="h-4 w-4" />
          Привязать юр.лицо
        </Button>
      ) : null}
    </section>
  );
}
