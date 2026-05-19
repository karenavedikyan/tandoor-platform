import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getClientCategoryBadgeClass, getClientCategoryLabel } from "@/lib/client-category";
import { DEALER_BASE_ROWS, getDealerById, type DealerRow } from "@/lib/dealer-base-mock-data";
import {
  DEALER_CLIENT_GROUPS_EVENT,
  findDealerClientGroupByDealerId,
  findDealerClientGroupById,
  formatGroupCodesLine,
  ungroupDealerClientGroup,
  updateDealerClientGroup,
  type DealerClientGroup,
} from "@/lib/dealer-client-groups";
import { buildHashPath, useRouteSearchParams } from "@/lib/hash-route-utils";
import { getDealerProgramSignal } from "@/lib/dealer-program-signals";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

function programTraitsSummary(row: DealerRow): string {
  const s = getDealerProgramSignal(row);
  const parts: string[] = [];
  if (s.hasSpecialConditions) parts.push("спецусловия");
  if (s.hasFranchise) parts.push("франшиза");
  if (s.hasTandoorClub) parts.push("Tandoor Club");
  if (s.hasCashbackAgent) parts.push("кешбек агент");
  return parts.length > 0 ? parts.join(", ") : "—";
}

function statusBadgeClass(status: DealerRow["status"]) {
  if (status === "требует внимания") return "border-amber-300 bg-amber-50 text-amber-950";
  if (status === "потенциальный") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "приостановлен") return "border-neutral-200 bg-muted text-muted-foreground";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
};

