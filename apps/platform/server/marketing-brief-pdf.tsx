/**
 * Серверная генерация PDF маркетингового брифа (@react-pdf/renderer).
 */

import React from "react";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  BonusBlockPayload,
  CalloutBlockPayload,
  MarketingBriefBlockRow,
  MarketingBriefRow,
  PriceTableBlockPayload,
  ProductsBlockItem,
  ProductsBlockPayload,
  SectionBlockPayload,
  SegmentsBlockPayload,
  TextBlockPayload,
} from "../shared/marketing-briefs-types.js";
import { formatMarketingBriefPeriodLabel } from "../shared/marketing-brief-og.js";

export type BriefPdfTheme = "light" | "dark";

const FONT_REGULAR =
  "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.ttf";
const FONT_BOLD = "https://fonts.gstatic.com/s/roboto/v30/KFOkCnqEu92Fr1Sn14dGENg.ttf";

let fontsRegistered = false;

function ensureFonts(): void {
  if (fontsRegistered) return;
  Font.register({
    family: "Roboto",
    fonts: [
      { src: FONT_REGULAR, fontWeight: 400 },
      { src: FONT_BOLD, fontWeight: 700 },
    ],
  });
  fontsRegistered = true;
}

const SEGMENT_LABELS: Record<string, string> = {
  top150: "ТОП-150",
  top350: "ТОП-350",
  top500: "ТОП-500",
  top500plus: "ТОП-500+",
};

function formatPriceRub(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateRu(iso: string | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function splitLines(text: string): string[] {
  return text.split(/\n/).map((l) => l.trimEnd());
}

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

function asProducts(payload: Record<string, unknown>): ProductsBlockPayload {
  const items: ProductsBlockItem[] = [];
  if (Array.isArray(payload.items)) {
    for (const row of payload.items) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      items.push({
        id: typeof r.id === "string" ? r.id : String(Math.random()),
        catalog_id: r.catalog_id != null ? String(r.catalog_id) : null,
        manual: r.manual === true,
        name: typeof r.name === "string" ? r.name : undefined,
        article: typeof r.article === "string" ? r.article : undefined,
        image_url: typeof r.image_url === "string" ? r.image_url : undefined,
        price_showroom: typeof r.price_showroom === "number" ? r.price_showroom : null,
        price_retail: typeof r.price_retail === "number" ? r.price_retail : null,
        note: typeof r.note === "string" ? r.note : undefined,
        segments: Array.isArray(r.segments)
          ? (r.segments.filter((x) => typeof x === "string") as ProductsBlockItem["segments"])
          : undefined,
      });
    }
  }
  return {
    heading: typeof payload.heading === "string" ? payload.heading : undefined,
    items,
  };
}

function asPriceTable(payload: Record<string, unknown>): PriceTableBlockPayload {
  const rows: PriceTableBlockPayload["rows"] = [];
  if (Array.isArray(payload.rows)) {
    for (const row of payload.rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      rows.push({
        id: typeof r.id === "string" ? r.id : String(Math.random()),
        model: typeof r.model === "string" ? r.model : "",
        price_old: typeof r.price_old === "number" ? r.price_old : null,
        price_new: typeof r.price_new === "number" ? r.price_new : null,
        note: typeof r.note === "string" ? r.note : undefined,
      });
    }
  }
  return {
    heading: typeof payload.heading === "string" ? payload.heading : undefined,
    rows,
    show_benefit: payload.show_benefit !== false,
  };
}

function asBonus(payload: Record<string, unknown>): BonusBlockPayload {
  const items: BonusBlockPayload["items"] = [];
  if (Array.isArray(payload.items)) {
    for (const row of payload.items) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      items.push({
        id: typeof r.id === "string" ? r.id : String(Math.random()),
        trigger: typeof r.trigger === "string" ? r.trigger : "",
        reward: typeof r.reward === "string" ? r.reward : "",
        audience: typeof r.audience === "string" ? r.audience : undefined,
        conditions: typeof r.conditions === "string" ? r.conditions : undefined,
        valid_until: typeof r.valid_until === "string" ? r.valid_until : undefined,
        require_photo_report: r.require_photo_report === true,
      });
    }
  }
  return {
    heading: typeof payload.heading === "string" ? payload.heading : undefined,
    items,
  };
}

