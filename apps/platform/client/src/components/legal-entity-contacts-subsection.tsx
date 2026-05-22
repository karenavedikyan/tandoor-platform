import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ContactCopyToScopesDialog } from "@/components/contact-copy-to-scopes-dialog";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  addLegalEntityContact,
  CLIENT_CONTACTS_EVENT,
  getLegalEntityContacts,
  isClientContactActive,
  requestDeleteLegalEntityContact,
  setPrimaryLegalEntityContact,
  updateLegalEntityContact,
  type ClientContact,
} from "@/lib/client-contacts";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import {
  formatRussianPhoneInput,
  isValidRussianPhone,
  RU_PHONE_INVALID_MESSAGE,
  RU_PHONE_PLACEHOLDER,
} from "@/lib/phone-format";

function isFilled(v: string | undefined): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t !== "—" && t !== "-";
}

function formatMessengers(c: ClientContact): string {
  const bits = [c.whatsapp, c.telegram, c.email].filter((x) => isFilled(x)) as string[];
  return bits.join(" · ");
}

type Props = {
  row: DealerRow;
  legalEntityId: string;
  legalEntityName: string;
  profile: ReleaseDemoProfile;
  canEdit: boolean;
  entityArchived: boolean;
};

const emptyDraft = (): Omit<ClientContact, "id" | "createdAt" | "updatedAt" | "createdBy" | "source"> => ({
  fullName: "",
  role: "",
  phone: "",
  whatsapp: "",
  telegram: "",
  email: "",
  comment: "",
  isPrimary: false,
  isActual: true,
});

