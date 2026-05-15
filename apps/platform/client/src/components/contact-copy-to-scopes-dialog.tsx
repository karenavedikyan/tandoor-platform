import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  type ClientContact,
  type ContactCopyDestinations,
  type ContactCopySource,
  copyContactToScopes,
} from "@/lib/client-contacts";
import { getMergedDealerLegalEntities } from "@/lib/dealer-legal-entities";
import { getMergedDealerTradePoints } from "@/lib/dealer-trade-points-overrides";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: DealerRow;
  profile: ReleaseDemoProfile;
  source: ContactCopySource;
  sourceContact: ClientContact;
  onCopied?: () => void;
};

export function ContactCopyToScopesDialog({ open, onOpenChange, row, profile, source, sourceContact, onCopied }: Props) {
  const [toDealer, setToDealer] = useState(false);
  const [toAllLe, setToAllLe] = useState(false);
  const [toAllTp, setToAllTp] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualLe, setManualLe] = useState<Record<string, boolean>>({});
  const [manualTp, setManualTp] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState("");

  const legalEntities = useMemo(
    () => getMergedDealerLegalEntities(row).filter((e) => e.status !== "archived"),
    [row],
  );
  const tradePoints = useMemo(() => getMergedDealerTradePoints(row, { includeArchived: false }).map((m) => m.point), [row]);

  useEffect(() => {
    if (!open) return;
    setToDealer(false);
    setToAllLe(false);
    setToAllTp(false);
    setManualMode(false);
    setManualLe({});
    setManualTp({});
    setErr("");
  }, [open, source.contactId]);

  const onSave = useCallback(() => {
    setErr("");
    const destinations: ContactCopyDestinations = {
      toDealer: toDealer,
      toAllLegalEntities: toAllLe && !manualMode,
      toAllTradePoints: toAllTp && !manualMode,
      manualLegalEntityIds: manualMode ? Object.keys(manualLe).filter((id) => manualLe[id]) : [],
      manualTradePointIds: manualMode ? Object.keys(manualTp).filter((id) => manualTp[id]) : [],
    };
    const res = copyContactToScopes(row.id, source, destinations, profile, row);
    if (!res.ok) {
      setErr(res.error ?? "Не удалось скопировать.");
      return;
    }
    onCopied?.();
    onOpenChange(false);
  }, [toDealer, toAllLe, toAllTp, manualMode, manualLe, manualTp, row, profile, source, onOpenChange, onCopied]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="dialog-contact-copy-to-scopes">
        <DialogHeader>
          <DialogTitle className="text-base">Скопировать контакт</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{sourceContact.fullName}</span>
            {sourceContact.role ? ` · ${sourceContact.role}` : ""}
          </p>
          {err ? <p className="text-xs font-medium text-destructive">{err}</p> : null}
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
            {source.type !== "dealer" ? (
              <label className="flex cursor-pointer items-start gap-2">
                <Checkbox checked={toDealer} onCheckedChange={(v) => setToDealer(v === true)} data-testid="checkbox-contact-copy-to-dealer" />
                <span>На карточку дилера</span>
              </label>
            ) : null}
            <label className="flex cursor-pointer items-start gap-2">
              <Checkbox
                checked={toAllLe}
                disabled={manualMode}
                onCheckedChange={(v) => setToAllLe(v === true)}
                data-testid="checkbox-contact-copy-to-all-legal-entities"
              />
              <span>На все юрлица этого дилера</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <Checkbox
                checked={toAllTp}
                disabled={manualMode}
                onCheckedChange={(v) => setToAllTp(v === true)}
                data-testid="checkbox-contact-copy-to-all-trade-points"
              />
              <span>На все торговые точки этого дилера</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <Checkbox checked={manualMode} onCheckedChange={(v) => setManualMode(v === true)} data-testid="checkbox-contact-copy-select-manual" />
              <span>Выбрать вручную</span>
            </label>
          </div>
          {manualMode ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Юрлица</p>
                <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {legalEntities.map((le) => (
                    <label key={le.id} className="flex cursor-pointer items-start gap-2 text-xs">
                      <Checkbox
                        checked={Boolean(manualLe[le.id])}
                        onCheckedChange={(v) => setManualLe((prev) => ({ ...prev, [le.id]: v === true }))}
                        data-testid={`checkbox-contact-copy-legal-entity-${le.id}`}
                      />
                      <span className="leading-snug">{le.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Торговые точки</p>
                <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {tradePoints.map((tp) => (
                    <label key={tp.id} className="flex cursor-pointer items-start gap-2 text-xs">
                      <Checkbox
                        checked={Boolean(manualTp[tp.id])}
                        onCheckedChange={(v) => setManualTp((prev) => ({ ...prev, [tp.id]: v === true }))}
                        data-testid={`checkbox-contact-copy-trade-point-${tp.id}`}
                      />
                      <span className="leading-snug">{tp.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" className="min-h-10 w-full font-semibold sm:w-auto" data-testid="button-contact-copy-save" onClick={onSave}>
            Скопировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
