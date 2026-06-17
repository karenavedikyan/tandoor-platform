/**
 * Клиентский API дашборда производительности.
 */

export type PerfSummaryResponse = {
  success: boolean;
  range: string;
  overall: {
    p50_lcp: number | null;
    p75_lcp: number | null;
    p95_lcp: number | null;
    p75_inp: number | null;
    p75_cls: number | null;
    events: number;
  };
  by_pathname: Array<{
    pathname: string;
    events: number;
    p75_lcp: number | null;
    p75_inp: number | null;
    rating: string;
  }>;
  by_role: Array<{
    role: string;
    events: number;
    p75_lcp: number | null;
  }>;
  trend: Array<{
    day: string;
    p75_lcp: number | null;
    p75_lcp_mobile: number | null;
    p75_lcp_desktop: number | null;
  }>;
  budget_violations: Array<{
    pathname: string;
    metric: string;
    value: number;
    budget: number;
    message: string;
  }>;
};

export async function fetchPerfSummary(range = "7d"): Promise<PerfSummaryResponse> {
  const res = await fetch(`/api/perf/summary?range=${encodeURIComponent(range)}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = (await res.json()) as PerfSummaryResponse & { message?: string };
  if (!res.ok || !data.success) {
    throw new Error(data.message ?? `HTTP ${res.status}`);
  }
  return data;
}

export function perfSummaryToCsv(data: PerfSummaryResponse): string {
  const lines = ["pathname,events,p75_lcp,p75_inp,rating"];
  for (const row of data.by_pathname) {
    lines.push(
      [
        JSON.stringify(row.pathname),
        String(row.events),
        row.p75_lcp == null ? "" : String(Math.round(row.p75_lcp)),
        row.p75_inp == null ? "" : String(Math.round(row.p75_inp)),
        row.rating,
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
