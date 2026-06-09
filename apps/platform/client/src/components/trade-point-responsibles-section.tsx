import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  assignResponsible,
  fetchResolveTradePoint,
  fetchUsersForRole,
  ResponsibilityApiError,
  type PickerUser,
  type ResolvedResponsible,
  type ResolvedResponsibles,
  type ResponsibleRole,
} from "@/lib/responsibility-api";
const UNASSIGN_VALUE = "__unassign__";

const ROLE_ROWS: Array<{ role: ResponsibleRole; label: string }> = [
  { role: "manager", label: "Менеджер" },
  { role: "regional_manager", label: "Региональный менеджер" },
  { role: "rop", label: "Роп" },
];

export type TradePointResponsiblesSectionProps = {
  tradePointId: string;
  currentUserRole?: string | null;
};

function canAssignRole(role: ResponsibleRole, userRole?: string | null): boolean {
  if (userRole === "admin" || userRole === "director") return true;
  if (userRole === "rop") return role === "manager" || role === "regional_manager";
  return false;
}

function displayName(responsible: ResolvedResponsible | undefined): string {
  const name = responsible?.userName?.trim();
  return name || "—";
}

function SourceBadge({ responsible }: { responsible: ResolvedResponsible | undefined }) {
  if (!responsible?.source) return null;
  if (responsible.source === "assignment") {
    return (
      <Badge variant="secondary" className="text-[10px] font-medium">
        Назначен
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">
      По умолчанию
    </Badge>
  );
}

export function TradePointResponsiblesSection({
  tradePointId,
  currentUserRole,
}: TradePointResponsiblesSectionProps) {
  const [resolved, setResolved] = useState<ResolvedResponsibles | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<ResponsibleRole | null>(null);
  const [pickerUsers, setPickerUsers] = useState<PickerUser[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [assigningRole, setAssigningRole] = useState<ResponsibleRole | null>(null);

  const loadResolved = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchResolveTradePoint(tradePointId);
      setResolved(data);
    } catch (e) {
      setResolved(null);
      setLoadError(e instanceof Error ? e.message : "Не удалось загрузить ответственных");
    } finally {
      setLoading(false);
    }
  }, [tradePointId]);

  useEffect(() => {
    void loadResolved();
  }, [loadResolved]);

  useEffect(() => {
    if (!editingRole) {
      setPickerUsers([]);
      return;
    }
    let cancelled = false;
    setPickerLoading(true);
    void fetchUsersForRole(editingRole)
      .then((users) => {
        if (!cancelled) setPickerUsers(users);
      })
      .catch((e) => {
        if (cancelled) return;
        toast({
          title: e instanceof Error ? e.message : "Не удалось загрузить список сотрудников",
          variant: "destructive",
        });
        setEditingRole(null);
      })
      .finally(() => {
        if (!cancelled) setPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editingRole]);

  const handleAssign = useCallback(
    async (role: ResponsibleRole, value: string) => {
      const userId = value === UNASSIGN_VALUE ? null : value;
      setAssigningRole(role);
      try {
        await assignResponsible({
          scopeKind: "trade_point",
          scopeKey: tradePointId,
          role,
          userId,
        });
        toast({ title: "Ответственный обновлён" });
        setEditingRole(null);
        await loadResolved();
      } catch (e) {
        if (e instanceof ResponsibilityApiError && e.code === "FORBIDDEN") {
          toast({ title: "Недостаточно прав для назначения", variant: "destructive" });
        } else {
          toast({
            title: e instanceof Error ? e.message : "Не удалось назначить ответственного",
            variant: "destructive",
          });
        }
      } finally {
        setAssigningRole(null);
      }
    },
    [tradePointId, loadResolved],
  );

  return (
    <Card
      className="rounded-2xl border border-border/80 bg-card shadow-md"
      data-testid="section-trade-point-responsibles"
    >
      <CardHeader className="pb-2 pt-5">
        <CardTitle className="text-base font-semibold tracking-tight">Ответственные</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 pb-5">
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Загрузка…
          </div>
        ) : (
          <>
            {loadError ? (
              <p className="pb-3 text-sm text-muted-foreground">{loadError}</p>
            ) : null}
            {ROLE_ROWS.map(({ role, label }) => {
              const responsible = resolved?.[role];
              const showAssign = canAssignRole(role, currentUserRole);
              const isEditing = editingRole === role;
              const isAssigning = assigningRole === role;

              return (
                <div
                  key={role}
                  data-testid={`responsible-row-${role}`}
                  className="border-b border-border py-3 last:border-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {label}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium leading-snug text-foreground">{displayName(responsible)}</p>
                        <SourceBadge responsible={responsible} />
                      </div>
                    </div>
                    {showAssign ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0"
                        data-testid={`button-assign-${role}`}
                        disabled={isAssigning}
                        onClick={() => setEditingRole(isEditing ? null : role)}
                      >
                        {isEditing ? "Отмена" : "Изменить"}
                      </Button>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <div className="mt-3 max-w-md">
                      {pickerLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          Загрузка списка…
                        </div>
                      ) : (
                        <Select
                          disabled={isAssigning}
                          onValueChange={(value) => {
                            void handleAssign(role, value);
                          }}
                        >
                          <SelectTrigger
                            className="h-9"
                            data-testid={`select-assign-${role}`}
                            aria-label={`Назначить ${label.toLowerCase()}`}
                          >
                            <SelectValue placeholder="Выберите сотрудника" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGN_VALUE}>Снять привязку</SelectItem>
                            {pickerUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.full_name?.trim() || user.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}