export function DealerClientGroupCardSection({ row, profile }: Props) {
  const routeQs = useRouteSearchParams();
  const clientGroupIdQuery = routeQs.get("clientGroupId")?.trim() ?? "";
  const [bump, setBump] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPrimaryId, setEditPrimaryId] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDealerIds, setEditDealerIds] = useState<string[]>([]);

  useEffect(() => {
    const fn = () => setBump((n) => n + 1);
    window.addEventListener(DEALER_CLIENT_GROUPS_EVENT, fn);
    return () => window.removeEventListener(DEALER_CLIENT_GROUPS_EVENT, fn);
  }, []);

  const dealerById = useMemo(() => new Map(DEALER_BASE_ROWS.map((r) => [r.id, r])), []);

  const group = useMemo((): DealerClientGroup | null => {
    const uid = profile.personaUserId;
    const qid = clientGroupIdQuery;
    const fromQ = qid ? findDealerClientGroupById(uid, qid) : undefined;
    const activeFromQ =
      fromQ && !fromQ.archivedAt && fromQ.dealerIds.includes(row.id) ? fromQ : undefined;
    const fromRow = findDealerClientGroupByDealerId(uid, row.id);
    const activeFromRow = fromRow && !fromRow.archivedAt ? fromRow : undefined;
    return activeFromQ ?? activeFromRow ?? null;
  }, [row.id, profile.personaUserId, bump, clientGroupIdQuery]);

  const canEditGroup = profile.role !== "marketer" && profile.role !== "analyst";
  const canArchiveGroup = profile.role === "team_lead" || profile.role === "sales_director";

  const openEdit = useCallback(() => {
    if (!group) return;
    setEditName(group.name);
    setEditPrimaryId(group.primaryDealerId);
    setEditNote(group.note ?? "");
    setEditDealerIds([...group.dealerIds]);
    setEditOpen(true);
  }, [group]);

  const saveEdit = useCallback(() => {
    if (!group) return;
    const name = editName.trim();
    if (!name) {
      toast({ title: "Укажите название", variant: "destructive" });
      return;
    }
    if (editDealerIds.length < 2) {
      toast({ title: "Минимум две карточки", description: "В группе должно остаться не менее двух клиентов.", variant: "destructive" });
      return;
    }
    if (!editDealerIds.includes(editPrimaryId)) {
      toast({ title: "Основная карточка", description: "Выберите основную среди участников группы.", variant: "destructive" });
      return;
    }
    const next = updateDealerClientGroup(profile.personaUserId, group.id, {
      name,
      primaryDealerId: editPrimaryId,
      note: editNote,
      dealerIds: editDealerIds,
    });
    if (!next) {
      toast({ title: "Не удалось сохранить", variant: "destructive" });
      return;
    }
    toast({ title: "Объединение обновлено" });
    setEditOpen(false);
  }, [editDealerIds, editName, editNote, editPrimaryId, group, profile.personaUserId]);

  const removeMember = useCallback((dealerId: string) => {
    setEditDealerIds((prev) => prev.filter((x) => x !== dealerId));
  }, []);

  const runArchive = useCallback(() => {
    if (!group) return;
    ungroupDealerClientGroup(profile.personaUserId, group.id, profile.personaUserId);
    toast({ title: "Группа разъединена", description: "Карточки снова отображаются по отдельности в базе." });
    setEditOpen(false);
  }, [group, profile.personaUserId]);

  if (!group) return null;

  const codesLine = formatGroupCodesLine(group, dealerById);
  const primaryLabel = getDealerById(group.primaryDealerId)?.name ?? group.primaryDealerId;

  return (
    <>
      <section
        data-testid="section-dealer-client-group"
        className="scroll-mt-28 space-y-3 sm:scroll-mt-32 lg:scroll-mt-32"
      >
        <Card className="rounded-2xl border border-border/80 bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Связанные карточки клиента</CardTitle>
            <p className="text-xs text-muted-foreground">
              Логическое объединение без изменения исходных записей в системах учёта.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground">{group.name}</p>
              <Badge variant="outline" className="text-xs font-medium">
                {group.dealerIds.length} карточки
              </Badge>
            </div>
            <p className="text-muted-foreground">
              <span className="text-foreground">Основная карточка:</span> {primaryLabel}
            </p>
            {group.note?.trim() ? (
              <p className="text-muted-foreground">
                <span className="text-foreground">Комментарий:</span> {group.note.trim()}
              </p>
            ) : null}
            <p className="font-mono text-xs text-muted-foreground">{codesLine}</p>

            <div className="space-y-2 border-t border-border pt-3">
              {group.dealerIds.map((id) => {
                const dr = getDealerById(id);
                if (!dr) return null;
                return (
                  <div
                    key={id}
                    className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/10 p-3 sm:flex-row sm:items-start sm:justify-between"
                    data-testid={`row-dealer-client-group-linked-dealer-${id}`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium text-foreground">{dr.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Код: {dr.releaseCode ?? "—"} · {dr.city}
                      </p>
                      <Badge variant="outline" className={cn("w-fit text-[10px]", statusBadgeClass(dr.status))}>
                        {dr.status}
                      </Badge>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Категория:</span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", getClientCategoryBadgeClass(dr.clientCategory))}
                        >
                          {getClientCategoryLabel(dr.clientCategory)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">Признаки: {programTraitsSummary(dr)}</p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="shrink-0 self-start font-semibold">
                      <Link
                        href={buildHashPath(`/dealers/${id}`, { clientGroupId: group.id })}
                        data-testid={`button-dealer-client-group-open-linked-${id}`}
                      >
                        Открыть карточку
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>

            {canEditGroup ? (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid="button-dealer-client-group-edit"
                  onClick={openEdit}
                >
                  Редактировать объединение
                </Button>
                {canArchiveGroup ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    data-testid="button-dealer-client-group-archive"
                    onClick={runArchive}
                  >
                    Разъединить
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-dealer-client-group-edit">
          <DialogHeader>
            <DialogTitle>Редактировать объединение</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="edit-dcg-name">Название</Label>
              <Input
                id="edit-dcg-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="input-dealer-client-group-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Основная карточка</Label>
              <Select value={editPrimaryId} onValueChange={setEditPrimaryId}>
                <SelectTrigger data-testid="select-dealer-client-group-primary">
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  {editDealerIds.map((id) => {
                    const dr = getDealerById(id);
                    return (
                      <SelectItem key={id} value={id}>
                        {dr?.name ?? id} ({dr?.releaseCode ?? id})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dcg-note">Комментарий</Label>
              <Textarea
                id="edit-dcg-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
                data-testid="textarea-dealer-client-group-note"
              />
            </div>
            <div className="space-y-2">
              <Label>Участники</Label>
              <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {editDealerIds.map((id) => {
                  const dr = getDealerById(id);
                  return (
                    <li
                      key={id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      data-testid={`row-dealer-client-group-member-${id}`}
                    >
                      <span className="min-w-0">
                        <span className="font-medium">{dr?.name ?? id}</span>
                        <span className="text-muted-foreground"> · {dr?.releaseCode ?? "—"}</span>
                      </span>
                      {editDealerIds.length > 2 ? (
                        <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 text-xs" onClick={() => removeMember(id)}>
                          Убрать
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Отмена
            </Button>
            <Button type="button" data-testid="button-dealer-client-group-save" onClick={saveEdit}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
