/**
 * Карточка ручного клиента в режиме актуализации: анкета без демо-блоков.
 */

import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getClientCategoryLabel } from "@/lib/client-category";
import {
  mergeLegalEntitiesForActualization,
  mergeTradePointsActiveForActualization,
  mergeDealerRowWithActualization,
} from "@/lib/client-base-actualization-data-merge";
import {
  mergeActualizationState,
  type ActualizationState,
  type DealerActualizationContact,
} from "@/lib/client-base-actualization-state";
import { computePortalSummary } from "@/lib/client-base-actualization-portal-math";
import {
  getPrimaryActualizationContact,
  listActiveActualizationContactsForDealer,
  newActualizationContactId,
} from "@/lib/client-base-actualization-contacts-helpers";
import {
  canArchiveDealerDuringActualization,
  canEditDealerDuringActualization,
} from "@/lib/client-base-actualization-permissions";
import { DealerActualizationEditDialog } from "@/components/client-base-actualization-dealer-forms";
import { ClientBaseActualizationSyncStatus } from "@/components/client-base-actualization-sync-status";
import { DealerClientNextStepSection } from "@/components/dealer-client-next-step-section";
import { useCurrentUser } from "@/hooks/use-current-user";
import { userLabelFromProfile } from "@/lib/showcase-distribution-data";
import { toast } from "@/hooks/use-toast";
import { useSectionSaveFeedback } from "@/hooks/use-section-save-feedback";
import { SectionSaveButton } from "@/components/section-save-button";
import { Bitrix24TasksPanel } from "@/components/bitrix24-tasks-panel";
import { DealerTradePointsSection } from "@/components/dealer-trade-points-section";
import { canEditClientNextStep } from "@/lib/client-next-step-data";

const PASSPORT_KIND_LABELS: Record<string, string> = {
  ip: "ИП",
  ooo: "ООО",
  person: "Физлицо",
  network: "Сеть",
  other: "Другое",
};

const LIFECYCLE_LABELS: Record<string, string> = {
  new: "Новый",
  active: "Активный",
  needs_review: "Требует проверки",
  inactive: "Неактивный",
  archived: "Архив",
};

const TIER_LABELS: Record<string, string> = {
  top150: "ТОП-150",
  top350: "ТОП-350",
  top500: "ТОП-500",
  other: "Прочие",
  none: "Без категории",
};

