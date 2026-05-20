import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TradePointPhotoBlock } from "@/components/trade-point-photo-block";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import {
  addManualTradePoint,
  canEditDealerTradePoints,
  DEALER_TRADE_POINTS_EVENT,
  getEffectiveDealerTradePoints,
  getManualTradePoints,
  getMergedDealerTradePoints,
  isVirtualDefaultTradePointId,
} from "@/lib/dealer-trade-points-overrides";
import { getShowcaseTasksForDealerDisplay, loadShowcaseStorage } from "@/lib/showcase-distribution-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

type Props = {
  row: DealerRow;
  /** Для навигации по карточке дилера (IntersectionObserver). */
  sectionDomId?: string;
  profile: ReleaseDemoProfile;
};

function isFilled(v: string | undefined): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t !== "—" && t !== "-";
}

function tradePointContact(tp: DealerTradePoint, dealer: DealerRow, mergedActiveCount: number): string {
  const name = tp.contactName?.trim();
  const phone = tp.contactPhone?.trim();
  if (name && phone) return `${name} · ${phone}`;
  if (phone && isFilled(phone)) return phone;
  if (name && isFilled(name)) return name;
  if (mergedActiveCount === 1 && isFilled(dealer.contacts.phone)) return dealer.contacts.phone.trim();
  return "";
}

function openShowcaseTasksCount(dealer: DealerRow, mergedActiveCount: number): number | undefined {
  if (mergedActiveCount !== 1) return undefined;
  const storage = loadShowcaseStorage();
  const tasks = getShowcaseTasksForDealerDisplay(dealer, storage);
  return tasks.filter((t) => t.status !== "done").length;
}

