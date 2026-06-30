import type { RopTeamTreeDiagLine } from "@/lib/dealer-base-rop-tree-diag";

type Props = {
  lines: RopTeamTreeDiagLine[];
};

export function RopTeamTreeDiagPanel({ lines }: Props) {
  if (lines.length === 0) return null;

  return (
    <div
      className="fixed bottom-3 left-3 z-[80] max-h-[40vh] w-[min(100vw-1.5rem,42rem)] overflow-auto rounded-lg border border-amber-500/50 bg-amber-50/95 p-2 text-[10px] leading-snug text-amber-950 shadow-lg dark:bg-amber-950/90 dark:text-amber-50"
      data-testid="panel-rop-tree-diag"
    >
      <p className="mb-1 font-semibold">diag-rop-tree (временно)</p>
      <ul className="space-y-1">
        {lines.map((line) => (
          <li key={`${line.name}-${line.role}`} data-testid={`rop-tree-diag-line-${line.role}`}>
            {line.name} | role={line.role} | inCatalog={line.inCatalog ? "да" : "нет"} |
            dbTotals.active_dealers={line.dbActive ?? "—"} | dbTotals.active_trade_points=
            {line.dbOutlets ?? "—"} | final.active={line.finalActive} | final.outlets={line.finalOutlets} |
            path={line.path}
          </li>
        ))}
      </ul>
    </div>
  );
}
