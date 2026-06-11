import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, Calendar, Eye, Loader2 } from "lucide-react";
import { BriefShareActions, BriefVisibilityToggle } from "@/components/marketing-brief/brief-visibility-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { canManageMarketingBriefs } from "@/lib/auth-access";
import {
  BriefBlocksAddToolbar,
  BriefBlocksEditor,
} from "@/components/marketing-brief/brief-blocks-editor";
import {
  archiveBrief,
  briefDisplayTitle,
  DEFAULT_MARKETING_BRIEF_ACCENT,
  formatBriefUpdatedAt,
  getBrief,
  last12PeriodOptions,
  publishBrief,
  restoreBrief,
  revisionActionLabel,
  unpublishBrief,
  updateBrief,
  type MarketingBriefBlockType,
  type MarketingBriefCategory,
  type MarketingBriefRevisionRow,
  type MarketingBriefRow,
  type MarketingBriefViewStats,
} from "@/lib/marketing-briefs-api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { buildBrowserHashAppHref } from "@/lib/hash-route-utils";

const FIELD_CLASS =
  "rounded-[6px] border border-card-border bg-background text-foreground focus-visible:ring-ring/30";

function saveStatusText(
  saveState: "idle" | "saving" | "saved" | "error",
  readOnlyFields: boolean,
): { text: string; className: string } {
  if (readOnlyFields) {
    return { text: "Только для просмотра", className: "text-muted-foreground" };
  }
  if (saveState === "saving") {
    return { text: "Сохранение…", className: "text-muted-foreground" };
  }
  if (saveState === "saved") {
    return { text: "Сохранено", className: "text-[#9ACA3C]" };
  }
  if (saveState === "error") {
    return { text: "Ошибка сохранения", className: "text-destructive" };
  }
  return { text: "Изменения сохраняются автоматически", className: "text-muted-foreground" };
}

