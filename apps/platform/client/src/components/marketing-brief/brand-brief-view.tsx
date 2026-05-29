import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Gift, Moon, Printer, Sun } from "lucide-react";
import { BriefShareActions } from "@/components/marketing-brief/brief-visibility-ui";
import { TandoorLogo } from "@/components/tandoor-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getProductById } from "@/lib/catalog-data";
import {
  formatMarketingBriefPeriodLabel,
  type CalloutBlockPayload,
  type MarketingBriefBlockRow,
  type MarketingBriefRow,
  type SectionBlockPayload,
  type SegmentsBlockPayload,
  type TextBlockPayload,
} from "@/lib/marketing-briefs-api";
import {
  asBonusBlock,
  asPriceTableBlock,
  asProductsBlock,
  BRIEF_SEGMENT_OPTIONS,
  calcPriceBenefit,
  formatBriefDateRu,
  formatBriefPriceRub,
  productDisplayName,
} from "@/components/marketing-brief/marketing-brief-block-shared";
import {
  brandBriefTheme,
  readBriefViewTheme,
  writeBriefViewTheme,
  type BrandBriefTheme,
  type BrandBriefThemeMode,
} from "@/components/marketing-brief/brand-brief-theme";
import { cn } from "@/lib/utils";

function asSection(payload: Record<string, unknown>): SectionBlockPayload {
  return {
    number: typeof payload.number === "string" ? payload.number : undefined,
    title: typeof payload.title === "string" ? payload.title : "",
    subtitle: typeof payload.subtitle === "string" ? payload.subtitle : undefined,
  };
}

function asText(payload: Record<string, unknown>): TextBlockPayload {
  return {
    heading: typeof payload.heading === "string" ? payload.heading : undefined,
    body: typeof payload.body === "string" ? payload.body : "",
  };
}

function asSegments(payload: Record<string, unknown>): SegmentsBlockPayload {
  const seg = payload.segments;
  const s =
    seg && typeof seg === "object" && !Array.isArray(seg) ? (seg as Record<string, unknown>) : {};
  return {
    heading: typeof payload.heading === "string" ? payload.heading : undefined,
    segments: {
      top150: typeof s.top150 === "string" ? s.top150 : "",
      top350: typeof s.top350 === "string" ? s.top350 : "",
      top500: typeof s.top500 === "string" ? s.top500 : "",
      top500plus: typeof s.top500plus === "string" ? s.top500plus : "",
    },
  };
}

function asCallout(payload: Record<string, unknown>): CalloutBlockPayload {
  const toneRaw = payload.tone;
  const tone =
    toneRaw === "warning" || toneRaw === "success" || toneRaw === "info" ? toneRaw : "info";
  return {
    tone,
    heading: typeof payload.heading === "string" ? payload.heading : undefined,
    body: typeof payload.body === "string" ? payload.body : "",
  };
}

function formatSectionNumber(num: string | undefined, fallbackIndex: number): string {
  const raw = num?.trim();
  if (raw) {
    const safe = raw.length > 3 ? raw.slice(0, 3) : raw;
    return safe.padStart(2, "0");
  }
  return String(fallbackIndex + 1).padStart(2, "0");
}

function Paragraphs({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn("whitespace-pre-wrap text-sm leading-relaxed sm:text-base", className)} style={style}>
      {text.split("\n").map((line, i) => (
        <p key={i} className={line.trim() === "" ? "min-h-[0.75rem]" : undefined}>
          {line || "\u00a0"}
        </p>
      ))}
    </div>
  );
}

function TriangleMarks({ side, theme }: { side: "left" | "right"; theme: BrandBriefTheme }) {
  const colors =
    side === "left"
      ? [theme.ink, theme.accent, theme.ink]
      : [theme.accent, theme.ink, theme.accent];
  return (
    <div
      className={cn("flex gap-0.5", side === "right" && "flex-row-reverse")}
      aria-hidden
      data-testid={`brand-brief-triangles-${side}`}
    >
      {colors.map((fill, i) => (
        <svg key={i} width="10" height="28" viewBox="0 0 10 28" className="shrink-0">
          <rect x="0" y="0" width="10" height="28" fill={fill} />
        </svg>
      ))}
    </div>
  );
}

