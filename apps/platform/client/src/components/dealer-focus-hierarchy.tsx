import { Link } from "wouter";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { getDealerRopDisplay } from "@/lib/dealer-base-mock-data";
import { getRowHierarchy } from "@/lib/dealer-base-hierarchy-meta";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";
import { cn } from "@/lib/utils";

const linkClass =
  "text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

export type DealerFocusHierarchyProps = {
  row: DealerRow;
  snap: OrgSnapshot | null;
  showManager: boolean;
  showRop: boolean;
  /** Под ФИО клиента на mobile */
  variant: "mobile" | "table-manager" | "table-rop";
};

function HierarchyLink({
  href,
  label,
  testId,
}: {
  href: string;
  label: string;
  testId: string;
}) {
  return (
    <Link href={href} className={linkClass} data-testid={testId} onClick={(e) => e.stopPropagation()}>
      {label}
    </Link>
  );
}

export function DealerFocusHierarchy({ row, snap, showManager, showRop, variant }: DealerFocusHierarchyProps) {
  const { manager, managerUserId, rop, ropUserId } = getRowHierarchy(row, snap);

  if (variant === "table-manager") {
    if (!showManager) return <span>—</span>;
    const label = manager?.fullName?.trim() || row.manager?.trim() || "—";
    if (managerUserId && manager) {
      return (
        <HierarchyLink
          href={`/main/manager/${managerUserId}`}
          label={label}
          testId={`link-dealer-focus-manager-${row.id}`}
        />
      );
    }
    return <span className="text-muted-foreground">{label === "—" ? label : label}</span>;
  }

  if (variant === "table-rop") {
    if (!showRop) return <span>—</span>;
    const label = rop?.fullName?.trim() || getDealerRopDisplay(row) || "—";
    if (ropUserId && rop) {
      return (
        <HierarchyLink href={`/main/rop/${ropUserId}`} label={label} testId={`link-dealer-focus-rop-${row.id}`} />
      );
    }
    return <span className="text-muted-foreground">{label}</span>;
  }

  if (!showManager && !showRop) return null;

  const mgrLabel = manager?.fullName?.trim() || row.manager?.trim();
  const ropLabel = rop?.fullName?.trim() || getDealerRopDisplay(row)?.trim();

  if (!mgrLabel && !ropLabel) return null;

  return (
    <p
      className={cn("mt-0.5 text-xs text-muted-foreground")}
      data-testid={`text-dealer-focus-hierarchy-${row.id}`}
      onClick={(e) => e.stopPropagation()}
    >
      {showManager && mgrLabel ? (
        managerUserId && manager ? (
          <HierarchyLink
            href={`/main/manager/${managerUserId}`}
            label={mgrLabel}
            testId={`link-dealer-focus-manager-mobile-${row.id}`}
          />
        ) : (
          <span>{mgrLabel}</span>
        )
      ) : null}
      {showManager && mgrLabel && showRop && ropLabel ? <span className="mx-1">·</span> : null}
      {showRop && ropLabel ? (
        <>
          {showManager && mgrLabel ? <span>РОП: </span> : null}
          {ropUserId && rop ? (
            <HierarchyLink
              href={`/main/rop/${ropUserId}`}
              label={ropLabel}
              testId={`link-dealer-focus-rop-mobile-${row.id}`}
            />
          ) : (
            <span>{ropLabel}</span>
          )}
        </>
      ) : null}
    </p>
  );
}
