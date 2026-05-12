import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import {
  defaultTableJson,
  loadMarketingBriefs,
  newBriefId,
  parseTable,
  saveMarketingBriefs,
  type MarketingBrief,
  type MarketingBriefStatus,
} from "@/lib/marketing-brief-data";
import { cn } from "@/lib/utils";

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  const names = ["", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  return `${names[parseInt(mo, 10)] ?? mo} ${y}`;
}

export function MarketingBriefPublishedPage() {
  const [, params] = useRoute("/marketing-briefs/view/:id");
  const id = params?.id ?? "";
  const brief = useMemo(() => loadMarketingBriefs().find((b) => b.id === id), [id]);
  const table = brief ? parseTable(brief.tableJson) : [];

  if (!brief || brief.status !== "published") {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-24" data-testid="page-marketing-brief-view">
        <FloatingBackButton href="/marketing-briefs" label="К брифам" testId="button-floating-back-marketing-brief-view" />
        <p className="text-sm text-muted-foreground">Бриф не найден или ещё в черновике.</p>
        <Button asChild variant="outline">
          <Link href="/marketing-briefs">К списку</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24" data-testid="page-marketing-brief-view">
      <FloatingBackButton href="/marketing-briefs" label="К брифам" testId="button-floating-back-marketing-brief-view" />
      <article className="space-y-4 rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{monthLabel(brief.month)}</Badge>
          <Badge className="bg-primary/15 text-primary">Опубликовано</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{brief.title}</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground">
          {brief.text.split("\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {brief.imageUrl ? (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/20 p-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Изображение / ссылка</p>
            <img src={brief.imageUrl} alt="" className="max-h-64 w-full object-contain" />
            <a href={brief.imageUrl} className="mt-1 block truncate text-xs text-primary underline" target="_blank" rel="noreferrer">
              {brief.imageUrl}
            </a>
          </div>
        ) : null}
        <div className="w-full overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[280px] text-sm">
            <tbody>
              {table.map((row, ri) => (
                <tr key={ri} className={cn(ri === 0 ? "bg-muted/50 font-medium" : "border-t border-border/50")}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}

export default function MarketingBriefsPage() {
  const [briefs, setBriefs] = useState<MarketingBrief[]>(() => loadMarketingBriefs());
  const [selectedId, setSelectedId] = useState<string | null>(briefs[0]?.id ?? null);

  const selected = briefs.find((b) => b.id === selectedId) ?? null;

  function persist(next: MarketingBrief[]) {
    saveMarketingBriefs(next);
    setBriefs(next);
  }

  function updateSelected(patch: Partial<MarketingBrief>) {
    if (!selected) return;
    const next = briefs.map((b) => (b.id === selected.id ? { ...b, ...patch, updatedAt: new Date().toISOString() } : b));
    persist(next);
  }

  function createBrief() {
    const b: MarketingBrief = {
      id: newBriefId(),
      month: "2026-05",
      title: "Новый бриф",
      text: "",
      tableJson: defaultTableJson(),
      imageUrl: "",
      status: "draft",
      updatedAt: new Date().toISOString(),
    };
    persist([b, ...briefs]);
    setSelectedId(b.id);
  }

  function publish(id: string) {
    const next = briefs.map((b) => (b.id === id ? { ...b, status: "published" as MarketingBriefStatus, updatedAt: new Date().toISOString() } : b));
    persist(next);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24" data-testid="page-marketing-briefs">
      <FloatingBackButton href="/main" label="На главную" testId="button-floating-back-marketing-briefs" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Маркетинговые брифы</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Ежемесячные материалы для команды продаж. Создание и публикация локально (Release 1, без 1С).
          </p>
        </div>
        <Button type="button" className="min-h-10 shrink-0" onClick={createBrief}>
          Новый бриф
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="space-y-3" data-testid="section-marketing-briefs-list">
          <h2 className="text-lg font-semibold text-foreground">Список</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {briefs.map((b) => (
              <Card
                key={b.id}
                className={cn(
                  "cursor-pointer rounded-2xl border shadow-sm transition-colors",
                  selectedId === b.id ? "border-primary/50 bg-primary/5" : "border-border/80",
                )}
                data-testid={`card-marketing-brief-${b.id}`}
                onClick={() => setSelectedId(b.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{monthLabel(b.month)}</Badge>
                    <Badge variant={b.status === "published" ? "default" : "secondary"}>
                      {b.status === "published" ? "Опубликовано" : "Черновик"}
                    </Badge>
                  </div>
                  <CardTitle className="text-base leading-snug">{b.title}</CardTitle>
                </CardHeader>
                <CardFooter className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
                  {b.status === "published" ? (
                    <Button asChild variant="outline" size="sm" className="min-h-9">
                      <Link href={`/marketing-briefs/view/${b.id}`}>Просмотр для команды</Link>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-9"
                    data-testid={`button-marketing-brief-publish-${b.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      publish(b.id);
                    }}
                  >
                    Опубликовать
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5" data-testid="section-marketing-brief-editor">
          <h2 className="text-lg font-semibold text-foreground">Редактор</h2>
          {!selected ? (
            <p className="text-sm text-muted-foreground">Выберите бриф слева или создайте новый.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Месяц (YYYY-MM)</Label>
                  <Input value={selected.month} onChange={(e) => updateSelected({ month: e.target.value })} className="font-mono text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Статус</Label>
                  <Input readOnly value={selected.status === "published" ? "Опубликовано" : "Черновик"} className="bg-muted/40 text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Заголовок</Label>
                <Input value={selected.title} onChange={(e) => updateSelected({ title: e.target.value })} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Текст</Label>
                <Textarea rows={6} value={selected.text} onChange={(e) => updateSelected({ text: e.target.value })} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Таблица (JSON: массив строк — массив ячеек)</Label>
                <Textarea
                  rows={5}
                  className="font-mono text-xs"
                  value={selected.tableJson}
                  onChange={(e) => updateSelected({ tableJson: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ссылка на изображение (URL)</Label>
                <Input value={selected.imageUrl} onChange={(e) => updateSelected({ imageUrl: e.target.value })} className="text-sm" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" data-testid={`button-marketing-brief-publish-${selected.id}`} onClick={() => publish(selected.id)}>
                  Опубликовать
                </Button>
                {selected.status === "published" ? (
                  <Button asChild variant="outline">
                    <Link href={`/marketing-briefs/view/${selected.id}`}>Открыть просмотр</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
