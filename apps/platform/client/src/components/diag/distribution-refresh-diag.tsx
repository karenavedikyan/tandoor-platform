import { useEffect, useRef, useState } from "react";

type DiagSnapshot = {
  label: string;
  ts: string;
  hash: string;
};

/**
 * Временная диагностика бага «F5 сбрасывает Внесение на начало».
 * Включается только при наличии ?diag=1 в hash-query.
 * Показывает: текущий hash, снимок hash при первом монтировании (что осталось после F5),
 * и журнал ключевых значений визарда, переданных через props.
 */
export function DistributionRefreshDiag(props: {
  enabled: boolean;
  axis: string | null;
  panelState?: Record<string, unknown>;
}) {
  const { enabled, axis, panelState } = props;
  const mountHashRef = useRef<string | null>(null);
  const [, force] = useState(0);
  const logRef = useRef<DiagSnapshot[]>([]);

  // Снимок hash на момент монтирования = состояние URL сразу после F5.
  useEffect(() => {
    if (!enabled) return;
    if (mountHashRef.current === null) {
      mountHashRef.current = window.location.hash || "(empty)";
    }
    const onHash = () => force((n) => n + 1);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [enabled]);

  // Журналируем каждое изменение axis вместе с текущим hash.
  useEffect(() => {
    if (!enabled) return;
    logRef.current = [
      ...logRef.current.slice(-9),
      { label: `axis=${String(axis)}`, ts: new Date().toISOString().slice(11, 19), hash: window.location.hash || "(empty)" },
    ];
    force((n) => n + 1);
  }, [enabled, axis]);

  if (!enabled) return null;

  return (
    <div
      data-testid="distribution-refresh-diag"
      style={{
        position: "fixed",
        left: 8,
        right: 8,
        bottom: 8,
        zIndex: 99999,
        background: "rgba(17,24,39,0.96)",
        color: "#e5e7eb",
        font: "11px/1.4 ui-monospace, monospace",
        padding: "10px 12px",
        borderRadius: 10,
        maxHeight: "45vh",
        overflow: "auto",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#93c5fd" }}>
        DIAG · Дистрибуция/Внесение
      </div>
      <div>hash сейчас: <span style={{ color: "#fca5a5" }}>{window.location.hash || "(empty)"}</span></div>
      <div>hash при монтировании (после F5): <span style={{ color: "#fcd34d" }}>{mountHashRef.current ?? "(n/a)"}</span></div>
      <div>location.search: <span style={{ color: "#fca5a5" }}>{window.location.search || "(empty)"}</span></div>
      <div>axis (визард): <b style={{ color: "#86efac" }}>{String(axis)}</b></div>
      {panelState ? (
        <div style={{ marginTop: 4 }}>
          panel: <span style={{ color: "#a7f3d0" }}>{JSON.stringify(panelState)}</span>
        </div>
      ) : null}
      <div style={{ marginTop: 6, color: "#9ca3af" }}>журнал axis (последние 10):</div>
      {logRef.current.map((s, i) => (
        <div key={i} style={{ color: "#d1d5db" }}>
          {s.ts} · {s.label} · hash={s.hash}
        </div>
      ))}
    </div>
  );
}
