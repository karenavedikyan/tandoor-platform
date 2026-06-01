/**
 * Независимые dropdown РОП и регионального менеджера (Промт 115).
 */

import { useEffect, useState } from "react";
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

export type DealerRopRmSelectorsProps = {
  ropUserId: string | null;
  regionalManagerUserId: string | null;
  onRopChange: (userId: string | null, fullName: string | null) => void;
  onRegionalManagerChange: (userId: string | null, fullName: string | null) => void;
  disabled?: boolean;
  ropTestId?: string;
  rmTestId?: string;
  className?: string;
};

export function DealerRopRmSelectors({
  ropUserId,
  regionalManagerUserId,
  onRopChange,
  onRegionalManagerChange,
  disabled,
  ropTestId = "select-dealer-rop",
  rmTestId = "select-dealer-regional-manager",
  className,
}: DealerRopRmSelectorsProps) {
  const [rops, setRops] = useState<PickerUser[]>([]);
  const [rms, setRms] = useState<PickerUser[]>([]);
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
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
  }, []);

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
