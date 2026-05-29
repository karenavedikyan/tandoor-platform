import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { canManageMarketingBriefs } from "@/lib/auth-access";
import {
  archiveBrief,
  briefStatusLabel,
  DEFAULT_MARKETING_BRIEF_ACCENT,
  formatBriefUpdatedAt,
  formatMarketingBriefPeriodLabel,
  getBrief,
  last12PeriodOptions,
  publishBrief,
  restoreBrief,
  revisionActionLabel,
  unpublishBrief,
  updateBrief,
  type MarketingBriefRevisionRow,
  type MarketingBriefRow,
} from "@/lib/marketing-briefs-api";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BriefBlocksEditor } from "@/components/marketing-brief/brief-blocks-editor";
import { buildBrowserHashAppHref } from "@/lib/hash-route-utils";

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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [archiveOpen, setArchiveOpen] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineRef = useRef<string>("");
  const dirtyMetaRef = useRef(false);

  const periodOptions = useMemo(() => last12PeriodOptions().filter((o) => o.value !== "all"), []);

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
      baselineRef.current = JSON.stringify({
        period_label: data.brief.period_label,
        title: data.brief.title,
        cover_text: data.brief.cover_text,
        accent_color: data.brief.accent_color,
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
      const snapshot = JSON.stringify({ period_label: periodLabel, title, cover_text: coverText, accent_color: accentColor });
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
  }, [id, brief, periodLabel, title, coverText, accentColor]);

  useEffect(() => {
    scheduleSave();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [periodLabel, title, coverText, accentColor, scheduleSave]);

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
      <div className="flex min-h-[40vh] items-center justify-center" data-testid="page-marketing-brief-editor">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-24" data-testid="page-marketing-brief-editor">
        <FloatingBackButton href="/marketing-briefs" label="К брифам" testId="button-floating-back-marketing-brief-editor" />
        <p className="text-sm text-muted-foreground">Бриф не найден.</p>
        <Button asChild variant="outline">
          <Link href="/marketing-briefs">К списку</Link>
        </Button>
      </div>
    );
  }

  const readOnlyFields = brief.status === "archived";

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24" data-testid="page-marketing-brief-editor">
      <FloatingBackButton href="/marketing-briefs" label="К брифам" testId="button-floating-back-marketing-brief-editor" />

      <div
        className="overflow-hidden rounded-2xl border border-border/80 shadow-sm"
        style={{ borderTopWidth: 6, borderTopColor: accentColor }}
      >
        <div className="space-y-2 px-5 py-6 sm:px-8" style={{ backgroundColor: accentColor }}>
          <p className="text-2xl font-semibold text-[#222631]">{formatMarketingBriefPeriodLabel(periodLabel)}</p>
        </div>
        <div className="space-y-3 border-t border-border/60 bg-card px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{briefStatusLabel(brief.status)}</Badge>
            <span className="text-xs text-muted-foreground">
              {brief.author_name ?? "—"} · обновлено {formatBriefUpdatedAt(brief.updated_at)}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          data-testid="button-marketing-brief-preview"
          onClick={() => {
            const url = buildBrowserHashAppHref(`/marketing-briefs/view/${brief.id}`, { preview: 1 });
            window.open(url, "_blank", "noopener,noreferrer");
          }}
        >
          <Eye className="h-4 w-4" aria-hidden />
          Предпросмотр
        </Button>
        {brief.status === "draft" || brief.status === "archived" ? (
          <Button type="button" onClick={() => void runStatusAction(publishBrief, "Опубликовано")}>
            Опубликовать
          </Button>
        ) : null}
        {brief.status === "published" ? (
          <Button type="button" variant="secondary" onClick={() => void runStatusAction(unpublishBrief, "Снято с публикации")}>
            Снять с публикации
          </Button>
        ) : null}
        {brief.status !== "archived" ? (
          <Button type="button" variant="outline" onClick={() => setArchiveOpen(true)}>
            В архив
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => void runStatusAction(restoreBrief, "Восстановлено")}>
            Восстановить
          </Button>
        )}
        {brief.status === "published" ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/marketing-briefs/view/${brief.id}`}>Просмотр для команды</Link>
          </Button>
        ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">Предпросмотр откроется в новой вкладке</p>
      </div>

      <p
        className={cn(
          "text-xs",
          saveState === "error" ? "text-destructive" : saveState === "saved" ? "text-emerald-700" : "text-muted-foreground",
        )}
        data-testid="text-marketing-brief-save-status"
      >
        {saveState === "saving"
          ? "Сохранение…"
          : saveState === "saved"
            ? "Сохранено"
            : saveState === "error"
              ? "Ошибка сохранения"
              : readOnlyFields
                ? "Архивный бриф только для просмотра"
                : "Изменения сохраняются автоматически"}
      </p>

      <section className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Метаданные</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Период</Label>
            <Select value={periodLabel} onValueChange={setPeriodLabel} disabled={readOnlyFields}>
              <SelectTrigger>
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
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Заголовок</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnlyFields} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Текст обложки</Label>
            <Textarea rows={4} value={coverText} onChange={(e) => setCoverText(e.target.value)} disabled={readOnlyFields} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Акцентный цвет</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                disabled={readOnlyFields}
                className="h-10 w-14 cursor-pointer rounded border border-border"
                aria-label="Акцентный цвет"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                disabled={readOnlyFields}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </div>
      </section>

      <BriefBlocksEditor briefId={brief.id} canEdit={!readOnlyFields} />

      {revisions.length > 0 ? (
        <section className="space-y-2 rounded-2xl border border-border/80 bg-muted/10 p-4">
          <h2 className="text-sm font-semibold text-foreground">История изменений</h2>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {revisions.slice(0, 10).map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-2 gap-y-0.5 border-b border-border/40 pb-2 last:border-0">
                <span className="tabular-nums text-foreground">{formatBriefUpdatedAt(r.created_at)}</span>
                <span>{r.actor_name ?? "—"}</span>
                <span>{revisionActionLabel(r.action)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перенести бриф в архив?</AlertDialogTitle>
            <AlertDialogDescription>Бриф скроется у команды продаж. Его можно восстановить из вкладки «Архив».</AlertDialogDescription>
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
