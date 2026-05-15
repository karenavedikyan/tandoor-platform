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
import { Card, CardContent } from "@/components/ui/card";
import { ContactCopyToScopesDialog } from "@/components/contact-copy-to-scopes-dialog";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  addDealerContact,
  canEditClientContacts,
  CLIENT_CONTACTS_EVENT,
  getDealerContacts,
  isClientContactActive,
  requestDeleteDealerContact,
  setPrimaryDealerContact,
  updateDealerContact,
  type ClientContact,
} from "@/lib/client-contacts";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { cn } from "@/lib/utils";

function isFilled(v: string | undefined): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t !== "—" && t !== "-";
}

function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned.replace(/\D/g, "")) return "#";
  return `tel:${cleaned}`;
}

function mailHref(email: string): string {
  return `mailto:${email.trim()}`;
}

function waHref(whatsapp: string): string {
  const digits = whatsapp.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

function tgHref(telegram: string): string {
  const t = telegram.trim().replace(/^@+/, "").replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "");
  if (!t) return "#";
  return `https://t.me/${encodeURIComponent(t)}`;
}

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
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

export function DealerContactsSection({ row, profile }: Props) {
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

  const canEdit = useMemo(() => canEditClientContacts(profile, row), [profile, row]);

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    window.addEventListener(CLIENT_CONTACTS_EVENT, fn);
    return () => window.removeEventListener(CLIENT_CONTACTS_EVENT, fn);
  }, []);

  const contacts = useMemo(() => getDealerContacts(row), [row, tick]);
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
      phone: c.phone ?? "",
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
    if (!canEdit) return;
    if (editingId) {
      updateDealerContact(
        row.id,
        editingId,
        {
          fullName: draft.fullName,
          role: draft.role,
          phone: draft.phone,
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
      addDealerContact(
        row.id,
        {
          fullName: draft.fullName,
          role: draft.role,
          phone: draft.phone,
          whatsapp: draft.whatsapp,
          telegram: draft.telegram,
          email: draft.email,
          comment: draft.comment,
          isPrimary: draft.isPrimary,
          isActual: draft.isActual,
        },
        profile,
      );
    }
    setTick((n) => n + 1);
    setEditOpen(false);
  }, [draft, editingId, canEdit, row.id, profile]);

  const renderContactBlock = (c: ClientContact, isPrimaryRow: boolean) => (
    <div
      key={c.id}
      data-testid={`row-dealer-contact-${c.id}`}
      className={cn(
        "space-y-1.5 rounded-md border p-2.5 text-xs sm:p-3",
        isPrimaryRow ? "border-border/60 bg-background/80" : "border-border/50 bg-muted/10",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="min-w-0 shrink font-semibold text-foreground" data-testid={`text-dealer-contact-name-${c.id}`}>
          {c.fullName}
        </p>
        {c.isPrimary ? (
          <Badge variant="outline" className="text-[10px] shrink-0" data-testid={`badge-dealer-contact-primary-${c.id}`}>
            Основной
          </Badge>
        ) : null}
        {c.isActual ? (
          <Badge variant="secondary" className="text-[10px] shrink-0" data-testid={`badge-dealer-contact-actual-${c.id}`}>
            Актуальный
          </Badge>
        ) : null}
      </div>
      {isFilled(c.role) ? <p className="text-muted-foreground">{c.role}</p> : null}
      {isFilled(c.phone) ? (
        <p className="min-w-0 break-words">
          <a href={telHref(c.phone!)} className="font-medium text-primary underline-offset-2 hover:underline" data-testid={`link-dealer-contact-phone-${c.id}`}>
            {c.phone}
          </a>
        </p>
      ) : null}
      {isFilled(c.whatsapp) ? (
        <p className="min-w-0 break-words">
          <a
            href={waHref(c.whatsapp!)}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-testid={`link-dealer-contact-whatsapp-${c.id}`}
          >
            WhatsApp: {c.whatsapp}
          </a>
        </p>
      ) : null}
      {isFilled(c.telegram) ? (
        <p className="min-w-0 break-words">
          <a
            href={tgHref(c.telegram!)}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-testid={`link-dealer-contact-telegram-${c.id}`}
          >
            Telegram: {c.telegram}
          </a>
        </p>
      ) : null}
      {isFilled(c.email) ? (
        <p className="min-w-0 break-words">
          <a href={mailHref(c.email!)} className="font-medium text-primary underline-offset-2 hover:underline" data-testid={`link-dealer-contact-email-${c.id}`}>
            {c.email}
          </a>
        </p>
      ) : null}
      {isFilled(c.comment) ? <p className="text-muted-foreground">{c.comment}</p> : null}
      {canEdit ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[11px] font-semibold"
            data-testid={`button-dealer-contact-edit-${c.id}`}
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
              data-testid={`button-dealer-contact-set-primary-${c.id}`}
              onClick={() => {
                setPrimaryDealerContact(row.id, c.id, profile);
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
            data-testid={`button-dealer-contact-delete-request-${c.id}`}
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
  );

  return (
    <section data-testid="section-dealer-contacts" className="scroll-mt-28 space-y-3 sm:scroll-mt-32">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">Контакты клиента</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">Телефон, мессенджеры и почта — с быстрыми ссылками для связи.</p>
      </div>
      <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
        <CardContent className="space-y-3 px-3 py-3 sm:px-4 sm:py-4">
          {active.length > 0 || pending.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9 w-full text-xs font-semibold sm:w-auto"
                  data-testid="button-dealer-contact-add"
                  onClick={openAdd}
                >
                  Добавить контакт
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">Редактирование контактов недоступно для вашей роли.</p>
              )}
            </div>
          ) : null}

          {active.length === 0 && pending.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-3 text-sm">
              <p className="text-muted-foreground">Контакты не указаны.</p>
              {canEdit ? (
                <Button type="button" variant="default" size="sm" className="mt-3 min-h-9 w-full font-semibold sm:w-auto" data-testid="button-dealer-contact-add" onClick={openAdd}>
                  Добавить контакт
                </Button>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Редактирование контактов недоступно для вашей роли.</p>
              )}
            </div>
          ) : null}

          {primary ? renderContactBlock(primary, true) : null}

          {pending.length > 0 && !showAll ? (
            <p className="text-[11px] text-amber-800">Запросов на снятие контактов: {pending.length}</p>
          ) : null}

          {others.length > 0 || pending.length > 0 ? (
            <div>
              {!showAll && (others.length > 0 || pending.length > 0) ? (
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs font-semibold" onClick={() => setShowAll(true)}>
                  Показать все
                </Button>
              ) : null}
              {showAll ? (
                <div className="mt-2 space-y-2">
                  {others.map((c) => renderContactBlock(c, false))}
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
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" data-testid="dialog-dealer-contact-edit">
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
                data-testid="input-dealer-contact-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Роль / должность</Label>
              <Input
                className="min-h-10"
                value={draft.role}
                onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                data-testid="input-dealer-contact-role"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Телефон</Label>
              <Input
                className="min-h-10"
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                data-testid="input-dealer-contact-phone"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp</Label>
                <Input
                  className="min-h-10"
                  value={draft.whatsapp}
                  onChange={(e) => setDraft((d) => ({ ...d, whatsapp: e.target.value }))}
                  data-testid="input-dealer-contact-whatsapp"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telegram</Label>
                <Input
                  className="min-h-10"
                  value={draft.telegram}
                  onChange={(e) => setDraft((d) => ({ ...d, telegram: e.target.value }))}
                  data-testid="input-dealer-contact-telegram"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                className="min-h-10"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                data-testid="input-dealer-contact-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Textarea
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                value={draft.comment}
                onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
                data-testid="textarea-dealer-contact-comment"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={draft.isPrimary}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, isPrimary: v === true }))}
                data-testid="checkbox-dealer-contact-primary"
              />
              <span>Основной контакт</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={draft.isActual}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, isActual: v === true }))}
                data-testid="checkbox-dealer-contact-actual"
              />
              <span>Актуален</span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" className="min-h-10 w-full font-semibold sm:w-auto" data-testid="button-dealer-contact-save" onClick={onSaveForm}>
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
            data-testid="textarea-dealer-contact-delete-reason"
          />
          <DialogFooter>
            <Button
              type="button"
              className="min-h-10 font-semibold"
              data-testid="button-dealer-contact-delete-confirm"
              onClick={() => {
                if (deleteContactId) {
                  requestDeleteDealerContact(row.id, deleteContactId, deleteReason, profile);
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
          source={{ type: "dealer", contactId: copyContact.id }}
          sourceContact={copyContact}
          onCopied={() => setTick((n) => n + 1)}
        />
      ) : null}
    </section>
  );
}
