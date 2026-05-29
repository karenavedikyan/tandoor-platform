import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { BrandBriefView } from "@/components/marketing-brief/brand-brief-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { useRouteSearchParams } from "@/lib/hash-route-utils";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { canManageMarketingBriefs } from "@/lib/auth-access";
import {
  archiveBrief,
  briefStatusLabel,
  createBrief,
  DEFAULT_MARKETING_BRIEF_ACCENT,
  formatBriefUpdatedAt,
  formatMarketingBriefPeriodLabel,
  getBrief,
  last12PeriodOptions,
  listBlocks,
  listBriefs,
  publishBrief,
  restoreBrief,
  unpublishBrief,
  type MarketingBriefBlockRow,
  type MarketingBriefRow,
  type MarketingBriefStatus,
} from "@/lib/marketing-briefs-api";
import { toast } from "@/hooks/use-toast";

type StatusFilter = "all" | MarketingBriefStatus;

function currentPeriodLabel(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parsePreviewFromLocation(location: string): boolean {
  const q = location.includes("?") ? location.split("?")[1] : "";
  return new URLSearchParams(q).get("preview") === "1";
}

export function MarketingBriefPublishedPage() {
  const { profile } = useReleaseDemoProfile();
  const canManage = canManageMarketingBriefs(profile.role);
  const [location] = useLocation();
  const routeSearch = useRouteSearchParams();
  const [, params] = useRoute("/marketing-briefs/view/:id");
  const id = params?.id ?? "";
  const isPreview =
    routeSearch.get("preview") === "1" || parsePreviewFromLocation(location);

  const [brief, setBrief] = useState<MarketingBriefRow | null>(null);
  const [blocks, setBlocks] = useState<MarketingBriefBlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("not_found");
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        console.debug("[brief-preview] fetch", { id, isPreview, canManage, role: profile.role });
        const data = await getBrief(id);
        if (cancelled) return;
        const allowDraftPreview = isPreview && canManage;
        if (data.brief.status !== "published" && !allowDraftPreview) {
          console.warn("[brief-preview] denied", {
            status: data.brief.status,
            isPreview,
            canManage,
            role: profile.role,
          });
          setBrief(null);
          setError(isPreview && !canManage ? "no_permission" : "not_found");
        } else {
          setBrief(data.brief);
          try {
            const blockRows = await listBlocks(data.brief.id);
            if (!cancelled) setBlocks(blockRows);
          } catch {
            if (!cancelled) setBlocks([]);
          }
        }
      } catch {
        if (!cancelled) {
          setBrief(null);
          setError("not_found");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isPreview, canManage, profile.role]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" data-testid="page-marketing-brief-view">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!brief || error) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-24" data-testid="page-marketing-brief-view">
        <FloatingBackButton href="/marketing-briefs" label="К брифам" testId="button-floating-back-marketing-brief-view" />
        {error === "no_permission" ? (
          <p className="text-sm text-muted-foreground" data-testid="text-marketing-brief-no-permission">
            Предпросмотр черновика доступен только маркетологу или руководителю. Текущая роль: {profile.role}.
          </p>
        ) : null}
        {error === "not_found" ? (
          <p className="text-sm text-muted-foreground">Бриф не найден или ещё в черновике.</p>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/marketing-briefs">К списку</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-8" data-testid="page-marketing-brief-view">
      <div className="px-4 pt-4 sm:px-6">
        <FloatingBackButton href="/marketing-briefs" label="К брифам" testId="button-floating-back-marketing-brief-view" />
      </div>
      <BrandBriefView brief={brief} blocks={blocks} previewMode={isPreview && brief.status !== "published"} />
      <div className="mx-auto max-w-4xl px-4 pt-4 sm:px-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/marketing-briefs">К списку брифов</Link>
        </Button>
      </div>
    </div>
  );
}

export default function MarketingBriefsPage() {
  const { profile } = useReleaseDemoProfile();
  const [, setLocation] = useLocation();
  const canManage = canManageMarketingBriefs(profile.role);

  const [briefs, setBriefs] = useState<MarketingBriefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(canManage ? "all" : "published");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createPeriod, setCreatePeriod] = useState(currentPeriodLabel);
  const [createTitle, setCreateTitle] = useState("");
  const [createAccent, setCreateAccent] = useState(DEFAULT_MARKETING_BRIEF_ACCENT);
  const [creating, setCreating] = useState(false);

  const periodOptions = useMemo(() => last12PeriodOptions(), []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listBriefs({
        status: statusFilter === "all" ? undefined : statusFilter,
        period: periodFilter,
      });
      setBriefs(list);
    } catch (e) {
      toast({
        title: "Не удалось загрузить брифы",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
      setBriefs([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, periodFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await createBrief({
        period_label: createPeriod,
        title: createTitle.trim() || undefined,
        accent_color: createAccent,
      });
      setCreateOpen(false);
      setCreateTitle("");
      setLocation(`/marketing-briefs/${created.id}`);
    } catch (e) {
      toast({
        title: "Не удалось создать бриф",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  async function runAction(
    label: string,
    fn: (id: string) => Promise<MarketingBriefRow>,
    id: string,
  ) {
    try {
      await fn(id);
      toast({ title: label });
      await reload();
    } catch (e) {
      toast({
        title: "Ошибка",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  }

  const emptyMessage = canManage
    ? "Брифов пока нет. Создайте первый — он появится у команды после публикации."
    : "Опубликованных брифов пока нет. Маркетинг готовит свежие материалы.";

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24" data-testid="page-marketing-briefs">
      <FloatingBackButton href="/main" label="На главную" testId="button-floating-back-marketing-briefs" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Маркетинговые брифы</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {canManage ? (
              <>Ежемесячные материалы для команды продаж. Создание и публикация ведутся в этом кабинете.</>
            ) : (
              <span data-testid="text-marketing-briefs-readonly">
                Опубликованные брифы для команды продаж. Редактирование доступно руководителям и маркетологам.
              </span>
            )}
          </p>
        </div>
        {canManage ? (
          <Button type="button" className="min-h-10 shrink-0" data-testid="button-marketing-brief-new" onClick={() => setCreateOpen(true)}>
            Новый бриф
          </Button>
        ) : null}
      </div>

      {canManage ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="all">Все</TabsTrigger>
              <TabsTrigger value="draft">Черновики</TabsTrigger>
              <TabsTrigger value="published">Опубликованные</TabsTrigger>
              <TabsTrigger value="archived">Архив</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full min-w-[180px] sm:w-[220px]">
              <SelectValue placeholder="Период" />
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
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : briefs.length === 0 ? (
        <p
          className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground"
          data-testid={canManage ? "text-marketing-briefs-empty-manage" : "text-marketing-briefs-empty-published"}
        >
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="section-marketing-briefs-list">
          {briefs.map((b) => (
            <Card
              key={b.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border/80 shadow-sm"
              data-testid={`card-marketing-brief-${b.id}`}
            >
              <div
                className="px-4 py-8"
                style={{ backgroundColor: b.accent_color || DEFAULT_MARKETING_BRIEF_ACCENT }}
              >
                <p className="text-lg font-semibold text-[#222631]">{formatMarketingBriefPeriodLabel(b.period_label)}</p>
              </div>
              <CardHeader className="flex-1 pb-2">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant={b.status === "published" ? "default" : "secondary"}>{briefStatusLabel(b.status)}</Badge>
                </div>
                <CardTitle className="text-base leading-snug">{b.title}</CardTitle>
                <p className="mt-2 text-xs text-muted-foreground">
                  {b.author_name ?? "—"} · обновлено {formatBriefUpdatedAt(b.updated_at)}
                </p>
              </CardHeader>
              <CardFooter className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
                {canManage ? (
                  <>
                    <Button asChild variant="outline" size="sm" className="min-h-9">
                      <Link href={`/marketing-briefs/${b.id}`}>Открыть</Link>
                    </Button>
                    {b.status === "draft" || b.status === "archived" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-9"
                        data-testid={`button-marketing-brief-publish-${b.id}`}
                        onClick={() => void runAction("Опубликовано", publishBrief, b.id)}
                      >
                        Опубликовать
                      </Button>
                    ) : null}
                    {b.status === "published" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="min-h-9"
                        onClick={() => void runAction("Снято с публикации", unpublishBrief, b.id)}
                      >
                        Снять с публикации
                      </Button>
                    ) : null}
                    {b.status !== "archived" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-9 text-muted-foreground"
                        onClick={() => void runAction("В архиве", archiveBrief, b.id)}
                      >
                        В архив
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-9"
                        onClick={() => void runAction("Восстановлено", restoreBrief, b.id)}
                      >
                        Восстановить
                      </Button>
                    )}
                  </>
                ) : (
                  <Button asChild variant="outline" size="sm" className="min-h-9">
                    <Link href={`/marketing-briefs/view/${b.id}`}>Открыть</Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="dialog-marketing-brief-create">
          <DialogHeader>
            <DialogTitle>Создание брифа</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Период</Label>
              <Select value={createPeriod} onValueChange={setCreatePeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions
                    .filter((o) => o.value !== "all")
                    .map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Заголовок (необязательно)</Label>
              <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Автозаголовок по периоду" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Цвет акцента</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={createAccent}
                  onChange={(e) => setCreateAccent(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-border"
                  aria-label="Цвет акцента"
                />
                <Input value={createAccent} onChange={(e) => setCreateAccent(e.target.value)} className="font-mono text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={creating} onClick={() => void handleCreate()}>
              {creating ? "Создание…" : "Создать черновик"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