export default function MarketingBriefEditorPage() {
  const { profile } = useReleaseDemoProfile();
  const canManage = canManageMarketingBriefs(profile.role);
  const [, params] = useRoute("/marketing-briefs/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState<MarketingBriefRow | null>(null);
  const [revisions, setRevisions] = useState<MarketingBriefRevisionRow[]>([]);
  const [periodLabel, setPeriodLabel] = useState("");
  const [title, setTitle] = useState("");
  const [coverText, setCoverText] = useState("");
  const [accentColor, setAccentColor] = useState(DEFAULT_MARKETING_BRIEF_ACCENT);
  const [category, setCategory] = useState<MarketingBriefCategory>("brief");
  const [viewStats, setViewStats] = useState<MarketingBriefViewStats | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [archiveOpen, setArchiveOpen] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineRef = useRef<string>("");
  const dirtyMetaRef = useRef(false);
  const addBlockRef = useRef<((type: MarketingBriefBlockType) => void) | null>(null);

  const periodOptions = useMemo(() => last12PeriodOptions().filter((o) => o.value !== "all"), []);

  const registerAddBlock = useCallback((addBlock: (type: MarketingBriefBlockType) => void) => {
    addBlockRef.current = addBlock;
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getBrief(id);
      setBrief(data.brief);
      setRevisions(data.revisions);
      setPeriodLabel(data.brief.period_label);
      setTitle(data.brief.title);
      setCoverText(data.brief.cover_text);
      setAccentColor(data.brief.accent_color || DEFAULT_MARKETING_BRIEF_ACCENT);
      setCategory(data.brief.category ?? "brief");
      setViewStats(data.viewStats ?? null);
      baselineRef.current = JSON.stringify({
        period_label: data.brief.period_label,
        title: data.brief.title,
        cover_text: data.brief.cover_text,
        accent_color: data.brief.accent_color,
        category: data.brief.category ?? "brief",
      });
      dirtyMetaRef.current = false;
    } catch {
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!canManage && id) {
      setLocation(`/marketing-briefs/view/${id}`);
      return;
    }
    void load();
  }, [canManage, id, load, setLocation]);

  const scheduleSave = useCallback(() => {
    if (!id || !brief || brief.status === "archived") return;
    dirtyMetaRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const snapshot = JSON.stringify({
        period_label: periodLabel,
        title,
        cover_text: coverText,
        accent_color: accentColor,
        category,
      });
      if (snapshot === baselineRef.current) {
        dirtyMetaRef.current = false;
        return;
      }

      void (async () => {
        setSaveState("saving");
        try {
          const updated = await updateBrief(id, {
            period_label: periodLabel,
            title,
            cover_text: coverText,
            accent_color: accentColor,
            category,
          });
          setBrief((prev) =>
            prev
              ? {
                  ...prev,
                  updated_at: updated.updated_at,
                  status: updated.status,
                  published_at: updated.published_at,
                  archived_at: updated.archived_at,
                }
              : updated,
          );
          baselineRef.current = snapshot;
          dirtyMetaRef.current = false;
          setSaveState("saved");
        } catch (e) {
          setSaveState("error");
          toast({
            title: "Не удалось сохранить",
            description: e instanceof Error ? e.message : undefined,
            variant: "destructive",
          });
        }
      })();
    }, 800);
  }, [id, brief, periodLabel, title, coverText, accentColor, category]);

  useEffect(() => {
    scheduleSave();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [periodLabel, title, coverText, accentColor, category, scheduleSave]);

  async function runStatusAction(fn: (briefId: string) => Promise<MarketingBriefRow>, successTitle: string) {
    if (!id) return;
    try {
      const updated = await fn(id);
      setBrief(updated);
      await load();
      toast({ title: successTitle });
    } catch (e) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  }

  if (!canManage) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-background" data-testid="page-marketing-brief-editor">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="mx-auto max-w-lg space-y-4 bg-background px-4 pb-24 pt-4" data-testid="page-marketing-brief-editor">
        <p className="text-sm text-muted-foreground">Бриф не найден.</p>
        <Button asChild variant="outline" className="rounded-[6px] border-card-border bg-card">
          <Link href="/marketing-briefs">К списку</Link>
        </Button>
      </div>
    );
  }

  const readOnlyFields = brief.status === "archived";
  const saveStatus = saveStatusText(saveState, readOnlyFields);

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="page-marketing-brief-editor">
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-[6px] border-card-border bg-card text-foreground hover:bg-background"
            data-testid="button-marketing-brief-back"
            onClick={() => setLocation("/marketing-briefs")}
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" aria-hidden />
            Назад
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 rounded-[6px] border-[1.5px] border-[#9ACA3C] bg-card text-[#9ACA3C] hover:bg-[#9ACA3C]/5"
            data-testid="button-marketing-brief-preview"
            onClick={() => {
              const url = buildBrowserHashAppHref(`/marketing-briefs/view/${brief.id}`, { preview: 1 });
              window.open(url, "_blank", "noopener,noreferrer");
            }}
          >
            <Eye className="h-4 w-4" aria-hidden />
            Предпросмотр
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {brief.status === "draft" || brief.status === "archived" ? (
            <Button
              type="button"
              size="sm"
              className="rounded-[6px] bg-[#9ACA3C] text-white hover:bg-[#8ab835]"
              onClick={() => void runStatusAction(publishBrief, "Опубликовано")}
            >
              Опубликовать
            </Button>
          ) : null}
          {brief.status === "published" ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="rounded-[6px]"
              onClick={() => void runStatusAction(unpublishBrief, "Снято с публикации")}
            >
              Снять с публикации
            </Button>
          ) : null}
          {brief.status !== "archived" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-[6px] border-card-border bg-card"
              onClick={() => setArchiveOpen(true)}
            >
              В архив
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-[6px] border-card-border bg-card"
              onClick={() => void runStatusAction(restoreBrief, "Восстановлено")}
            >
              Восстановить
            </Button>
          )}
          {brief.status === "published" ? (
            <>
              <BriefShareActions brief={brief} onBriefUpdated={setBrief} />
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href={`/marketing-briefs/view/${brief.id}`}>Просмотр для команды</Link>
              </Button>
            </>
          ) : null}
        </div>

        {brief.status !== "archived" ? (
          <BriefVisibilityToggle
            briefId={brief.id}
            visibility={brief.visibility ?? "private"}
            disabled={readOnlyFields}
            onUpdated={setBrief}
          />
        ) : null}

        {viewStats ? (
          <p className="text-sm text-muted-foreground" data-testid="text-marketing-brief-view-stats">
            👁 Прочитали: {viewStats.viewed_count} из {viewStats.audience_count} менеджеров ({viewStats.percent}%)
          </p>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-6">
            <section className="relative overflow-hidden rounded-[7px] border border-card-border bg-card">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-[#9ACA3C]" aria-hidden />
              <div className="flex items-start justify-between gap-3 px-5 pb-5 pt-6 sm:px-6">
                <h2 className="text-xl font-semibold text-foreground sm:text-2xl">Метаданные</h2>
                <p
                  className={cn("shrink-0 text-sm", saveStatus.className)}
                  data-testid="text-marketing-brief-save-status"
                >
                  {saveStatus.text}
                </p>
              </div>
              <div className="space-y-4 px-5 pb-6 sm:px-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Категория</Label>
                    <Select
                      value={category}
                      onValueChange={(v) => setCategory(v as MarketingBriefCategory)}
                      disabled={readOnlyFields}
                    >
                      <SelectTrigger className={FIELD_CLASS} data-testid="select-marketing-brief-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brief">Бриф</SelectItem>
                        <SelectItem value="promo">Акция</SelectItem>
                        <SelectItem value="info">Информация</SelectItem>
                        <SelectItem value="letter">Информационные письма</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Период</Label>
                    <div className="relative">
                      <Select value={periodLabel} onValueChange={setPeriodLabel} disabled={readOnlyFields}>
                        <SelectTrigger className={cn(FIELD_CLASS, "pr-9")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {periodOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Calendar
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Название</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={readOnlyFields}
                    placeholder={briefDisplayTitle("").text}
                    className={FIELD_CLASS}
                    data-testid="input-brief-title-inline"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Пояснительный текст</Label>
                  <Textarea
                    rows={4}
                    value={coverText}
                    onChange={(e) => setCoverText(e.target.value)}
                    disabled={readOnlyFields}
                    className={FIELD_CLASS}
                  />
                </div>
              </div>
            </section>

            {!readOnlyFields ? (
              <div className="lg:hidden">
                <BriefBlocksAddToolbar
                  orientation="horizontal"
                  onAdd={(type) => addBlockRef.current?.(type)}
                />
              </div>
            ) : null}

            <BriefBlocksEditor
              briefId={brief.id}
              canEdit={!readOnlyFields}
              externalAddToolbar
              registerAddBlock={registerAddBlock}
            />

            {revisions.length > 0 ? (
              <section className="space-y-2 rounded-[7px] border border-card-border bg-card p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-foreground">История изменений</h2>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {revisions.slice(0, 10).map((r) => (
                    <li key={r.id} className="flex flex-wrap gap-x-2 gap-y-0.5 border-b border-card-border pb-2 last:border-0">
                      <span className="tabular-nums text-foreground">{formatBriefUpdatedAt(r.created_at)}</span>
                      <span>{r.actor_name ?? "—"}</span>
                      <span>{revisionActionLabel(r.action)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {!readOnlyFields ? (
            <aside className="hidden shrink-0 lg:block">
              <div className="sticky top-4">
                <BriefBlocksAddToolbar
                  orientation="vertical"
                  onAdd={(type) => addBlockRef.current?.(type)}
                />
              </div>
            </aside>
          ) : null}
        </div>
      </div>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перенести бриф в архив?</AlertDialogTitle>
            <AlertDialogDescription>
              Бриф скроется у команды продаж. Его можно восстановить из вкладки «Архив».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setArchiveOpen(false);
                void runStatusAction(archiveBrief, "В архиве");
              }}
            >
              В архив
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
