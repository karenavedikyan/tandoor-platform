import { Fragment, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";
import { Gift } from "lucide-react";
import type {
  CalloutBlockPayload,
  ImageBlockPayload,
  MarketingBriefBlockRow,
  SectionBlockPayload,
  SegmentsBlockPayload,
  TextBlockPayload,
} from "@/lib/marketing-briefs-api";
import { ClientAvatar } from "@/components/ui/client-avatar";
import { Badge } from "@/components/ui/badge";
import {
  asBonusBlock,
  asPriceTableBlock,
  asProductsBlock,
  calcPriceBenefit,
  formatBriefDateRu,
  catalog1cProductHref,
  formatBriefPriceRub,
  productDisplayName,
  SegmentBadges,
} from "@/components/marketing-brief/marketing-brief-block-shared";
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

function asImage(payload: Record<string, unknown>): ImageBlockPayload {
  return {
    url: typeof payload.url === "string" ? payload.url : undefined,
    thumbnail_url: typeof payload.thumbnail_url === "string" ? payload.thumbnail_url : undefined,
    caption: typeof payload.caption === "string" ? payload.caption : undefined,
    alt: typeof payload.alt === "string" ? payload.alt : undefined,
  };
}

export type BriefInlineWrapKind = "bold" | "italic" | "underline" | "link";

const INLINE_MARKUP_RE =
  /(\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|\[(.+?)\]\((.+?)\))/g;

function safeBriefLinkHref(raw: string): string {
  const url = raw.trim();
  return /^https?:\/\//i.test(url) ? url : "#";
}

function renderBriefInlineSegment(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_MARKUP_RE.lastIndex = 0;
  while ((match = INLINE_MARKUP_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={`${keyPrefix}-t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</Fragment>,
      );
    }
    const key = `${keyPrefix}-m-${match.index}`;
    if (match[2] != null) {
      nodes.push(<strong key={key}>{match[2]}</strong>);
    } else if (match[3] != null) {
      nodes.push(<em key={key}>{match[3]}</em>);
    } else if (match[4] != null) {
      nodes.push(<u key={key}>{match[4]}</u>);
    } else if (match[5] != null && match[6] != null) {
      nodes.push(
        <a
          key={key}
          href={safeBriefLinkHref(match[6])}
          className="text-[#3F8CFF] underline underline-offset-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[5]}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}-t-end`}>{text.slice(lastIndex)}</Fragment>);
  }
  return nodes.length > 0 ? nodes : [text];
}

export function BriefInlineSpan({ text }: { text: string }) {
  return <>{renderBriefInlineSegment(text, "span")}</>;
}

export function BriefInlineText({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
}) {
  const lines = text.split("\n");
  return (
    <div className={className} style={style}>
      {lines.map((line, i) => (
        <p key={i} className={line.trim() === "" ? "min-h-[0.75rem]" : undefined}>
          {line.trim() === "" ? "\u00a0" : renderBriefInlineSegment(line, `line-${i}`)}
        </p>
      ))}
    </div>
  );
}

export function wrapBriefTextSelection(
  value: string,
  start: number,
  end: number,
  kind: BriefInlineWrapKind,
  linkUrl?: string,
): string {
  const selected = value.slice(start, end);
  const inner = selected || "текст";
  let wrapped: string;
  switch (kind) {
    case "bold":
      wrapped = `**${inner}**`;
      break;
    case "italic":
      wrapped = `*${inner}*`;
      break;
    case "underline":
      wrapped = `__${inner}__`;
      break;
    case "link":
      wrapped = `[${inner}](${(linkUrl ?? "https://").trim() || "https://"})`;
      break;
  }
  return value.slice(0, start) + wrapped + value.slice(end);
}

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return <BriefInlineText text={text} className={className} />;
}

function formatSectionNumber(num: string | undefined, fallbackIndex: number): string {
  const raw = num?.trim();
  if (raw) return raw.padStart(2, "0");
  return String(fallbackIndex + 1).padStart(2, "0");
}