function calcBenefit(oldP: number | null | undefined, newP: number | null | undefined): number | null {
  if (oldP == null || newP == null || !Number.isFinite(oldP) || !Number.isFinite(newP)) return null;
  const d = oldP - newP;
  return d > 0 ? d : null;
}

function formatSectionNumber(num: string | undefined, index: number): string {
  const raw = num?.trim();
  if (raw) return raw.length > 3 ? raw.slice(0, 3) : raw.padStart(2, "0");
  return String(index + 1).padStart(2, "0");
}

function resolveImageSrc(url: string | undefined, origin: string): string | undefined {
  const t = url?.trim();
  if (!t) return undefined;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) return `${origin}${t}`;
  return t;
}

function makeStyles(theme: BriefPdfTheme) {
  const isDark = theme === "dark";
  const muted = isDark ? "#9CA3AF" : "#6B7280";
  const border = isDark ? "#1F2937" : "#E5E7EB";
  const blockBg = isDark ? "#1A1F26" : "#F8FAFC";
  const zebra = isDark ? "#16181D" : "#F3F4F6";
  const zebraAlt = isDark ? "#1B1E24" : "#FFFFFF";

  return StyleSheet.create({
    page: {
      backgroundColor: isDark ? "#0F1419" : "#FFFFFF",
      color: isDark ? "#E5E7EB" : "#222631",
      fontFamily: "Roboto",
      fontSize: 11,
      paddingTop: 40,
      paddingBottom: 48,
      paddingHorizontal: 40,
    },
    cover: {
      paddingVertical: 36,
      marginBottom: 20,
      borderBottomWidth: 2,
      borderBottomColor: border,
    },
    coverLabel: {
      fontSize: 10,
      color: muted,
      letterSpacing: 2,
      textAlign: "center",
      textTransform: "uppercase",
    },
    coverPeriod: {
      fontSize: 28,
      fontWeight: 700,
      color: isDark ? "#FFFFFF" : "#222631",
      textAlign: "center",
      marginTop: 8,
    },
    coverTitle: {
      fontSize: 16,
      fontWeight: 600,
      textAlign: "center",
      marginTop: 10,
    },
    coverSubtitle: {
      fontSize: 11,
      color: muted,
      textAlign: "center",
      marginTop: 6,
    },
    sectionHeader: { flexDirection: "row", alignItems: "flex-start", marginTop: 18, marginBottom: 8 },
    sectionNumber: {
      backgroundColor: "#9ACA3C",
      color: "#0F1419",
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: 11,
      fontWeight: 700,
      marginRight: 10,
    },
    sectionTitle: { fontSize: 13, fontWeight: 700, flex: 1 },
    sectionSubtitle: { fontSize: 9, color: muted, marginTop: 2 },
    block: {
      backgroundColor: blockBg,
      padding: 12,
      borderRadius: 4,
      marginBottom: 8,
    },
    blockTitle: { fontWeight: 700, fontSize: 11, color: "#9ACA3C", marginBottom: 4 },
    blockText: { fontSize: 10, lineHeight: 1.45 },
    productRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
    productCard: {
      width: "48%",
      backgroundColor: blockBg,
      padding: 8,
      borderRadius: 4,
      marginBottom: 8,
      marginRight: "2%",
    },
    productImage: {
      width: "100%",
      height: 100,
      objectFit: "contain",
      backgroundColor: isDark ? "#0F1419" : "#FFFFFF",
      marginBottom: 4,
    },
    productImagePlaceholder: {
      width: "100%",
      height: 100,
      backgroundColor: zebra,
      marginBottom: 4,
      justifyContent: "center",
      alignItems: "center",
    },
    productName: { fontSize: 9, fontWeight: 600 },
    productMeta: { fontSize: 8, color: muted, marginTop: 2 },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: isDark ? "#1F2937" : "#E5E7EB",
      padding: 5,
    },
    tableHeaderCell: { flex: 1, fontSize: 9, fontWeight: 700 },
    tableRow: {
      flexDirection: "row",
      padding: 5,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    tableCell: { flex: 1, fontSize: 9 },
    priceOld: { textDecoration: "line-through", color: muted },
    priceNew: { fontWeight: 700, color: "#9ACA3C" },
    bonusBlock: {
      backgroundColor: isDark ? "#0F1419" : "#F0FDF4",
      padding: 12,
      borderRadius: 4,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: isDark ? "#1F2937" : "#D1FAE5",
    },
    bonusTitle: {
      fontSize: 11,
      fontWeight: 700,
      color: "#9ACA3C",
      marginBottom: 6,
      textTransform: "uppercase",
    },
    footer: {
      position: "absolute",
      bottom: 22,
      left: 40,
      right: 40,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 8,
      color: muted,
    },
    lastPage: {
      backgroundColor: isDark ? "#0F1419" : "#FFFFFF",
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
    },
    lastPageLogo: { fontSize: 32, fontWeight: 700, color: "#9ACA3C", letterSpacing: 2 },
    lastPageSlogan: { fontSize: 13, marginTop: 14, fontStyle: "italic", color: isDark ? "#E5E7EB" : "#222631" },
  });
}