export function LegalEntityContactsSubsection({ row, legalEntityId, legalEntityName, profile, canEdit, entityArchived }: Props) {
  const [tick, setTick] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [formErr, setFormErr] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyContact, setCopyContact] = useState<ClientContact | null>(null);

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    window.addEventListener(CLIENT_CONTACTS_EVENT, fn);
    return () => window.removeEventListener(CLIENT_CONTACTS_EVENT, fn);
  }, []);

  const contacts = useMemo(() => getLegalEntityContacts(row.id, legalEntityId), [row.id, legalEntityId, tick]);
  const active = useMemo(() => contacts.filter(isClientContactActive), [contacts]);
  const pending = useMemo(() => contacts.filter((c) => c.deleteRequestedAt), [contacts]);
  const primary = useMemo(() => active.find((c) => c.isPrimary) ?? active[0], [active]);
  const others = useMemo(() => active.filter((c) => c.id !== primary?.id), [active, primary]);

  const openAdd = useCallback(() => {
    setEditingId(null);
    setDraft(emptyDraft());
    setFormErr("");
    setEditOpen(true);
  }, []);

  const openEdit = useCallback((c: ClientContact) => {
    setEditingId(c.id);
    setDraft({
      fullName: c.fullName,
      role: c.role ?? "",
      phone: formatRussianPhoneInput(c.phone ?? ""),
      whatsapp: c.whatsapp ?? "",
      telegram: c.telegram ?? "",
      email: c.email ?? "",
      comment: c.comment ?? "",
      isPrimary: c.isPrimary,
      isActual: c.isActual,
    });
    setFormErr("");
    setEditOpen(true);
  }, []);

  const onSaveForm = useCallback(() => {
    setFormErr("");
    if (!draft.fullName.trim()) {
      setFormErr("Укажите ФИО.");
      return;
    }
    if (entityArchived || !canEdit) return;
    const phoneRaw = draft.phone ?? "";
    if (phoneRaw.trim() && !isValidRussianPhone(phoneRaw)) {
      setFormErr(RU_PHONE_INVALID_MESSAGE);
      return;
    }
    const phoneOut = phoneRaw.trim() ? formatRussianPhoneInput(phoneRaw) : "";
    if (editingId) {
      updateLegalEntityContact(
        row.id,
        legalEntityId,
        editingId,
        {
          fullName: draft.fullName,
          role: draft.role,
          phone: phoneOut,
          whatsapp: draft.whatsapp,
          telegram: draft.telegram,
          email: draft.email,
          comment: draft.comment,
          isPrimary: draft.isPrimary,
          isActual: draft.isActual,
        },
        profile,
      );
    } else {
      addLegalEntityContact(
        row.id,
        legalEntityId,
        {
          fullName: draft.fullName,
          role: draft.role,
          phone: phoneOut,
          whatsapp: draft.whatsapp,
          telegram: draft.telegram,
          email: draft.email,
          comment: draft.comment,
          isPrimary: draft.isPrimary,
          isActual: draft.isActual,
        },
        profile,
        { legalEntityDisplayName: legalEntityName },
      );
    }
    setTick((n) => n + 1);
    setEditOpen(false);
  }, [draft, editingId, entityArchived, canEdit, row.id, legalEntityId, legalEntityName, profile]);

  if (entityArchived) {
    return (
      <div data-testid={`section-legal-entity-contacts-${legalEntityId}`} className="mt-2 border-t border-border/60 pt-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Контакты юрлица</p>
        <p className="mt-1 text-xs text-muted-foreground">Архивное юрлицо — редактирование контактов недоступно.</p>
      </div>
    );
  }

  return (
    <div data-testid={`section-legal-entity-contacts-${legalEntityId}`} className="mt-2 border-t border-border/60 pt-2">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Контакты юрлица</p>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-8 w-full text-xs font-semibold sm:w-auto"
            data-testid={`button-legal-entity-contact-add-${legalEntityId}`}
            onClick={openAdd}
          >
            Добавить контакт
          </Button>
        ) : null}
      </div>

      {active.length === 0 && pending.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Контакты не указаны.</p>
      ) : null}

      {primary ? (
        <div className="mt-2 space-y-1 rounded-md border border-border/60 bg-background/80 p-2 text-xs" data-testid={`row-legal-entity-contact-${primary.id}`}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{primary.fullName}</p>
            {primary.isPrimary ? (
              <Badge variant="outline" className="text-[10px]">
                Основной
              </Badge>
            ) : null}
          </div>
          {isFilled(primary.role) ? <p className="text-muted-foreground">{primary.role}</p> : null}
          {isFilled(primary.phone) ? <p className="text-foreground">Тел. {primary.phone}</p> : null}
          {formatMessengers(primary) ? <p className="text-muted-foreground">{formatMessengers(primary)}</p> : null}
          {canEdit ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[11px] font-semibold"
                data-testid={`button-legal-entity-contact-edit-${primary.id}`}
                onClick={() => openEdit(primary)}
              >
                Изменить
              </Button>
              {!primary.isPrimary ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-[11px] font-semibold"
                  data-testid={`button-legal-entity-contact-set-primary-${primary.id}`}
                  onClick={() => {
                    setPrimaryLegalEntityContact(row.id, legalEntityId, primary.id, profile);
                    setTick((n) => n + 1);
                  }}
                >
                  Сделать основным
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[11px] font-semibold"
                data-testid={`button-legal-entity-contact-delete-request-${primary.id}`}
                onClick={() => {
                  setDeleteContactId(primary.id);
                  setDeleteReason("");
                  setDeleteOpen(true);
                }}
              >
                Снять
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[11px] font-semibold"
                data-testid={`button-contact-copy-to-scopes-${primary.id}`}
                onClick={() => {
                  setCopyContact(primary);
                  setCopyOpen(true);
                }}
              >
                Скопировать контакт
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {pending.length > 0 && !showAll ? (
        <p className="mt-1 text-[11px] text-amber-800">Запросов на снятие контактов: {pending.length}</p>
      ) : null}

      {others.length > 0 || pending.length > 0 ? (
        <div className="mt-2">
          {!showAll ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs font-semibold" onClick={() => setShowAll(true)}>
              Показать все контакты
            </Button>
          ) : (
            <div className="space-y-2">
              {others.map((c) => (
                <div
                  key={c.id}
                  data-testid={`row-legal-entity-contact-${c.id}`}
                  className="rounded-md border border-border/50 bg-muted/10 p-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{c.fullName}</p>
                    {c.isPrimary ? (
                      <Badge variant="outline" className="text-[10px]">
                        Основной
                      </Badge>
                    ) : null}
                  </div>
                  {isFilled(c.role) ? <p className="text-muted-foreground">{c.role}</p> : null}
                  {isFilled(c.phone) ? <p>Тел. {c.phone}</p> : null}
                  {formatMessengers(c) ? <p className="text-muted-foreground">{formatMessengers(c)}</p> : null}
                  {canEdit ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-[11px] font-semibold"
                        data-testid={`button-legal-entity-contact-edit-${c.id}`}
                        onClick={() => openEdit(c)}
                      >
                        Изменить
                      </Button>
                      {!c.isPrimary ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-[11px] font-semibold"
                          data-testid={`button-legal-entity-contact-set-primary-${c.id}`}
                          onClick={() => {
                            setPrimaryLegalEntityContact(row.id, legalEntityId, c.id, profile);
                            setTick((n) => n + 1);
                          }}
                        >
                          Сделать основным
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-[11px] font-semibold"
                        data-testid={`button-legal-entity-contact-delete-request-${c.id}`}
                        onClick={() => {
                          setDeleteContactId(c.id);
                          setDeleteReason("");
                          setDeleteOpen(true);
                        }}
                      >
                        Снять
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-[11px] font-semibold"
                        data-testid={`button-contact-copy-to-scopes-${c.id}`}
                        onClick={() => {
                          setCopyContact(c);
                          setCopyOpen(true);
                        }}
                      >
                        Скопировать контакт
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              {pending.map((c) => (
                <div key={c.id} className="rounded-md border border-dashed border-amber-300/60 bg-amber-50/40 p-2 text-xs text-amber-950">
                  <p className="font-medium">{c.fullName}</p>
                  <p className="mt-0.5 text-[11px]">Запрос на снятие{c.deleteRequestReason ? `: ${c.deleteRequestReason}` : ""}</p>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setShowAll(false)}>
                Свернуть
              </Button>
            </div>
          )}
        </div>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="dialog-legal-entity-contact-edit">
          <DialogHeader>
            <DialogTitle className="text-base">{editingId ? "Контакт" : "Новый контакт"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {formErr ? <p className="text-xs font-medium text-destructive">{formErr}</p> : null}
            <div className="space-y-1.5">
              <Label className="text-xs">ФИО</Label>
              <Input
                className="min-h-10"
                value={draft.fullName}
                onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
                data-testid="input-legal-entity-contact-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Роль</Label>
              <Input
                className="min-h-10"
                value={draft.role}
                onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                data-testid="input-legal-entity-contact-role"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Телефон</Label>
              <Input
                className="min-h-10"
                value={draft.phone}
                inputMode="tel"
                placeholder={RU_PHONE_PLACEHOLDER}
                onChange={(e) => setDraft((d) => ({ ...d, phone: formatRussianPhoneInput(e.target.value) }))}
                data-testid="input-legal-entity-contact-phone"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp</Label>
                <Input
                  className="min-h-10"
                  value={draft.whatsapp}
                  onChange={(e) => setDraft((d) => ({ ...d, whatsapp: e.target.value }))}
                  data-testid="input-legal-entity-contact-whatsapp"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telegram</Label>
                <Input
                  className="min-h-10"
                  value={draft.telegram}
                  onChange={(e) => setDraft((d) => ({ ...d, telegram: e.target.value }))}
                  data-testid="input-legal-entity-contact-telegram"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                className="min-h-10"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                data-testid="input-legal-entity-contact-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Textarea
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                value={draft.comment}
                onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
                data-testid="textarea-legal-entity-contact-comment"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={draft.isPrimary}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, isPrimary: v === true }))}
                data-testid="checkbox-legal-entity-contact-primary"
              />
              <span>Основной контакт</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={draft.isActual}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, isActual: v === true }))}
                data-testid="checkbox-legal-entity-contact-actual"
              />
              <span>Актуален</span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" className="min-h-10 w-full font-semibold sm:w-auto" data-testid="button-legal-entity-contact-save" onClick={onSaveForm}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Запрос на снятие контакта</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Причина (необязательно)"
            rows={2}
            className="min-h-[52px] text-sm"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            data-testid="textarea-legal-entity-contact-delete-reason"
          />
          <DialogFooter>
            <Button
              type="button"
              className="min-h-10 font-semibold"
              data-testid="button-legal-entity-contact-delete-confirm"
              onClick={() => {
                if (deleteContactId) {
                  requestDeleteLegalEntityContact(row.id, legalEntityId, deleteContactId, deleteReason, profile);
                  setTick((n) => n + 1);
                }
                setDeleteOpen(false);
              }}
            >
              Отправить запрос
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {copyContact ? (
        <ContactCopyToScopesDialog
          open={copyOpen}
          onOpenChange={setCopyOpen}
          row={row}
          profile={profile}
          source={{ type: "legalEntity", legalEntityId, contactId: copyContact.id }}
          sourceContact={copyContact}
          onCopied={() => setTick((n) => n + 1)}
        />
      ) : null}
    </div>
  );
}
