import type {
  CalloutBlockPayload,
  MarketingBriefBlockRow,
  SectionBlockPayload,
  SegmentsBlockPayload,
  TextBlockPayload,
} from "@/lib/marketing-briefs-api";
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

function Paragraphs({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <p key={i} className={line.trim() === "" ? "min-h-[0.75rem]" : undefined}>
          {line || "\u00a0"}
        </p>
      ))}
    </div>
  );
}

function formatSectionNumber(num: string | undefined, fallbackIndex: number): string {
  const raw = num?.trim();
  if (raw) return raw.padStart(2, "0");
  return String(fallbackIndex + 1).padStart(2, "0");
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
                <h3 className="text-lg font-semibold text-[#222631]">{p.heading}</h3>
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

        return null;
      })}
    </div>
  );
}
