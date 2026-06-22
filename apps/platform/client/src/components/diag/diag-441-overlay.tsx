import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { isDiag441Enabled } from "@/lib/diag-441-enabled";
import { useHashQuery } from "@/lib/hash-location-router";

const BUFFER_LIMIT = 200;
const REFRESH_MS = 700;
const DISPLAY_LINES = 40;

type Diag441Stats = {
  maxRenderN: number;
  renderLogCount: number;
  analyticsDepsChangedCount: number;
  lastDepsChanged: string;
  realScopeSize: string;
  realScopeFlag: string;
  scopedDealersLen: string;
  firstError: string;
  rising: boolean;
};

type DisplaySnapshot = {
  stats: Diag441Stats;
  diagLines: string[];
  errorLines: string[];
  allText: string;
};

function emptyStats(): Diag441Stats {
  return {
    maxRenderN: 0,
    renderLogCount: 0,
    analyticsDepsChangedCount: 0,
    lastDepsChanged: "—",
    realScopeSize: "—",
    realScopeFlag: "—",
    scopedDealersLen: "—",
    firstError: "—",
    rising: false,
  };
}

function formatArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function formatLogLine(level: "log" | "warn" | "error", args: unknown[]): string {
  const prefix = level === "error" ? "ERROR:" : level === "warn" ? "WARN:" : "";
  const body = args.map(formatArg).join(" ");
  return prefix ? `${prefix} ${body}` : body;
}