function Plaque({
  children,
  theme,
  className,
}: {
  children: ReactNode;
  theme: BrandBriefTheme;
  className?: string;
}) {
  return (
    <div
      className={cn("px-4 py-2 text-center text-xs font-bold uppercase tracking-wide sm:text-sm", className)}
      style={{ backgroundColor: theme.plaque, color: theme.text }}
    >
      {children}
    </div>
  );
}

function BrandFooter({ theme, themeMode }: { theme: BrandBriefTheme; themeMode: BrandBriefThemeMode }) {
  return (
    <footer
      className="mt-16 flex flex-col items-center gap-3 border-t pt-10 text-center"
      style={{ borderColor: theme.border }}
      data-testid="brand-brief-footer"
    >
      <TandoorLogo
        className="h-12 sm:h-14"
        variant={themeMode === "dark" ? "onDark" : "onLight"}
        data-testid="brand-brief-footer-logo"
      />
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.25em] sm:text-xs"
        style={{ color: theme.muted }}
      >
        СРАВНИВАЯ, ВЫБИРАЮТ НАС!
      </p>
    </footer>
  );
}

function enrichProductItem(item: ReturnType<typeof asProductsBlock>["items"][number]) {
  if (item.manual || !item.catalog_id) return item;
  const cat = getProductById(item.catalog_id);
  if (!cat) return item;
  return {
    ...item,
    name: item.name?.trim() ? item.name : cat.name,
    article: item.article?.trim() ? item.article : cat.article,
    image_url: item.image_url?.trim() ? item.image_url : cat.image ?? undefined,
  };
}

function productPriceLine(item: ReturnType<typeof enrichProductItem>): string {
  const name = productDisplayName(item);
  const price = item.price_retail ?? item.price_showroom;
  if (price != null) return `${name} (${formatBriefPriceRub(price).replace(/\s/g, " ")})`;
  return name;
}

