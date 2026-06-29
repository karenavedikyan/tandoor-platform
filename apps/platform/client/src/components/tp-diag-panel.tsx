import { useCallback, useEffect, useState } from "react";
import {
  clearTpDiag,
  formatTpDiagData,
  getTpDiag,
  isTpDiagEnabled,
  TP_DIAG_EVENT,
  type TpDiagEntry,
} from "@/lib/tp-diag-trace";

type Props = {
  dealerId: string;
};

export function TpDiagPanel({ dealerId }: Props) {
  const [entries, setEntries] = useState<TpDiagEntry[]>(() => (isTpDiagEnabled() ? getTpDiag() : []));

  const refresh = useCallback(() => {
    if (!isTpDiagEnabled()) return;
    setEntries(getTpDiag());
  }, []);

  useEffect(() => {
    if (!isTpDiagEnabled()) return;
    refresh();
    const onDiag = () => refresh();
    window.addEventListener(TP_DIAG_EVENT, onDiag);
    return () => window.removeEventListener(TP_DIAG_EVENT, onDiag);
  }, [refresh]);

  if (!isTpDiagEnabled()) return null;

  return (
    <div
      data-testid="panel-tp-diag"
      className="fixed bottom-0 left-0 right-0 z-[9999] flex max-h-[35vh] flex-col border-t border-white/20 bg-black/85 text-[10px] leading-tight text-green-300 shadow-lg backdrop-blur-sm"
      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/15 px-2 py-1 text-[10px] text-green-200">
        <span className="truncate font-semibold">TP DIAG · dealer={dealerId}</span>
        <button
          type="button"
          className="shrink-0 rounded border border-white/25 px-2 py-0.5 text-[10px] text-green-100 hover:bg-white/10"
          data-testid="button-tp-diag-clear"
          onClick={() => {
            clearTpDiag();
            refresh();
          }}
        >
          Очистить
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1">
        {entries.length === 0 ? (
          <p className="text-white/50">ожидание событий…</p>
        ) : (
          <ul className="space-y-0.5">
            {entries.map((e, i) => (
              <li key={`${e.t}-${e.tag}-${i}`} className="overflow-x-auto whitespace-nowrap">
                <span className="text-white/60">[{e.t}ms]</span>{" "}
                <span className="text-green-400">{e.tag}</span>
                {e.data ? <span className="text-green-200"> {formatTpDiagData(e.data)}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
