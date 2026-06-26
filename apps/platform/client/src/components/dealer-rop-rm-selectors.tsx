/**
 * Независимые dropdown РОП и регионального менеджера (Промт 115).
 */

import { useEffect, useState, type ReactElement } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listRegionalManagerPickerUsers,
  listRopPickerUsers,
  pickerUserById,
  type PickerUser,
} from "@/lib/users-picker-api";

const NONE = "__none__";
const NOT_ASSIGNED_LABEL = "— не назначено —";

export type DealerRopRmSelectorsProps = {
  ropUserId: string | null;
  regionalManagerUserId: string | null;
  onRopChange: (userId: string | null, fullName: string | null) => void;
  onRegionalManagerChange: (userId: string | null, fullName: string | null) => void;
  disabled?: boolean;
  readOnly?: boolean;
  ropDisplayName?: string | null;
  regionalManagerDisplayName?: string | null;
  ropTestId?: string;
  rmTestId?: string;
  className?: string;
};

function readOnlyValueLabel(displayName: string | null | undefined): string {
  return displayName?.trim() ? displayName.trim() : NOT_ASSIGNED_LABEL;
}

function ReadOnlyResponsibleField({
  label,
  displayName,
  testId,
}: {
  label: string;
  displayName: string | null | undefined;
  testId: string;
}): ReactElement {
  const value = readOnlyValueLabel(displayName);
  const isEmpty = !displayName?.trim();
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div
        className={cn(
          "min-h-10 rounded-md border bg-muted/40 px-3 py-2 text-sm",
          isEmpty && "text-muted-foreground",
        )}
        data-testid={testId}
      >
        {value}
      </div>
    </div>
  );
}

export function DealerRopRmSelectors({
  ropUserId,
  regionalManagerUserId,
  onRopChange,
  onRegionalManagerChange,
  disabled,
  readOnly = false,
  ropDisplayName,
  regionalManagerDisplayName,
  ropTestId = "select-dealer-rop",
  rmTestId = "select-dealer-regional-manager",
  className,
}: DealerRopRmSelectorsProps): ReactElement {
  const [rops, setRops] = useState<PickerUser[]>([]);
  const [rms, setRms] = useState<PickerUser[]>([]);
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    void Promise.all([listRopPickerUsers(), listRegionalManagerPickerUsers()])
      .then(([ropList, rmList]) => {
        if (cancelled) return;
        setRops(ropList);
        setRms(rmList);
      })
      .catch(() => {
        if (!cancelled) setLoadErr("Не удалось загрузить списки сотрудников.");
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly]);

  if (readOnly) {
    return (
      <div className={className ?? "space-y-3"}>
        <ReadOnlyResponsibleField
          label="РОП"
          displayName={ropDisplayName}
          testId={`${ropTestId}-readonly`}
        />
        <ReadOnlyResponsibleField
          label="Региональный менеджер"
          displayName={regionalManagerDisplayName}
          testId={`${rmTestId}-readonly`}
        />
      </div>
    );
  }

  const ropValue = ropUserId?.trim() ? ropUserId : NONE;
  const rmValue = regionalManagerUserId?.trim() ? regionalManagerUserId : NONE;

  return (
    <div className={className ?? "space-y-3"}>
      {loadErr ? <p className="text-xs text-destructive">{loadErr}</p> : null}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">РОП</Label>
        <Select
          value={ropValue}
          disabled={disabled}
          onValueChange={(v) => {
            if (v === NONE) {
              onRopChange(null, null);
              return;
            }
            const u = pickerUserById(rops, v);
            onRopChange(v, u?.full_name ?? null);
          }}
        >
          <SelectTrigger className="min-h-10 w-full" data-testid={ropTestId}>
            <SelectValue placeholder="— не выбрано —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— не выбрано —</SelectItem>
            {rops.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Региональный менеджер</Label>
        <Select
          value={rmValue}
          disabled={disabled}
          onValueChange={(v) => {
            if (v === NONE) {
              onRegionalManagerChange(null, null);
              return;
            }
            const u = pickerUserById(rms, v);
            onRegionalManagerChange(v, u?.full_name ?? null);
          }}
        >
          <SelectTrigger className="min-h-10 w-full" data-testid={rmTestId}>
            <SelectValue placeholder="— не выбрано —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— не выбрано —</SelectItem>
            {rms.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
