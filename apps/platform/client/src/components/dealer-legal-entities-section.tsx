import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  addDealerLegalEntity,
  archiveDealerLegalEntity,
  canEditDealerLegalEntities,
  DEALER_LEGAL_ENTITIES_EVENT,
  getMergedDealerLegalEntities,
  type DealerLegalEntityStatus,
  updateDealerLegalEntity,
} from "@/lib/dealer-legal-entities";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { LegalEntityContactsSubsection } from "@/components/legal-entity-contacts-subsection";
import { buildLegalEntityNameSuggestions, lookupLegalEntityByInn } from "@/lib/legal-entity-directory";
import { toast } from "@/hooks/use-toast";

type Props = {
  row: DealerRow;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorLabel: string;
};

const STATUS_LABELS: Record<DealerLegalEntityStatus, string> = {
  main: "Основное",
  additional: "Дополнительное",
  archived: "Архив",
};

function isFilled(v: string | undefined): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t !== "—" && t !== "-";
}

export function DealerLegalEntitiesSection({ row, profile, actorUserId, actorLabel }: Props) {
  const canEdit = canEditDealerLegalEntities(profile, row);
  const [tick, setTick] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [draftName, setDraftName] = useState("");
  const [draftInn, setDraftInn] = useState("");
  const [draftKpp, setDraftKpp] = useState("");
  const [draftAddress, setDraftAddress] = useState("");
  const [draftStatus, setDraftStatus] = useState<DealerLegalEntityStatus>("additional");
  const [draftComment, setDraftComment] = useState("");
  const [innLookupResults, setInnLookupResults] = useState<
    { id: string; name: string; inn: string; kpp?: string; legalAddress?: string; source: string }[]
  >([]);
  const [innLookupNote, setInnLookupNote] = useState("");

  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    window.addEventListener(DEALER_LEGAL_ENTITIES_EVENT, fn);
    return () => window.removeEventListener(DEALER_LEGAL_ENTITIES_EVENT, fn);
  }, []);

  const merged = useMemo(() => getMergedDealerLegalEntities(row), [row, tick]);

  const nameSuggestions = useMemo(() => buildLegalEntityNameSuggestions(draftName, row.id), [draftName, row.id, tick]);

  const visible = useMemo(() => {
    const active = merged.filter((e) => e.status !== "archived");
    const arch = merged.filter((e) => e.status === "archived");
    return { active, arch };
  }, [merged]);

  const resetDraft = useCallback(() => {
    setDraftName("");
    setDraftInn("");
    setDraftKpp("");
    setDraftAddress("");
    setDraftStatus("additional");
    setDraftComment("");
    setInnLookupResults([]);
    setInnLookupNote("");
  }, []);

  const loadEntityIntoDraft = useCallback((id: string) => {
    const e = merged.find((x) => x.id === id && !x.isPassportSeed);
    if (!e) return;
    setDraftName(e.name);
    setDraftInn(e.inn ?? "");
    setDraftKpp(e.kpp ?? "");
    setDraftAddress(e.legalAddress ?? "");
    setDraftStatus(e.status);
    setDraftComment(e.comment ?? "");
    setEditingId(id);
    setFormOpen(true);
  }, [merged]);

  const onSave = useCallback(() => {
    if (!canEdit || !draftName.trim()) return;
    if (editingId && !editingId.startsWith("passport:")) {
      updateDealerLegalEntity(
        row.id,
        editingId,
        {
          name: draftName,
          inn: draftInn,
          kpp: draftKpp,
          legalAddress: draftAddress,
          status: draftStatus,
          comment: draftComment,
        },
        actorUserId,
        actorLabel,
      );
    } else {
      addDealerLegalEntity(row.id, {
        name: draftName,
        inn: draftInn,
        kpp: draftKpp,
        legalAddress: draftAddress,
        status: draftStatus,
        comment: draftComment,
        updatedBy: actorUserId,
        updatedByName: actorLabel,
      });
    }
    setTick((n) => n + 1);
    setEditingId(null);
    setFormOpen(false);
    resetDraft();
  }, [
    canEdit,
    draftName,
    draftInn,
    draftKpp,
    draftAddress,
    draftStatus,
    draftComment,
    editingId,
    row.id,
    actorUserId,
    actorLabel,
    resetDraft,
  ]);

  const onCancelForm = useCallback(() => {
    setFormOpen(false);
    setEditingId(null);
    resetDraft();
  }, [resetDraft]);

  return (
    <section id="dealer-section-legal-entities" data-testid="section-dealer-legal-entities" className="scroll-mt-28 space-y-2 sm:scroll-mt-32">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-foreground sm:text-base">Юридические лица</h3>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-9 w-full font-semibold sm:w-auto"
            data-testid="button-dealer-legal-entity-add"
            onClick={() => {
              setEditingId(null);
              resetDraft();
              setFormOpen((v) => !v);
            }}
          >
            {formOpen && !editingId ? "Закрыть форму" : "Добавить юрлицо"}
          </Button>
        ) : null}
      </div>

      {formOpen ? (
        <Card className="rounded-xl border border-border/70 bg-card shadow-xs">
          <CardHeader className="space-y-1 p-3 pb-2 sm:p-4">
            <CardTitle className="text-sm">{editingId ? "Редактирование" : "Новое юрлицо"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="space-y-1.5">
              <Label className="text-xs">Наименование</Label>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                disabled={!canEdit}
                className="min-h-10"
                data-testid="input-legal-entity-name"
              />
              {nameSuggestions.length > 0 && canEdit ? (
                <div
                  className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-2"
                  data-testid="section-legal-entity-suggestions"
                >
                  {nameSuggestions.map((s) => (
                    <div key={s.id} className="flex items-start justify-between gap-2 rounded border border-transparent px-1 py-0.5 hover:bg-card">
                      <div className="min-w-0" data-testid={`row-legal-entity-suggestion-${s.id}`}>
                        <p className="truncate text-xs font-medium text-foreground">{s.name}</p>
                        {s.inn ? <p className="text-[10px] text-muted-foreground">ИНН {s.inn}</p> : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-7 shrink-0 px-2 text-[10px]"
                        data-testid={`button-legal-entity-suggestion-apply-${s.id}`}
                        onClick={() => {
                          setDraftName(s.name);
                          if (s.inn) setDraftInn(s.inn);
                          if (s.kpp) setDraftKpp(s.kpp);
                          if (s.legalAddress) setDraftAddress(s.legalAddress);
                        }}
                      >
                        Применить
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">ИНН</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={draftInn}
                    onChange={(e) => {
                      setDraftInn(e.target.value);
                      setInnLookupResults([]);
                      setInnLookupNote("");
                    }}
                    disabled={!canEdit}
                    className="min-h-10 sm:flex-1"
                    data-testid="input-legal-entity-inn"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-10 shrink-0 text-xs"
                    disabled={!canEdit}
                    data-testid="button-legal-entity-inn-lookup"
                    onClick={() => {
                      const res = lookupLegalEntityByInn(draftInn);
                      if (!res.ok) {
                        toast({ title: "ИНН", description: res.error, variant: "destructive" });
                        setInnLookupResults([]);
                        setInnLookupNote("");
                        return;
                      }
                      setInnLookupResults(res.results);
                      setInnLookupNote(
                        res.results.length === 0
                          ? "По локальной базе данные не найдены. Для автозаполнения из внешних источников нужно подключить сервис проверки ИНН."
                          : "",
                      );
                    }}
                  >
                    Найти по ИНН
                  </Button>
                </div>
                {innLookupNote ? <p className="text-[11px] leading-snug text-muted-foreground">{innLookupNote}</p> : null}
                {innLookupResults.length > 0 ? (
                  <div className="space-y-1 rounded-md border border-border/70 bg-muted/15 p-2" data-testid="section-legal-entity-inn-results">
                    {innLookupResults.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded px-1 py-1" data-testid={`row-legal-entity-inn-result-${r.id}`}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{r.name}</p>
                          <p className="text-[10px] text-muted-foreground">{r.source}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-8 text-[10px]"
                          data-testid={`button-legal-entity-inn-result-apply-${r.id}`}
                          onClick={() => {
                            setDraftName((prev) => (prev.trim() ? prev : r.name));
                            setDraftInn(r.inn);
                            setDraftKpp((k) => (k.trim() ? k : r.kpp ?? ""));
                            setDraftAddress((a) => (a.trim() ? a : r.legalAddress ?? ""));
                          }}
                        >
                          Применить
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">КПП</Label>
                <Input
                  value={draftKpp}
                  onChange={(e) => setDraftKpp(e.target.value)}
                  disabled={!canEdit}
                  className="min-h-10"
                  data-testid="input-dealer-legal-entity-kpp"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Юридический адрес</Label>
              <Textarea
                value={draftAddress}
                onChange={(e) => setDraftAddress(e.target.value)}
                disabled={!canEdit}
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                data-testid="textarea-dealer-legal-entity-address"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Статус</Label>
              <Select
                value={draftStatus}
                onValueChange={(v) => setDraftStatus(v as DealerLegalEntityStatus)}
                disabled={!canEdit}
              >
                <SelectTrigger className="min-h-10" data-testid="select-dealer-legal-entity-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">{STATUS_LABELS.main}</SelectItem>
                  <SelectItem value="additional">{STATUS_LABELS.additional}</SelectItem>
                  <SelectItem value="archived">{STATUS_LABELS.archived}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Комментарий</Label>
              <Textarea
                value={draftComment}
                onChange={(e) => setDraftComment(e.target.value)}
                disabled={!canEdit}
                rows={2}
                className="min-h-[52px] resize-y text-sm"
                data-testid="textarea-dealer-legal-entity-comment"
              />
            </div>
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="min-h-9 font-semibold"
                  data-testid="button-dealer-legal-entity-save"
                  disabled={!draftName.trim()}
                  onClick={onSave}
                >
                  Сохранить
                </Button>
                <Button type="button" variant="ghost" size="sm" className="min-h-9" onClick={onCancelForm}>
                  Отмена
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {visible.active.length === 0 && visible.arch.length === 0 ? (
        <p className="text-sm text-muted-foreground">Юрлица не указаны.</p>
      ) : (
        <div className="space-y-2">
          {visible.active.map((e) => (
            <div
              key={e.id}
              data-testid={`row-dealer-legal-entity-${e.id}`}
              className="rounded-lg border border-border/70 bg-muted/10 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold leading-snug text-foreground">{e.name}</p>
                    {e.isPassportSeed ? (
                      <Badge variant="outline" className="text-[10px]">
                        Из данных релиза
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="text-[10px]">
                      {STATUS_LABELS[e.status]}
                    </Badge>
                  </div>
                  {isFilled(e.inn) ? (
                    <p className="text-xs text-muted-foreground">
                      ИНН {e.inn}
                      {isFilled(e.kpp) ? ` · КПП ${e.kpp}` : ""}
                    </p>
                  ) : isFilled(e.kpp) ? (
                    <p className="text-xs text-muted-foreground">КПП {e.kpp}</p>
                  ) : null}
                  {isFilled(e.legalAddress) ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">{e.legalAddress}</p>
                  ) : null}
                  {isFilled(e.comment) ? <p className="text-xs text-foreground">{e.comment}</p> : null}
                  <LegalEntityContactsSubsection
                    row={row}
                    legalEntityId={e.id}
                    legalEntityName={e.name}
                    profile={profile}
                    canEdit={canEdit}
                    entityArchived={false}
                  />
                </div>
                {canEdit && !e.isPassportSeed ? (
                  <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-9 px-2 text-xs font-semibold"
                      data-testid={`button-dealer-legal-entity-edit-${e.id}`}
                      onClick={() => loadEntityIntoDraft(e.id)}
                    >
                      Изменить
                    </Button>
                    {e.status !== "archived" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="min-h-9 px-2 text-xs font-semibold"
                        data-testid={`button-dealer-legal-entity-archive-${e.id}`}
                        onClick={() => {
                          archiveDealerLegalEntity(row.id, e.id, actorUserId, actorLabel);
                          setTick((n) => n + 1);
                        }}
                      >
                        В архив
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {visible.arch.length > 0 ? (
            <div className="pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-8 px-2 text-xs font-semibold text-muted-foreground"
                onClick={() => setShowArchived((v) => !v)}
              >
                {showArchived ? "Скрыть архив" : `Архив (${visible.arch.length})`}
              </Button>
              {showArchived ? (
                <div className="mt-2 space-y-2 opacity-90">
                  {visible.arch.map((e) => (
                    <div
                      key={e.id}
                      data-testid={`row-dealer-legal-entity-${e.id}`}
                      className="rounded-lg border border-dashed border-border/80 bg-muted/5 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-muted-foreground">{e.name}</p>
                        <Badge variant="outline" className="text-[10px]">
                          Архив
                        </Badge>
                      </div>
                      {canEdit && !e.isPassportSeed ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 min-h-8 text-xs"
                          data-testid={`button-dealer-legal-entity-edit-${e.id}`}
                          onClick={() => loadEntityIntoDraft(e.id)}
                        >
                          Изменить
                        </Button>
                      ) : null}
                      <LegalEntityContactsSubsection
                        row={row}
                        legalEntityId={e.id}
                        legalEntityName={e.name}
                        profile={profile}
                        canEdit={canEdit}
                        entityArchived={true}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