export function DealerTradePointsSection({ row, sectionDomId, profile }: Props) {
  const canEdit = canEditDealerTradePoints(profile, row);
  const [tpBump, setTpBump] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCity, setAddCity] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addContactName, setAddContactName] = useState("");
  const [addContactPhone, setAddContactPhone] = useState("");
  const [addComment, setAddComment] = useState("");
  const [addError, setAddError] = useState("");

  useEffect(() => {
    const fn = () => setTpBump((n) => n + 1);
    window.addEventListener(DEALER_TRADE_POINTS_EVENT, fn);
    return () => window.removeEventListener(DEALER_TRADE_POINTS_EVENT, fn);
  }, []);

  const rawMergedActive = useMemo(() => getMergedDealerTradePoints(row, { includeArchived: false }), [row, tpBump]);
  const mergedActive = useMemo(() => getEffectiveDealerTradePoints(row, { includeArchived: false }), [row, tpBump]);
  const mergedArchived = useMemo(() => getMergedDealerTradePoints(row, { includeArchived: true }), [row, tpBump]);
  const archivedCount = useMemo(() => mergedArchived.filter((m) => m.isArchived).length, [mergedArchived]);
  const archivedList = useMemo(() => mergedArchived.filter((m) => m.isArchived), [mergedArchived]);
  const hasSeeds = row.tradePoints.length > 0;
  const hasManualStored = getManualTradePoints(row.id).length > 0;
  const hasAnyTradePointEver = hasSeeds || hasManualStored;
  const isUsingVirtualDefault = rawMergedActive.length === 0;

  const showcaseOpen = useMemo(() => openShowcaseTasksCount(row, mergedActive.length), [row, mergedActive.length, tpBump]);

  const resetAddForm = useCallback(() => {
    setAddName("");
    setAddCity("");
    setAddAddress("");
    setAddContactName("");
    setAddContactPhone("");
    setAddComment("");
    setAddError("");
  }, []);

  const onAddSave = useCallback(() => {
    setAddError("");
    const id = addManualTradePoint(
      row.id,
      {
        name: addName,
        city: addCity,
        address: addAddress,
        contactName: addContactName,
        contactPhone: addContactPhone,
        comment: addComment,
      },
      profile,
    );
    if (!id) {
      setAddError("Заполните название, город, адрес, контактное лицо и телефон.");
      return;
    }
    setTpBump((n) => n + 1);
    setAddOpen(false);
    resetAddForm();
  }, [addName, addCity, addAddress, addContactName, addContactPhone, addComment, profile, row.id, resetAddForm]);

  const listToShow = showArchived ? archivedList : mergedActive;
  const hasArchived = archivedCount > 0;
  void hasAnyTradePointEver;

  if (mergedActive.length === 0 && !showArchived && !hasAnyTradePointEver) {
    return (
      <section
        id={sectionDomId}
        data-testid="section-dealer-trade-points"
        className="scroll-mt-28 space-y-2 sm:scroll-mt-32"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-foreground sm:text-base">Торговые точки</h3>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 w-full font-semibold sm:w-auto"
              data-testid="button-dealer-trade-point-add"
              onClick={() => {
                resetAddForm();
                setAddOpen(true);
              }}
            >
              Добавить торговую точку
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">Торговые точки не указаны.</p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="dialog-dealer-trade-point-add">
            <DialogHeader>
              <DialogTitle className="text-base">Новая торговая точка</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              {addError ? <p className="text-xs font-medium text-destructive">{addError}</p> : null}
              <div className="space-y-1.5">
                <Label className="text-xs">Название ТТ</Label>
                <Input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Город</Label>
                <Input
                  value={addCity}
                  onChange={(e) => setAddCity(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Адрес</Label>
                <Textarea
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  data-testid="textarea-dealer-trade-point-address"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Контактное лицо</Label>
                <Input
                  value={addContactName}
                  onChange={(e) => setAddContactName(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input
                  value={addContactPhone}
                  onChange={(e) => setAddContactPhone(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-contact-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Комментарий</Label>
                <Textarea
                  value={addComment}
                  onChange={(e) => setAddComment(e.target.value)}
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  data-testid="textarea-dealer-trade-point-comment"
                />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="button" className="min-h-10 w-full font-semibold sm:w-auto" data-testid="button-dealer-trade-point-save" onClick={onAddSave}>
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  if (mergedActive.length === 0 && !showArchived && hasAnyTradePointEver) {
    return (
      <section id={sectionDomId} data-testid="section-dealer-trade-points" className="scroll-mt-28 space-y-2 sm:scroll-mt-32">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-foreground sm:text-base">Торговые точки</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            {hasArchived ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-9 w-full text-xs font-semibold text-muted-foreground sm:w-auto"
                data-testid="button-dealer-trade-points-show-archived"
                onClick={() => setShowArchived(true)}
              >
                Показать архивные
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-9 w-full font-semibold sm:w-auto"
                data-testid="button-dealer-trade-point-add"
                onClick={() => {
                  resetAddForm();
                  setAddOpen(true);
                }}
              >
                Добавить торговую точку
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Активных торговых точек нет.</p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="dialog-dealer-trade-point-add">
            <DialogHeader>
              <DialogTitle className="text-base">Новая торговая точка</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              {addError ? <p className="text-xs font-medium text-destructive">{addError}</p> : null}
              <div className="space-y-1.5">
                <Label className="text-xs">Название ТТ</Label>
                <Input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Город</Label>
                <Input
                  value={addCity}
                  onChange={(e) => setAddCity(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Адрес</Label>
                <Textarea
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  data-testid="textarea-dealer-trade-point-address"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Контактное лицо</Label>
                <Input
                  value={addContactName}
                  onChange={(e) => setAddContactName(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Телефон</Label>
                <Input
                  value={addContactPhone}
                  onChange={(e) => setAddContactPhone(e.target.value)}
                  className="min-h-10"
                  data-testid="input-dealer-trade-point-contact-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Комментарий</Label>
                <Textarea
                  value={addComment}
                  onChange={(e) => setAddComment(e.target.value)}
                  rows={2}
                  className="min-h-[52px] resize-y text-sm"
                  data-testid="textarea-dealer-trade-point-comment"
                />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button type="button" className="min-h-10 w-full font-semibold sm:w-auto" data-testid="button-dealer-trade-point-save" onClick={onAddSave}>
                Сохранить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  const limit = expanded || listToShow.length <= 3 ? listToShow.length : Math.min(3, listToShow.length);
  const slice = listToShow.slice(0, limit);

  return (
    <section id={sectionDomId} data-testid="section-dealer-trade-points" className="scroll-mt-28 space-y-2 sm:scroll-mt-32">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-foreground sm:text-base">Торговые точки</h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {hasArchived ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-9 w-full text-xs font-semibold text-muted-foreground sm:w-auto"
              data-testid="button-dealer-trade-points-show-archived"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? "Скрыть архивные" : "Показать архивные"}
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 w-full font-semibold sm:w-auto"
              data-testid="button-dealer-trade-point-add"
              onClick={() => {
                resetAddForm();
                setAddOpen(true);
              }}
            >
              Добавить торговую точку
            </Button>
          ) : null}
        </div>
      </div>

      {isUsingVirtualDefault ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="text-dealer-trade-points-virtual-default-hint"
        >
          Точки не заведены отдельно — работаем как с одной основной торговой точкой.
        </p>
      ) : null}

      <div className="space-y-2">
        {slice.map(({ point: tp, isManual, isEdited }) => {
          const contact = tradePointContact(tp, row, mergedActive.length);
          const showBadge = isFilled(tp.showcaseStatus);
          const isVirtual = isVirtualDefaultTradePointId(row.id, tp.id);
          const rowTestId = isVirtual ? "row-dealer-trade-point-default" : `row-dealer-trade-point-${tp.id}`;
          const openButtonTestId = isVirtual
            ? "button-dealer-open-default-trade-point"
            : `button-dealer-trade-point-open-${tp.id}`;
          return (
            <Card
              key={tp.id}
              data-testid={rowTestId}
              className="rounded-xl border border-border/70 bg-card shadow-xs"
            >
              <CardContent className="space-y-2 p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold leading-snug text-foreground">{tp.name}</p>
                      {isVirtual ? (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          data-testid="badge-dealer-trade-point-virtual-default"
                        >
                          Основная (по дилеру)
                        </Badge>
                      ) : null}
                      {isManual ? (
                        <Badge variant="outline" className="text-[10px]" data-testid={`badge-dealer-trade-point-manual-${tp.id}`}>
                          Добавлена вручную
                        </Badge>
                      ) : null}
                      {isEdited ? (
                        <Badge variant="outline" className="text-[10px]" data-testid={`badge-dealer-trade-point-edited-${tp.id}`}>
                          Изменена
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{tp.city}</p>
                    <p
                      className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground"
                      data-testid={`text-dealer-trade-point-address-${tp.id}`}
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 break-words">{tp.address}</span>
                    </p>
                    {contact ? (
                      <p className="text-xs text-muted-foreground" data-testid={`text-dealer-trade-point-contact-${tp.id}`}>
                        {contact}
                      </p>
                    ) : null}
                    <TradePointPhotoBlock dealerId={row.id} tradePointId={tp.id} canEdit={canEdit} className="max-w-md" />
                  </div>
                  <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                    {showBadge ? (
                      <Badge
                        variant="outline"
                        className={cn("w-full justify-center text-[10px] font-semibold sm:w-auto")}
                        data-testid={`badge-dealer-trade-point-showcase-status-${tp.id}`}
                      >
                        Витрина: {tp.showcaseStatus}
                      </Badge>
                    ) : null}
                    {showcaseOpen != null && showcaseOpen > 0 ? (
                      <p className="text-center text-[11px] text-muted-foreground sm:text-right">
                        Открытых задач по витрине:{" "}
                        <span className="font-semibold tabular-nums text-foreground">{showcaseOpen}</span>
                      </p>
                    ) : null}
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      className="min-h-10 w-full font-semibold sm:w-auto"
                      data-testid={openButtonTestId}
                    >
                      <Link href={`/dealers/${row.id}/trade-points/${tp.id}`}>
                        {isVirtual ? "Открыть основную точку" : "Открыть точку"}
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {listToShow.length > 3 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {!expanded ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid="button-dealer-trade-points-show-all"
              onClick={() => setExpanded(true)}
            >
              Показать все точки
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid="button-dealer-trade-points-collapse"
              onClick={() => setExpanded(false)}
            >
              Свернуть
            </Button>
          )}
        </div>
      ) : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="dialog-dealer-trade-point-add">
          <DialogHeader>
            <DialogTitle className="text-base">Новая торговая точка</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {addError ? <p className="text-xs font-medium text-destructive">{addError}</p> : null}
            <div className="space-y-1.5">
              <Label className="text-xs">Название ТТ</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="min-h-10"
                data-testid="input-dealer-trade-point-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Город</Label>
              <Input
                value={addCity}
                onChange={(e) => setAddCity(e.target.value)}
                className="min-h-10"
                data-testid="input-dealer-trade-point-city"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Адрес</Label>
              <Textarea
                value={addAddress}
                onChange={(e) => setAddAddress(e.target.value)}
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                data-testid="textarea-dealer-trade-point-address"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Контактное лицо</Label>
              <Input
                value={addContactName}
                onChange={(e) => setAddContactName(e.target.value)}
                className="min-h-10"
                data-testid="input-dealer-trade-point-contact-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Телефон</Label>
              <Input
                value={addContactPhone}
                onChange={(e) => setAddContactPhone(e.target.value)}
                className="min-h-10"
                data-testid="input-dealer-trade-point-contact-phone"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Textarea
                value={addComment}
                onChange={(e) => setAddComment(e.target.value)}
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                data-testid="textarea-dealer-trade-point-comment"
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" className="min-h-10 w-full font-semibold sm:w-auto" data-testid="button-dealer-trade-point-save" onClick={onAddSave}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