function ProductCard({
  item,
  accentColor,
}: {
  item: ReturnType<typeof asProductsBlock>["items"][number];
  accentColor: string;
}) {
  const name = productDisplayName(item);
  const catalogHref = catalog1cProductHref(item.catalog_id);
  const inner = (
    <>
      <div className="relative">
        {item.image_url?.trim() ? (
          <img
            src={item.image_url}
            alt=""
            className="aspect-[4/3] w-full rounded-lg border border-border/60 object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-border/60 bg-muted/30">
            <ClientAvatar size={64} shape="square" name={name} seed={item.id} />
          </div>
        )}
        {item.segments?.length ? (
          <div className="absolute left-2 top-2">
            <SegmentBadges segments={item.segments} />
          </div>
        ) : null}
      </div>
      <h3 className="mt-3 text-base font-semibold text-[#222631]">{name}</h3>
      {item.article?.trim() ? (
        <p className="text-xs text-[#8F96B0]">Артикул: {item.article}</p>
      ) : null}
      <p className="mt-2 text-sm text-muted-foreground">
        Витрина: {formatBriefPriceRub(item.price_showroom)}
      </p>
      <p className="text-lg font-semibold text-primary" style={{ color: accentColor }}>
        Розница: {formatBriefPriceRub(item.price_retail)}
      </p>
      {item.note?.trim() ? <p className="mt-2 text-sm text-muted-foreground">{item.note}</p> : null}
    </>
  );

  if (catalogHref) {
    return (
      <Link
        href={catalogHref}
        className="block rounded-xl border border-border/70 bg-card p-3 shadow-xs transition-shadow hover:shadow-md no-underline"
      >
        {inner}
      </Link>
    );
  }

  return <article className="rounded-xl border border-border/70 bg-card p-3 shadow-xs">{inner}</article>;
}