function str(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

function mergedManualFields(manual: { fields: Record<string, unknown> } | undefined, ov: Record<string, unknown> | undefined): Record<string, unknown> {
  return { ...(manual?.fields ?? {}), ...(ov ?? {}) };
}

export function DealerManualActualizationPage(props: { baseRow: DealerRow; profile: ReleaseDemoProfile }): ReactElement {
  const { baseRow, profile } = props;
  const actx = useClientBaseActualization();
  const { user } = useCurrentUser();
  const [, setLocation] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const manual = actx.state.manuallyCreatedDealersById[baseRow.id];
  const ovFields = (actx.state.dealerOverridesById[baseRow.id]?.fields ?? {}) as Record<string, unknown>;
  const f = useMemo(() => mergedManualFields(manual, ovFields), [manual, ovFields]);

  const row = useMemo(() => mergeDealerRowWithActualization(baseRow, actx.state), [baseRow, actx.state]);

  const audit = actx.state.dealerActualizationAuditByDealerId[baseRow.id];
  const contacts = useMemo(() => listActiveActualizationContactsForDealer(actx.state, baseRow.id), [actx.state, baseRow.id]);
  const primary = useMemo(() => getPrimaryActualizationContact(actx.state, baseRow.id), [actx.state, baseRow.id]);

  const seedRef = useRef(false);
  useEffect(() => {
    if (!actx.enabled || seedRef.current) return;
    if (contacts.length > 0) return;
    if (!manual) return;
    const mf = manual.fields as Record<string, unknown>;
    const cn = str(mf.contactPerson);
    const ph = str(mf.phone);
    const em = str(mf.email);
    if (!cn && !ph && !em) return;
    seedRef.current = true;
    const iso = new Date().toISOString();
    const cid = newActualizationContactId(baseRow.id);
    void actx.persist((prev) => {
      const c: DealerActualizationContact = {
        id: cid,
        dealerId: baseRow.id,
        fullName: cn || "Контакт",
        role: "lpr",
        phone: ph,
        email: em,
        messenger: "",
        comment: "",
        isPrimary: true,
        createdAt: iso,
        updatedAt: iso,
        updatedBy: profile.personaUserId,
        updatedByName: userLabelFromProfile(profile),
      };
      return mergeActualizationState(prev, {
        dealerActualizationContactsById: { ...prev.dealerActualizationContactsById, [cid]: c },
      });
    });
  }, [actx, baseRow.id, contacts.length, manual, profile]);

  const canEdit = canEditDealerDuringActualization(profile, row);
  const canArchive = canArchiveDealerDuringActualization(profile, row);

  const softArchive = useCallback(async () => {
    if (!canArchive) return;
    setBusy(true);
    const r = await actx.persist((prev) =>
      mergeActualizationState(prev, {
        archivedDealersById: {
          ...prev.archivedDealersById,
          [baseRow.id]: {
            dealerId: baseRow.id,
            archivedAt: new Date().toISOString(),
            archivedBy: profile.personaUserId,
            archivedByName: userLabelFromProfile(profile),
            source: "manual_actualization",
          },
        },
      }),
    );
    setBusy(false);
    if (r.success) {
      toast({ title: "Клиент удалён из рабочей базы" });
      setDeleteOpen(false);
      setLocation("/dealer-base");
    } else {
      toast({ title: "Не удалось сохранить", variant: "destructive" });
    }
  }, [actx, baseRow.id, canArchive, profile, setLocation]);

  const tps = useMemo(() => mergeTradePointsActiveForActualization(row, actx.state), [row, actx.state]);
  const legal = useMemo(() => mergeLegalEntitiesForActualization(row, actx.state), [row, actx.state]);

  let filledShowcase = 0;
  let needShowcase = 0;
  for (const e of tps) {
    const sh = actx.state.tradePointShowcaseActualizationById[e.point.id];
    const s = computePortalSummary(sh);
    if (sh?.hasShowcase === false) continue;
    if (s.totalPortals != null && s.totalPortals > 0 && (s.tandoorTotal ?? 0) > 0) filledShowcase += 1;
    else if (s.needsPrimaryInstall) needShowcase += 1;
  }

  const passportKind = str(f.passportClientKind);
  const lifecycle = str(f.passportLifecycleStatus);
  const tier = str(f.passportCategoryTier);

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-6" data-testid="page-dealer-manual-actualization">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
          <Link href="/dealer-base">Назад к клиентской базе</Link>
        </Button>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full font-semibold sm:w-auto"
            data-testid="button-dealer-edit"
            onClick={() => setEditOpen(true)}
          >
            Редактировать
          </Button>
        ) : null}
        {canArchive ? (
          <Button
            type="button"
            variant="destructive"
            className="min-h-11 w-full font-semibold sm:w-auto"
            data-testid={`button-dealer-delete-${baseRow.id}`}
            onClick={() => setDeleteOpen(true)}
          >
            Удалить клиента
          </Button>
        ) : null}
      </div>

      <ClientBaseActualizationSyncStatus
        isLoading={actx.loading}
        meta={actx.meta}
        syncStatus={actx.syncStatus}
        onRetry={() => void actx.refresh()}
      />

      <Card className="rounded-2xl border border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{row.name}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Код клиента:{" "}
            <span className="font-mono font-medium text-foreground" data-testid="text-dealer-internal-code">
              {row.releaseCode ?? "—"}
            </span>
          </p>
        </CardHeader>
        <CardContent className="space-y-2 border-t border-border/60 pt-3 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Основной контакт:</span>{" "}
            <span data-testid="text-dealer-primary-contact">{primary?.fullName ?? "—"}</span>
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Телефон:</span>{" "}
            <span data-testid="text-dealer-primary-phone">{primary?.phone?.trim() || "—"}</span>
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Email:</span>{" "}
            <span data-testid="text-dealer-primary-email">{primary?.email?.trim() || "—"}</span>
          </p>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={["passport", "responsibles", "logistics", "contacts", "legal", "tps", "next"]} className="rounded-2xl border border-border/80 bg-card px-3 sm:px-4">
        <AccordionItem value="passport" data-testid="section-dealer-passport">
          <AccordionTrigger className="text-left text-sm font-semibold">Паспорт клиента</AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Код клиента" value={row.releaseCode ?? "—"} />
              <Field label="Название" value={row.name} />
              <Field label="Тип клиента" value={passportKind ? (PASSPORT_KIND_LABELS[passportKind] ?? passportKind) : "—"} />
              <Field label="ИНН" value={row.actualizationInn?.trim() || str(f.inn) || "—"} />
              <Field label="Статус" value={lifecycle ? (LIFECYCLE_LABELS[lifecycle] ?? lifecycle) : row.status} />
              <Field label="Категория" value={tier ? (TIER_LABELS[tier] ?? tier) : getClientCategoryLabel(row.clientCategory)} />
              <div className="sm:col-span-2">
                <Field label="Общий комментарий" value={row.comment?.trim() || str(f.comment) || "—"} />
              </div>
            </div>
            {canEdit ? (
              <Button type="button" size="sm" className="mt-2 font-semibold" onClick={() => setEditOpen(true)}>
                Редактировать
              </Button>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="responsibles" data-testid="section-dealer-responsibles">
          <AccordionTrigger className="text-left text-sm font-semibold">Ответственные</AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm">
            <Field label="Менеджер" value={row.manager || "—"} />
            <Field label="Региональный менеджер" value={row.regionalManager?.trim() || "—"} />
            <Field label="РОП" value={row.ropName?.trim() || "—"} />
            <Field label="Территория / зона" value={str(f.territoryZone) || "—"} />
            <Field label="Кто актуализировал" value={audit?.lastUpdatedByName ?? manual?.createdByName ?? "—"} />
            <Field label="Дата последней актуализации" value={audit?.lastUpdatedAt ?? manual?.createdAt ?? "—"} />
            {canEdit ? (
              <Button type="button" size="sm" className="mt-2 font-semibold" onClick={() => setEditOpen(true)}>
                Редактировать
              </Button>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="logistics" data-testid="section-dealer-logistics">
          <AccordionTrigger className="text-left text-sm font-semibold">Адрес и логистика</AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm">
            <Field label="Город" value={row.city || "—"} />
            <Field label="Адрес" value={row.releaseAddress?.trim() || "—"} />
            <Field label="День отгрузки" value={str(f.shipmentDayLabel) || "—"} />
            <Field label="Маршрут / направление" value={str(f.routeLabel) || "—"} />
            <Field label="Порядок выгрузки" value={row.distribution > 0 ? String(row.distribution) : "—"} />
            <Field label="Комментарий по логистике" value={str(f.logisticsComment) || "—"} />
            {canEdit ? (
              <Button type="button" size="sm" className="mt-2 font-semibold" onClick={() => setEditOpen(true)}>
                Редактировать
              </Button>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="contacts" data-testid="section-dealer-contacts">
          <AccordionTrigger className="text-left text-sm font-semibold">Контакты клиента</AccordionTrigger>
          <AccordionContent>
            <DealerContactsActualizationBlock dealerId={baseRow.id} profile={profile} canEdit={canEdit} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="legal" data-testid="section-dealer-legal-entities">
          <AccordionTrigger className="text-left text-sm font-semibold">Юридические лица</AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm">
            {legal.filter((e) => e.status !== "archived").length === 0 ? (
              <p className="text-muted-foreground">Не заполнено</p>
            ) : (
              legal
                .filter((e) => e.status !== "archived")
                .map((e) => (
                  <div key={e.id} className="rounded-lg border border-border/70 p-3">
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-muted-foreground">ИНН {e.inn ?? "—"} · КПП {e.kpp ?? "—"} · ОГРН {e.ogrn ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">Юр. адрес: {e.legalAddress ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">Факт. адрес: {e.actualAddress ?? "—"}</p>
                  </div>
                ))
            )}
            {canEdit ? (
              <Button type="button" size="sm" variant="outline" className="mt-2 font-semibold" onClick={() => setEditOpen(true)}>
                Редактировать через форму клиента
              </Button>
            ) : null}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tps" data-testid="section-dealer-trade-points">
          <AccordionTrigger className="text-left text-sm font-semibold">Торговые точки</AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Всего точек: <span className="font-semibold text-foreground">{tps.length}</span>
              {" · "}
              С заполненной витриной: <span className="font-semibold text-foreground">{filledShowcase}</span>
              {" · "}
              Требуют заполнения витрины: <span className="font-semibold text-foreground">{needShowcase}</span>
            </p>
            {tps.length === 0 ? <p className="text-muted-foreground">Торговые точки не добавлены</p> : null}
            <DealerTradePointsSection row={row} profile={profile} sectionDomId="dealer-section-points" />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="next" data-testid="section-dealer-next-step">
          <AccordionTrigger className="text-left text-sm font-semibold">Следующий шаг и задачи</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <DealerClientNextStepSection
              row={row}
              profile={profile}
              actorUserId={user?.id ?? profile.personaUserId}
              actorLabel={user?.name ?? userLabelFromProfile(profile)}
              onSaved={() => void actx.refresh()}
              allowManualActualizationCard
            />
            <div data-testid="section-dealer-bitrix-tasks">
              <Bitrix24TasksPanel
                scope="dealer"
                dealerId={row.id}
                dealerName={row.name}
                canCreate={canEditClientNextStep(profile, row)}
                actorUserId={user?.id ?? profile.personaUserId}
                actorLabel={user?.name ?? userLabelFromProfile(profile)}
                compact
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <DealerActualizationEditDialog open={editOpen} onOpenChange={setEditOpen} baseRow={baseRow} profile={profile} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent data-testid="dialog-dealer-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>Клиент будет скрыт из рабочей клиентской базы и не будет отображаться в списке по умолчанию.</p>
              <p>Данные не удаляются физически: анкета актуализации, контакты и торговые точки остаются в сохранённом состоянии.</p>
              <p>Восстановить клиента можно через «Показать архив» в списке или по прямой ссылке на карточку.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" data-testid="button-dealer-delete-cancel" disabled={busy} onClick={() => setDeleteOpen(false)}>
              Отмена
            </Button>
            <Button type="button" variant="destructive" data-testid="button-dealer-delete-confirm" disabled={busy} onClick={() => void softArchive()}>
              {busy ? "Сохранение…" : "Удалить клиента"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-foreground">{value}</p>
    </div>
  );
}

function DealerContactsActualizationBlock(props: {
  dealerId: string;
  profile: ReleaseDemoProfile;
  canEdit: boolean;
}): ReactElement {
  const { dealerId, profile, canEdit } = props;
  const actx = useClientBaseActualization();
  const [tick, setTick] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DealerActualizationContact | null>(null);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("lpr");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [messenger, setMessenger] = useState("");
  const [comment, setComment] = useState("");
  const contactDialogSave = useSectionSaveFeedback();

  const contacts = useMemo(() => {
    void tick;
    return listActiveActualizationContactsForDealer(actx.state, dealerId);
  }, [actx.state, dealerId, tick]);

  const openCreate = () => {
    setEditing(null);
    setFullName("");
    setRole("lpr");
    setPhone("");
    setEmail("");
    setMessenger("");
    setComment("");
    contactDialogSave.markDirty();
    setDialogOpen(true);
  };

  const openEdit = (c: DealerActualizationContact) => {
    setEditing(c);
    setFullName(c.fullName);
    setRole(c.role || "lpr");
    setPhone(c.phone);
    setEmail(c.email);
    setMessenger(c.messenger);
    setComment(c.comment);
    contactDialogSave.markDirty();
    setDialogOpen(true);
  };

  const persistContacts = async (updater: (prev: ActualizationState) => ActualizationState): Promise<boolean> => {
    const r = await actx.persist(updater);
    if (r.success) {
      setTick((n) => n + 1);
      return true;
    }
    toast({ title: "Не удалось сохранить", variant: "destructive" });
    return false;
  };

  const onSave = async () => {
    if (!fullName.trim()) {
      toast({ title: "Укажите ФИО контакта", variant: "destructive" });
      return false;
    }
    const iso = new Date().toISOString();
    const uid = profile.personaUserId;
    const uname = userLabelFromProfile(profile);
    const id = editing?.id ?? newActualizationContactId(dealerId);
    const wasPrimary = editing?.isPrimary ?? false;
    const makePrimary = !editing || contacts.length === 0 ? true : wasPrimary;

    return persistContacts((prev) => {
      let nextContacts = { ...prev.dealerActualizationContactsById };
      const list = listActiveActualizationContactsForDealer(prev, dealerId);
      const nextRec: DealerActualizationContact = {
        id,
        dealerId,
        fullName: fullName.trim(),
        role,
        phone: phone.trim(),
        email: email.trim(),
        messenger: messenger.trim(),
        comment: comment.trim(),
        isPrimary: makePrimary,
        createdAt: editing?.createdAt ?? iso,
        updatedAt: iso,
        updatedBy: uid,
        updatedByName: uname,
      };
      if (makePrimary) {
        for (const c of list) {
          if (c.id === id) continue;
          const cur = nextContacts[c.id];
          if (cur) nextContacts[c.id] = { ...cur, isPrimary: false, updatedAt: iso, updatedBy: uid, updatedByName: uname };
        }
      }
      nextContacts = { ...nextContacts, [id]: nextRec };
      return mergeActualizationState(prev, { dealerActualizationContactsById: nextContacts });
    });
  };

  const onSetPrimary = async (c: DealerActualizationContact) => {
    const ok = await persistContacts((prev) => {
      let next = { ...prev.dealerActualizationContactsById };
      const list = listActiveActualizationContactsForDealer(prev, dealerId);
      const iso = new Date().toISOString();
      for (const x of list) {
        const cur = next[x.id];
        if (!cur) continue;
        next[x.id] = { ...cur, isPrimary: x.id === c.id, updatedAt: iso, updatedBy: profile.personaUserId, updatedByName: userLabelFromProfile(profile) };
      }
      return mergeActualizationState(prev, { dealerActualizationContactsById: next });
    });
    if (ok) toast({ title: "Сохранено" });
  };

  const onArchive = async (c: DealerActualizationContact) => {
    const ok = await persistContacts((prev) => {
      const info = {
        contactId: c.id,
        dealerId,
        archivedAt: new Date().toISOString(),
        archivedBy: profile.personaUserId,
        archivedByName: userLabelFromProfile(profile),
      };
      const nextContacts = { ...prev.dealerActualizationContactsById };
      delete nextContacts[c.id];
      const iso = new Date().toISOString();
      const listAfter = listActiveActualizationContactsForDealer({ ...prev, dealerActualizationContactsById: nextContacts }, dealerId);
      if (c.isPrimary && listAfter[0]) {
        const p0 = nextContacts[listAfter[0].id];
        if (p0) nextContacts[listAfter[0].id] = { ...p0, isPrimary: true, updatedAt: iso, updatedBy: profile.personaUserId, updatedByName: userLabelFromProfile(profile) };
      }
      return mergeActualizationState(prev, {
        dealerActualizationContactsById: nextContacts,
        archivedDealerContactsById: { ...prev.archivedDealerContactsById, [c.id]: info },
      });
    });
    if (ok) toast({ title: "Сохранено" });
  };

  return (
    <div className="space-y-3">
      {contacts.length === 0 ? (
        <p className="text-muted-foreground">Контакты не указаны</p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="rounded-lg border border-border/70 p-3" data-testid={`card-dealer-contact-${c.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {c.fullName}
                    {c.isPrimary ? (
                      <Badge className="ml-2" variant="secondary">
                        Основной
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">Роль: {c.role}</p>
                  <p className="text-xs">{c.phone || "—"} · {c.email || "—"}</p>
                  {c.messenger ? <p className="text-xs">Мессенджер: {c.messenger}</p> : null}
                  {c.comment ? <p className="text-xs text-muted-foreground">{c.comment}</p> : null}
                </div>
                {canEdit ? (
                  <div className="flex flex-col gap-1">
                    <Button type="button" size="sm" variant="outline" data-testid={`button-dealer-contact-edit-${c.id}`} onClick={() => openEdit(c)}>
                      Изменить
                    </Button>
                    {!c.isPrimary ? (
                      <Button type="button" size="sm" variant="secondary" data-testid={`button-dealer-contact-set-primary-${c.id}`} onClick={() => void onSetPrimary(c)}>
                        Сделать основным
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="ghost" className="text-destructive" data-testid={`button-dealer-contact-delete-${c.id}`} onClick={() => void onArchive(c)}>
                      Удалить
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <Button type="button" size="sm" className="font-semibold" data-testid="button-dealer-contact-create" onClick={openCreate}>
          Добавить контакт
        </Button>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Контакт" : "Новый контакт"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <div className="space-y-1">
              <Label className="text-xs">ФИО</Label>
              <Input
                className="min-h-10"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  contactDialogSave.markDirty();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Роль</Label>
              <Select
                value={role}
                onValueChange={(v) => {
                  setRole(v);
                  contactDialogSave.markDirty();
                }}
              >
                <SelectTrigger className="min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Собственник</SelectItem>
                  <SelectItem value="lpr">ЛПР</SelectItem>
                  <SelectItem value="buyer">Закупщик</SelectItem>
                  <SelectItem value="accountant">Бухгалтер</SelectItem>
                  <SelectItem value="logistics">Логист</SelectItem>
                  <SelectItem value="seller">Продавец</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Телефон</Label>
              <Input
                className="min-h-10"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  contactDialogSave.markDirty();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                className="min-h-10"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  contactDialogSave.markDirty();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Мессенджер</Label>
              <Input
                className="min-h-10"
                value={messenger}
                onChange={(e) => {
                  setMessenger(e.target.value);
                  contactDialogSave.markDirty();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Комментарий</Label>
              <Textarea
                rows={2}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  contactDialogSave.markDirty();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <SectionSaveButton
              testId="button-dealer-section-save-contacts"
              statusTestId="text-save-status-contacts-dialog"
              phase={contactDialogSave.phase}
              disabled={contactDialogSave.phase === "saving"}
              onSave={() =>
                void contactDialogSave.runSave(async () => {
                  const ok = await onSave();
                  if (ok) setDialogOpen(false);
                  return ok;
                })
              }
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