function applyDiag441Line(line: string, stats: Diag441Stats, renderTimestamps: number[]): void {
  if (!line.includes("[diag-441b]")) return;

  const renderMatch = line.match(/DistributionAnalyticsPage render #(\d+)/);
  if (renderMatch) {
    const n = Number(renderMatch[1]);
    stats.renderLogCount += 1;
    if (n > stats.maxRenderN) {
      stats.maxRenderN = n;
      renderTimestamps.push(Date.now());
    }
  }

  if (line.includes("analyticsData useMemo deps changed")) {
    stats.analyticsDepsChangedCount += 1;
    stats.lastDepsChanged = line.replace(/^.*\[diag-441b\]\s*/, "");
  } else if (line.includes("scopedRows useMemo deps changed")) {
    stats.lastDepsChanged = line.replace(/^.*\[diag-441b\]\s*/, "");
  } else if (line.includes("useSidebarNavRealScope")) {
    stats.lastDepsChanged = line.replace(/^.*\[diag-441b\]\s*/, "");
  }

  if (line.includes("[diag-441b] inputs")) {
    const sizeMatch = line.match(/"realScope\.size":(\d+)/);
    if (sizeMatch) stats.realScopeSize = sizeMatch[1];
    const lenMatch = line.match(/"scopedDealers\.len":(\d+)/);
    if (lenMatch) stats.scopedDealersLen = lenMatch[1];
    const scopeFlagMatch = line.match(/"realScope":"(same|NEW)"/);
    if (scopeFlagMatch) stats.realScopeFlag = scopeFlagMatch[1];
  }
}

function applyDiag441InputsObject(obj: Record<string, unknown>, stats: Diag441Stats): void {
  const scopeSize = obj["realScope.size"];
  if (typeof scopeSize === "number") stats.realScopeSize = String(scopeSize);
  const dealersLen = obj["scopedDealers.len"];
  if (typeof dealersLen === "number") stats.scopedDealersLen = String(dealersLen);
  const scopeFlag = obj.realScope;
  if (typeof scopeFlag === "string") stats.realScopeFlag = scopeFlag;
}

function buildSummary(stats: Diag441Stats): string {
  return [
    "[441 DIAG]",
    `render #: ${stats.maxRenderN} (rising: ${stats.rising ? "yes" : "no"} за последние 2с)`,
    `last deps changed: ${stats.lastDepsChanged}`,
    `realScope.size: ${stats.realScopeSize} (${stats.realScopeFlag})`,
    `scopedDealers.len: ${stats.scopedDealersLen}`,
    `ERROR: ${stats.firstError}`,
  ].join("\n");
}

export function Diag441Overlay(): ReactElement | null {
  const routeQs = useHashQuery();
  void routeQs;
  const enabled = isDiag441Enabled();

  const bufferRef = useRef<string[]>([]);
  const statsRef = useRef<Diag441Stats>(emptyStats());
  const renderTimestampsRef = useRef<number[]>([]);
  const risingBaselineRef = useRef({ maxN: 0, at: Date.now() });

  const [visible, setVisible] = useState(true);
  const [snapshot, setSnapshot] = useState<DisplaySnapshot>({
    stats: emptyStats(),
    diagLines: [],
    errorLines: [],
    allText: "",
  });

  const refreshSnapshot = useCallback(() => {
    const now = Date.now();
    const stats = { ...statsRef.current };
    const recentRenders = renderTimestampsRef.current.filter((t) => now - t <= 2000);
    renderTimestampsRef.current = recentRenders;

    if (now - risingBaselineRef.current.at >= 2000) {
      risingBaselineRef.current = { maxN: stats.maxRenderN, at: now };
    }
    stats.rising = stats.maxRenderN > risingBaselineRef.current.maxN && recentRenders.length > 0;

    const allLines = bufferRef.current;
    const diagLines = allLines.filter((l) => l.includes("[diag-441b]")).slice(-DISPLAY_LINES);
    const errorLines = allLines.filter((l) => l.startsWith("ERROR:")).slice(-20);
    const summary = buildSummary(stats);
    const allText = [summary, "", "--- recent [diag-441b] ---", ...diagLines, "", "--- errors ---", ...errorLines].join(
      "\n",
    );

    setSnapshot({ stats, diagLines, errorLines, allText });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    bufferRef.current = [];
    statsRef.current = emptyStats();
    renderTimestampsRef.current = [];
    risingBaselineRef.current = { maxN: 0, at: Date.now() };

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const pushLine = (line: string): void => {
      const buf = bufferRef.current;
      buf.push(line);
      if (buf.length > BUFFER_LIMIT) buf.shift();
      applyDiag441Line(line, statsRef.current, renderTimestampsRef.current);
    };

    console.log = (...args: unknown[]) => {
      originalLog(...args);
      const line = formatLogLine("log", args);
      pushLine(line);
      const head = typeof args[0] === "string" ? args[0] : "";
      if (head.includes("[diag-441b] inputs") && args[1] && typeof args[1] === "object") {
        applyDiag441InputsObject(args[1] as Record<string, unknown>, statsRef.current);
      }
    };

    console.warn = (...args: unknown[]) => {
      originalWarn(...args);
      pushLine(formatLogLine("warn", args));
    };

    console.error = (...args: unknown[]) => {
      originalError(...args);
      const line = formatLogLine("error", args);
      pushLine(line);
      if (statsRef.current.firstError === "—") {
        statsRef.current.firstError = args.map(formatArg).join(" ").slice(0, 500);
      }
    };

    refreshSnapshot();
    const interval = window.setInterval(refreshSnapshot, REFRESH_MS);

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      window.clearInterval(interval);
    };
  }, [enabled, refreshSnapshot]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard?.writeText(snapshot.allText);
  }, [snapshot.allText]);

  if (!enabled || !visible) return null;

  const { stats, diagLines, errorLines } = snapshot;
  const summary = buildSummary(stats);

  return (
    <div
      className="fixed bottom-0 left-0 z-[2147483647] flex h-[55vh] w-screen flex-col border-t border-zinc-700 bg-zinc-950/95 text-zinc-100 shadow-2xl"
      data-testid="diag-441-overlay"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800 px-2 py-1.5">
        <span className="text-[11px] font-semibold text-amber-300">441 mobile diag</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-zinc-600 px-2 py-0.5 text-[11px]"
            onClick={handleCopy}
          >
            Копировать всё
          </button>
          <button
            type="button"
            className="rounded border border-zinc-600 px-2 py-0.5 text-[11px]"
            onClick={() => setVisible(false)}
          >
            Скрыть
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[11px] leading-snug">
        <pre className="mb-2 whitespace-pre-wrap break-all text-xs font-bold text-amber-200">{summary}</pre>
        <pre className="mb-2 whitespace-pre-wrap break-all text-zinc-300">
          {diagLines.join("\n")}
        </pre>
        {errorLines.length > 0 ? (
          <pre className="whitespace-pre-wrap break-all text-red-300">{errorLines.join("\n")}</pre>
        ) : null}
      </div>
    </div>
  );
}