export function MarketingBriefBlocksPublished({
  blocks,
  accentColor,
}: {
  blocks: MarketingBriefBlockRow[];
  accentColor: string;
}) {
  if (blocks.length === 0) {
    return (
      <p
        className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground"
        data-testid="marketing-brief-blocks-empty"
      >
        Содержимое брифа ещё не заполнено
      </p>
    );
  }

  let sectionCounter = 0;

  return (
    <div className="space-y-7 sm:space-y-8" data-testid="marketing-brief-blocks-published">
      {blocks.map((block) => {
        if (block.type === "section") {
          const p = asSection(block.payload);
          const num = formatSectionNumber(p.number, sectionCounter);
          sectionCounter += 1;
          return (
            <header key={block.id} className="space-y-1 border-b border-border/50 pb-4">
              <h2 className="text-xl font-semibold tracking-tight text-[#222631] sm:text-2xl">
                <span style={{ color: accentColor }} className="tabular-nums">
                  {num}
                </span>
                <span className="text-muted-foreground"> · </span>
                {p.title || "Раздел"}
              </h2>
              {p.subtitle?.trim() ? (
                <p className="text-sm text-[#8F96B0] sm:text-base">{p.subtitle}</p>
              ) : null}
            </header>
          );
        }

        if (block.type === "text") {
          const p = asText(block.payload);
          return (
            <section key={block.id} className="space-y-2">
              {p.heading?.trim() ? (
                <h3 className="text-lg font-semibold text-[#222631]">
                  <BriefInlineSpan text={p.heading} />
                </h3>
              ) : null}
              <Paragraphs text={p.body} className="text-sm leading-relaxed text-muted-foreground sm:text-base" />
            </section>
          );
        }

        if (block.type === "segments") {
          const p = asSegments(block.payload);
          const cols = [
            { key: "top150", label: "ТОП-150", value: p.segments.top150 },
            { key: "top350", label: "ТОП-350", value: p.segments.top350 },
            { key: "top500", label: "ТОП-500", value: p.segments.top500 },
            { key: "top500plus", label: "ТОП-500+", value: p.segments.top500plus },
          ] as const;
          return (
            <section key={block.id} className="space-y-3">
              {p.heading?.trim() ? (
                <h3 className="text-lg font-semibold text-[#222631]">{p.heading}</h3>
              ) : null}
              {/* TODO (Промт 106): подсветка колонки сегмента текущего менеджера */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                {cols.map((col) => (
                  <div
                    key={col.key}
                    className="rounded-xl border border-border/70 bg-card p-3 shadow-xs"
                    data-testid={`marketing-brief-segment-${col.key}`}
                  >
                    <p
                      className="mb-2 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: accentColor }}
                    >
                      {col.label}
                    </p>
                    <Paragraphs text={col.value} className="text-xs leading-relaxed text-muted-foreground" />
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (block.type === "callout") {
          const p = asCallout(block.payload);
          return (
            <aside
              key={block.id}
              className={cn(
                "rounded-xl border px-4 py-3 sm:px-5 sm:py-4",
                p.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
                p.tone === "success" && "border-[#9ACA3C]/40 bg-[#9ACA3C]/10 text-foreground",
                p.tone === "info" && "border-border bg-muted/40 text-foreground",
              )}
              data-testid={`marketing-brief-callout-${p.tone}`}
            >
              {p.heading?.trim() ? <p className="mb-1 font-semibold">{p.heading}</p> : null}
              <Paragraphs text={p.body} className="text-sm leading-relaxed" />
            </aside>
          );
        }

        if (block.type === "image") {
          const p = asImage(block.payload);
          if (!p.url) return null;
          return (
            <figure key={block.id} className="space-y-2">
              <img
                src={p.url}
                alt={p.alt || p.caption || ""}
                className="w-full rounded-[7px] border border-card-border"
                loading="lazy"
              />
              {p.caption?.trim() ? (
                <figcaption className="text-center text-sm text-muted-foreground">{p.caption}</figcaption>
              ) : null}
            </figure>
          );
        }

        if (block.type === "products") {
          const p = asProductsBlock(block.payload);
          if (p.items.length === 0) return null;
          return (
            <section key={block.id} className="space-y-4" data-testid="marketing-brief-products-block">
              {p.heading?.trim() ? (
                <h3 className="text-lg font-semibold text-[#222631]">{p.heading}</h3>
              ) : null}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {p.items.map((item) => (
                  <ProductCard key={item.id} item={item} accentColor={accentColor} />
                ))}
              </div>
            </section>
          );
        }

        if (block.type === "price_table") {
          const p = asPriceTableBlock(block.payload);
          if (p.rows.length === 0) return null;
          return (
            <section key={block.id} className="space-y-3" data-testid="marketing-brief-price-table-block">
              {p.heading?.trim() ? (
                <h3 className="text-lg font-semibold text-[#222631]">{p.heading}</h3>
              ) : null}
              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-[#8F96B0]">
                      <th className="p-3 font-medium">Модель</th>
                      <th className="p-3 font-medium">Было</th>
                      <th className="p-3 font-medium">Стало</th>
                      {p.show_benefit ? <th className="p-3 font-medium">Выгода</th> : null}
                      <th className="p-3 font-medium">Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.rows.map((row) => {
                      const benefit = calcPriceBenefit(row.price_old, row.price_new);
                      return (
                        <tr key={row.id} className="border-b border-border/40 last:border-0">
                          <td className="p-3 font-medium text-[#222631]">{row.model || "—"}</td>
                          <td className="p-3 text-muted-foreground line-through">
                            {formatBriefPriceRub(row.price_old)}
                          </td>
                          <td className="p-3 text-base font-semibold text-primary">
                            {formatBriefPriceRub(row.price_new)}
                          </td>
                          {p.show_benefit ? (
                            <td className="p-3 tabular-nums text-muted-foreground">
                              {benefit != null ? formatBriefPriceRub(benefit) : "—"}
                            </td>
                          ) : null}
                          <td className="p-3 text-muted-foreground">{row.note?.trim() || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        }

        if (block.type === "bonus") {
          const p = asBonusBlock(block.payload);
          if (p.items.length === 0) return null;
          return (
            <section key={block.id} className="space-y-3" data-testid="marketing-brief-bonus-block">
              {p.heading?.trim() ? (
                <h3 className="text-lg font-semibold text-[#222631]">{p.heading}</h3>
              ) : null}
              <ul className="space-y-3">
                {p.items.map((item) => {
                  const dateLabel = formatBriefDateRu(item.valid_until);
                  return (
                    <li
                      key={item.id}
                      className="rounded-xl border border-[#9ACA3C]/35 bg-[#9ACA3C]/8 px-4 py-3 sm:px-5"
                    >
                      <div className="flex gap-2">
                        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-[#9ACA3C]" aria-hidden />
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-[#222631]">{item.trigger || "—"}</p>
                          <p className="text-sm text-foreground">→ {item.reward || "—"}</p>
                          {item.audience?.trim() ? (
                            <p className="text-sm text-muted-foreground">{item.audience}</p>
                          ) : null}
                          <p className="text-xs text-[#8F96B0]">
                            {[item.conditions?.trim(), dateLabel ? `до ${dateLabel}` : ""]
                              .filter(Boolean)
                              .join(" · ")}
                            {item.require_photo_report ? (
                              <>
                                {(item.conditions?.trim() || dateLabel) && " · "}
                                <Badge variant="outline" className="align-middle text-[10px]">
                                  фотоотчёт
                                </Badge>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        }

        return null;
      })}
    </div>
  );
}