type PdfStyles = ReturnType<typeof makeStyles>;

function BlockRenderer({
  block,
  styles,
  sectionIndexRef,
  origin,
}: {
  block: MarketingBriefBlockRow;
  styles: PdfStyles;
  sectionIndexRef: { current: number };
  origin: string;
}): React.ReactElement | null {
  if (block.type === "section") {
    const p = asSection(block.payload);
    const num = formatSectionNumber(p.number, sectionIndexRef.current);
    sectionIndexRef.current += 1;
    return (
      <View wrap={false} style={styles.sectionHeader}>
        <Text style={styles.sectionNumber}>{num}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{p.title || "Раздел"}</Text>
          {p.subtitle?.trim() ? <Text style={styles.sectionSubtitle}>{p.subtitle}</Text> : null}
        </View>
      </View>
    );
  }

  if (block.type === "text") {
    const p = asText(block.payload);
    return (
      <View style={styles.block}>
        {p.heading?.trim() ? <Text style={styles.blockTitle}>{p.heading}</Text> : null}
        {splitLines(p.body).map((line, i) => (
          <Text key={i} style={styles.blockText}>
            {line || " "}
          </Text>
        ))}
      </View>
    );
  }

  if (block.type === "segments") {
    const p = asSegments(block.payload);
    return (
      <View style={styles.block}>
        {p.heading?.trim() ? <Text style={styles.blockTitle}>{p.heading}</Text> : null}
        {(["top150", "top350", "top500", "top500plus"] as const).map((key) => (
          <View key={key} style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: "#9ACA3C" }}>
              {SEGMENT_LABELS[key]}
            </Text>
            {splitLines(p.segments[key]).map((line, i) => (
              <Text key={i} style={styles.blockText}>
                {line || " "}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (block.type === "callout") {
    const p = asCallout(block.payload);
    return (
      <View style={styles.block}>
        {p.heading?.trim() ? <Text style={styles.blockTitle}>{p.heading}</Text> : null}
        {splitLines(p.body).map((line, i) => (
          <Text key={i} style={styles.blockText}>
            {line || " "}
          </Text>
        ))}
      </View>
    );
  }

  if (block.type === "products") {
    const p = asProducts(block.payload);
    if (p.items.length === 0) return null;
    return (
      <View>
        {p.heading?.trim() ? <Text style={[styles.blockTitle, { marginBottom: 6 }]}>{p.heading}</Text> : null}
        <View style={styles.productRow}>
          {p.items.map((item) => {
            const name = item.name?.trim() || item.article?.trim() || "Товар";
            const img = resolveImageSrc(item.image_url, origin);
            const segs = (item.segments ?? [])
              .map((k) => SEGMENT_LABELS[k] ?? k)
              .join(", ");
            return (
              <View key={item.id} wrap={false} style={styles.productCard}>
                {img ? (
                  <Image src={img} style={styles.productImage} />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Text style={{ fontSize: 8, color: "#9CA3AF" }}>Нет фото</Text>
                  </View>
                )}
                <Text style={styles.productName}>{name}</Text>
                <Text style={styles.productMeta}>
                  {formatPriceRub(item.price_retail ?? item.price_showroom)}
                </Text>
                {segs ? <Text style={styles.productMeta}>{segs}</Text> : null}
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (block.type === "price_table") {
    const p = asPriceTable(block.payload);
    if (p.rows.length === 0) return null;
    return (
      <View style={styles.block}>
        {p.heading?.trim() ? <Text style={styles.blockTitle}>{p.heading}</Text> : null}
        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderCell}>Модель</Text>
          <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>Старая</Text>
          <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>Новая</Text>
          {p.show_benefit ? (
            <Text style={[styles.tableHeaderCell, { textAlign: "right" }]}>Выгода</Text>
          ) : null}
        </View>
        {p.rows.map((row) => {
          const benefit = calcBenefit(row.price_old, row.price_new);
          return (
            <View key={row.id} style={styles.tableRow}>
              <Text style={styles.tableCell}>{row.model || "—"}</Text>
              <Text style={[styles.tableCell, styles.priceOld, { textAlign: "right" }]}>
                {formatPriceRub(row.price_old)}
              </Text>
              <Text style={[styles.tableCell, styles.priceNew, { textAlign: "right" }]}>
                {formatPriceRub(row.price_new)}
              </Text>
              {p.show_benefit ? (
                <Text style={[styles.tableCell, { textAlign: "right", color: "#9CA3AF" }]}>
                  {benefit != null ? formatPriceRub(benefit) : "—"}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }

  if (block.type === "bonus") {
    const p = asBonus(block.payload);
    if (p.items.length === 0) return null;
    return (
      <View>
        <Text style={styles.bonusTitle}>{p.heading?.trim() || "БОНУС ЗА ПРОДАЖУ"}</Text>
        {p.items.map((item) => (
          <View key={item.id} wrap={false} style={styles.bonusBlock}>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>{item.trigger || "Бонус"}</Text>
            <Text style={styles.blockText}>Награда: {item.reward || "—"}</Text>
            {item.audience?.trim() ? (
              <Text style={styles.blockText}>Кому: {item.audience}</Text>
            ) : null}
            {item.conditions?.trim() ? (
              <Text style={styles.blockText}>Условия: {item.conditions}</Text>
            ) : null}
            {item.valid_until?.trim() ? (
              <Text style={styles.blockText}>До: {formatDateRu(item.valid_until)}</Text>
            ) : null}
            {item.require_photo_report ? (
              <Text style={{ color: "#9ACA3C", marginTop: 4 }}>Требуется фотоотчёт</Text>
            ) : null}
          </View>
        ))}
      </View>
    );
  }

  return null;
}

export type BriefPdfInput = {
  brief: MarketingBriefRow;
  blocks: MarketingBriefBlockRow[];
  theme?: BriefPdfTheme;
  origin?: string;
};

export async function renderBriefPdf(input: BriefPdfInput): Promise<Buffer> {
  ensureFonts();
  const theme: BriefPdfTheme = input.theme === "dark" ? "dark" : "light";
  const styles = makeStyles(theme);
  const origin = input.origin?.trim() || "https://tandoor-platform.vercel.app";
  const period = formatMarketingBriefPeriodLabel(input.brief.period_label);
  const sectionIndexRef = { current: 0 };

  const blockNodes = input.blocks.map((block) => (
    <BlockRenderer
      key={block.id}
      block={block}
      styles={styles}
      sectionIndexRef={sectionIndexRef}
      origin={origin}
    />
  ));

  const doc = (
    <Document title={input.brief.title || "Бриф TANDOOR"} author="TANDOOR">
      <Page size="A4" style={styles.page}>
        <View style={styles.cover}>
          <Text style={styles.coverLabel}>БРИФ TANDOOR</Text>
          <Text style={styles.coverPeriod}>{period}</Text>
          <Text style={styles.coverTitle}>{input.brief.title.trim() || "Без названия"}</Text>
          {input.brief.cover_text.trim() ? (
            <Text style={styles.coverSubtitle}>{input.brief.cover_text.trim()}</Text>
          ) : null}
        </View>
        {blockNodes}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `tandoor-platform · ${input.brief.title.trim() || "Бриф"} · Стр. ${pageNumber} из ${totalPages}`
          }
        />
      </Page>
      <Page size="A4" style={styles.lastPage}>
        <Text style={styles.lastPageLogo}>TANDOOR</Text>
        <Text style={styles.lastPageSlogan}>Сравнивая, выбирают нас</Text>
      </Page>
    </Document>
  );

  const buf = await renderToBuffer(doc);
  return Buffer.from(buf);
}