function renderBrandBlock(
  block: MarketingBriefBlockRow,
  ctx: { theme: BrandBriefTheme; sectionIndex: number },
): { node: ReactNode; nextSectionIndex: number } {
  const { theme } = ctx;
  let sectionIndex = ctx.sectionIndex;

  if (block.type === "section") {
    const p = asSection(block.payload);
    const num = formatSectionNumber(p.number, sectionIndex);
    sectionIndex += 1;
    return {
      nextSectionIndex: sectionIndex,
      node: (
        <header
          key={block.id}
          className="space-y-2 border-b pb-6"
          style={{ borderColor: theme.border }}
          data-testid="brand-brief-section"
        >
          <div className="flex items-start gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden text-sm font-bold leading-none text-white"
              style={{ backgroundColor: theme.accent }}
              title={p.number?.trim() || ""}
              aria-hidden
            >
              {num}
            </span>
            <div className="min-w-0 flex-1 space-y-1 break-words">
              <h2
                className="break-words text-xl font-bold uppercase leading-tight sm:text-2xl"
                style={{ color: theme.text, wordBreak: "break-word", overflowWrap: "anywhere" }}
              >
                {p.title || "Раздел"}
              </h2>
              {p.subtitle?.trim() ? (
                <p
                  className="break-words text-sm sm:text-base"
                  style={{ color: theme.muted, wordBreak: "break-word", overflowWrap: "anywhere" }}
                >
                  {p.subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </header>
      ),
    };
  }

  if (block.type === "text") {
    const p = asText(block.payload);
    return {
      nextSectionIndex: sectionIndex,
      node: (
        <section key={block.id} className="space-y-2" data-testid="brand-brief-text">
          {p.heading?.trim() ? (
            <h3 className="text-lg font-semibold" style={{ color: theme.text }}>
              {p.heading}
            </h3>
          ) : null}
          <Paragraphs text={p.body} style={{ color: theme.text }} />
        </section>
      ),
    };
  }

  if (block.type === "segments") {
    const p = asSegments(block.payload);
    const cols = BRIEF_SEGMENT_OPTIONS.map((o) => ({
      ...o,
      value: p.segments[o.key],
    }));
    return {
      nextSectionIndex: sectionIndex,
      node: (
        <section key={block.id} className="space-y-3" data-testid="brand-brief-segments">
          {p.heading?.trim() ? (
            <h3 className="text-lg font-semibold" style={{ color: theme.text }}>
              {p.heading}
            </h3>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cols.map((col) => (
              <div
                key={col.key}
                className="rounded-lg p-4"
                style={{ backgroundColor: theme.zebra }}
              >
                <p className="mb-2 text-sm font-bold uppercase" style={{ color: theme.accent }}>
                  {col.label}
                </p>
                <Paragraphs text={col.value} style={{ color: theme.text }} className="text-sm" />
              </div>
            ))}
          </div>
        </section>
      ),
    };
  }

  if (block.type === "callout") {
    const p = asCallout(block.payload);
    const borderLeft =
      p.tone === "warning" ? "#DC2626" : p.tone === "success" ? theme.accent : "transparent";
    return {
      nextSectionIndex: sectionIndex,
      node: (
        <section key={block.id} data-testid={`brand-brief-callout-${p.tone}`}>
          {p.heading?.trim() ? <Plaque theme={theme}>{p.heading}</Plaque> : null}
          <div
            className="px-1 py-3 sm:px-2"
            style={{ borderLeftWidth: borderLeft === "transparent" ? 0 : 4, borderLeftColor: borderLeft }}
          >
            <Paragraphs text={p.body} style={{ color: theme.text }} />
          </div>
        </section>
      ),
    };
  }

  if (block.type === "products") {
    const p = asProductsBlock(block.payload);
    if (p.items.length === 0) return { nextSectionIndex: sectionIndex, node: null };
    return {
      nextSectionIndex: sectionIndex,
      node: (
        <section key={block.id} className="space-y-4" data-testid="brand-brief-products">
          {p.heading?.trim() ? (
            <h3 className="text-lg font-semibold" style={{ color: theme.text }}>
              {p.heading}
            </h3>
          ) : null}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {p.items.map((raw) => {
              const item = enrichProductItem(raw);
              const segLabels = (item.segments ?? []).map(
                (k) => BRIEF_SEGMENT_OPTIONS.find((o) => o.key === k)?.label ?? k,
              );
              return (
                <article
                  key={item.id}
                  className="flex w-full flex-col"
                  data-testid={`brand-brief-product-${item.id}`}
                >
                  <div
                    className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded border"
                    style={{ borderColor: theme.border, backgroundColor: theme.zebra }}
                  >
                    {item.image_url?.trim() ? (
                      <img
                        src={item.image_url}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="text-xs" style={{ color: theme.muted }}>
                        Нет фото
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium leading-snug" style={{ color: theme.text }}>
                    {productPriceLine(item)}
                  </p>
                  {item.price_showroom != null && item.price_retail != null ? (
                    <p className="text-[10px] leading-tight" style={{ color: theme.muted }}>
                      Шоурум: {formatBriefPriceRub(item.price_showroom)}
                      <br />
                      Розница: {formatBriefPriceRub(item.price_retail)}
                    </p>
                  ) : null}
                  {segLabels.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {segLabels.map((l) => (
                        <Badge
                          key={l}
                          variant="outline"
                          className="h-5 px-1.5 text-[9px] font-semibold"
                          style={{ borderColor: theme.accent, color: theme.text }}
                        >
                          {l}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ),
    };
  }

  if (block.type === "price_table") {
    const p = asPriceTableBlock(block.payload);
    if (p.rows.length === 0) return { nextSectionIndex: sectionIndex, node: null };
    return {
      nextSectionIndex: sectionIndex,
      node: (
        <section key={block.id} className="space-y-3" data-testid="brand-brief-price-table">
          {p.heading?.trim() ? <Plaque theme={theme}>{p.heading}</Plaque> : null}
          <div className="overflow-x-auto rounded border" style={{ borderColor: theme.border }}>
            <table className="w-full min-w-[480px] text-sm" style={{ color: theme.text }}>
              <thead>
                <tr style={{ backgroundColor: theme.plaque }}>
                  <th className="p-2 text-left font-semibold">Модель</th>
                  <th className="p-2 text-right font-semibold">Старая цена</th>
                  <th className="p-2 text-right font-semibold">Новая цена</th>
                  {p.show_benefit ? <th className="p-2 text-right font-semibold">Выгода</th> : null}
                </tr>
              </thead>
              <tbody>
                {p.rows.map((row, ri) => {
                  const benefit = calcPriceBenefit(row.price_old, row.price_new);
                  return (
                    <tr
                      key={row.id}
                      style={{ backgroundColor: ri % 2 === 0 ? theme.zebraAlt : theme.zebra }}
                    >
                      <td className="p-2 font-medium">{row.model || "—"}</td>
                      <td className="p-2 text-right tabular-nums line-through" style={{ color: theme.muted }}>
                        {formatBriefPriceRub(row.price_old)}
                      </td>
                      <td className="p-2 text-right tabular-nums font-semibold">{formatBriefPriceRub(row.price_new)}</td>
                      {p.show_benefit ? (
                        <td className="p-2 text-right tabular-nums" style={{ color: theme.muted }}>
                          {benefit != null ? formatBriefPriceRub(benefit) : "—"}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ),
    };
  }

  if (block.type === "bonus") {
    const p = asBonusBlock(block.payload);
    if (p.items.length === 0) return { nextSectionIndex: sectionIndex, node: null };
    return {
      nextSectionIndex: sectionIndex,
      node: (
        <section key={block.id} className="space-y-4" data-testid="brand-brief-bonus">
          <Plaque theme={theme}>{p.heading?.trim() || "БОНУС ЗА ПРОДАЖУ"}</Plaque>
          <ul className="space-y-4">
            {p.items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border p-4"
                style={{ borderColor: theme.border, backgroundColor: theme.zebra }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Gift className="h-5 w-5 shrink-0" style={{ color: theme.accent }} aria-hidden />
                  <p className="font-semibold uppercase text-sm" style={{ color: theme.text }}>
                    {item.trigger || "Бонус"}
                  </p>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-[minmax(7rem,auto)_1fr]">
                  <dt style={{ color: theme.muted }}>За что</dt>
                  <dd style={{ color: theme.text }}>{item.trigger || "—"}</dd>
                  <dt style={{ color: theme.muted }}>Сколько / что получает</dt>
                  <dd style={{ color: theme.text }} className="whitespace-pre-wrap">
                    {item.reward || "—"}
                  </dd>
                  {item.audience?.trim() ? (
                    <>
                      <dt style={{ color: theme.muted }}>Кому</dt>
                      <dd style={{ color: theme.text }}>{item.audience}</dd>
                    </>
                  ) : null}
                  {item.conditions?.trim() ? (
                    <>
                      <dt style={{ color: theme.muted }}>Условия</dt>
                      <dd style={{ color: theme.text }}>{item.conditions}</dd>
                    </>
                  ) : null}
                  {item.valid_until?.trim() ? (
                    <>
                      <dt style={{ color: theme.muted }}>Действует до</dt>
                      <dd style={{ color: theme.text }}>{formatBriefDateRu(item.valid_until)}</dd>
                    </>
                  ) : null}
                  {item.require_photo_report ? (
                    <>
                      <dt style={{ color: theme.muted }} />
                      <dd style={{ color: theme.accent }}>✓ Требуется фотоотчёт</dd>
                    </>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ),
    };
  }

  return { nextSectionIndex: sectionIndex, node: null };
}

export function BrandBriefView({
  brief,
  blocks,
  previewMode = false,
  showShare = false,
  showPrint = false,
  onBriefChange,
}: {
  brief: MarketingBriefRow;
  blocks: MarketingBriefBlockRow[];
  previewMode?: boolean;
  /** Кнопки «Поделиться» / «Сделать публичным» для опубликованного брифа */
  showShare?: boolean;
  /** Кнопка «Печать / PDF» */
  showPrint?: boolean;
  onBriefChange?: (brief: MarketingBriefRow) => void;
}) {
  const [themeMode, setThemeMode] = useState<BrandBriefThemeMode>(() => readBriefViewTheme());

  useEffect(() => {
    writeBriefViewTheme(themeMode);
  }, [themeMode]);

  const theme = useMemo(() => brandBriefTheme(themeMode), [themeMode]);
  const periodLabel = formatMarketingBriefPeriodLabel(brief.period_label).toUpperCase();

  const blockNodes = useMemo(() => {
    const nodes: ReactNode[] = [];
    let sectionIndex = 0;
    for (const block of blocks) {
      const { node, nextSectionIndex } = renderBrandBlock(block, { theme, sectionIndex });
      sectionIndex = nextSectionIndex;
      if (node) nodes.push(node);
    }
    return nodes;
  }, [blocks, theme]);

  const setLight = useCallback(() => setThemeMode("light"), []);
  const setDark = useCallback(() => setThemeMode("dark"), []);

  const handlePrint = useCallback(() => {
    setThemeMode("light");
    window.requestAnimationFrame(() => {
      window.print();
    });
  }, []);

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: theme.bg, color: theme.text, fontFamily: '"Exo 2", var(--font-sans), sans-serif' }}
      data-testid="brand-brief-view"
      data-theme={themeMode}
      data-print-root
    >
      <div
        className="sticky top-0 z-40 border-b px-4 py-3 backdrop-blur-md sm:px-6"
        style={{ borderColor: theme.border, backgroundColor: `${theme.bg}ee` }}
        data-testid="brand-brief-topbar"
        data-no-print="true"
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <TandoorLogo
            className="h-8 sm:h-9"
            compact
            variant={themeMode === "dark" ? "onDark" : "onLight"}
            data-testid="brand-brief-logo"
          />
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {showShare ? (
              <div data-no-print="true" className="[&_button]:h-8 [&_button]:text-xs">
                <BriefShareActions brief={brief} onBriefUpdated={onBriefChange} />
              </div>
            ) : null}
            {showPrint ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 px-2 text-xs"
                onClick={handlePrint}
                data-testid="button-brief-print"
                data-no-print="true"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Печать / PDF</span>
              </Button>
            ) : null}
            <div
              className="flex items-center gap-1 rounded-lg border p-0.5"
              style={{ borderColor: theme.border }}
              data-no-print="true"
            >
              <Button
                type="button"
                size="sm"
                variant={themeMode === "light" ? "secondary" : "ghost"}
                className="h-8 gap-1 px-2 text-xs"
                onClick={setLight}
                data-testid="brand-brief-theme-light"
              >
                <Sun className="h-3.5 w-3.5" aria-hidden />
                Светлая
              </Button>
              <Button
                type="button"
                size="sm"
                variant={themeMode === "dark" ? "secondary" : "ghost"}
                className="h-8 gap-1 px-2 text-xs"
                onClick={setDark}
                data-testid="brand-brief-theme-dark"
              >
                <Moon className="h-3.5 w-3.5" aria-hidden />
                Тёмная
              </Button>
            </div>
          </div>
        </div>
      </div>

      {previewMode ? (
        <div
          className="border-b px-4 py-2 text-center text-xs font-medium"
          style={{ borderColor: theme.border, backgroundColor: theme.plaque, color: theme.text }}
          data-testid="brand-brief-preview-banner"
          data-no-print="true"
        >
          Режим предпросмотра — бриф ещё не опубликован для команды
        </div>
      ) : null}

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="relative mb-10 space-y-4" data-testid="brand-brief-hero">
          <div className="flex items-start justify-between gap-4">
            <TriangleMarks side="left" theme={theme} />
            <div className="min-w-0 flex-1 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] sm:text-sm" style={{ color: theme.muted }}>
                Бриф Tandoor
              </p>
              <h1 className="mt-2 text-2xl font-bold uppercase tracking-wide sm:text-3xl" style={{ color: theme.text }}>
                {periodLabel}
              </h1>
            </div>
            <TriangleMarks side="right" theme={theme} />
          </div>
          {brief.title.trim() ? (
            <p className="text-center text-lg font-semibold sm:text-xl" style={{ color: theme.text }}>
              {brief.title}
            </p>
          ) : null}
          {brief.cover_text.trim() ? (
            <Paragraphs text={brief.cover_text} className="mx-auto max-w-2xl text-center" style={{ color: theme.muted }} />
          ) : null}
        </header>

        {blocks.length === 0 ? (
          <p className="py-12 text-center text-sm" style={{ color: theme.muted }} data-testid="brand-brief-blocks-empty">
            Содержимое брифа ещё не заполнено
          </p>
        ) : (
          <div className="space-y-10 sm:space-y-12">{blockNodes}</div>
        )}

        <BrandFooter theme={theme} themeMode={themeMode} />
      </main>
    </div>
  );
}
