/**
 * ROP scope: teamCodes по живому dealer_overrides.rop_id + team_id fallback для пустых rop_id.
 *
 * Запуск: `npx vitest run shared/__tests__/db-scope-formula-rop-ropid.spec.ts`
 */
import { describe, expect, it } from "vitest";
import type { PoolLike } from "../responsibility-resolver.js";
import { resolveScopeCodesMeta } from "../db-scope-formula.js";

const ROP_X = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ROP_Y = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEAM_X = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TEAM_Y = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type TeamAssignment = { client_code: string; team_id: string };
type DealerRop = { client_code: string; rop_id: string | null };

function makePool(opts: {
  teamAssignments: TeamAssignment[];
  dealerRops: DealerRop[];
  ropTeamIds?: string[];
  ownCodesByRop?: Record<string, string[]>;
}): PoolLike {
  const ropByCode = new Map(opts.dealerRops.map((r) => [r.client_code.toUpperCase(), r.rop_id]));
  const teamAssignments = opts.teamAssignments;
  const ropTeamIds = opts.ropTeamIds ?? [TEAM_X];

  const resolveRopTeamCodes = (ropUserId: string, teamIds: string[]): string[] => {
    const teamIdSet = new Set(teamIds);
    const codes = new Set<string>();

    for (const row of opts.dealerRops) {
      if (row.rop_id === ropUserId) codes.add(row.client_code.toUpperCase());
    }

    for (const ca of teamAssignments) {
      if (!teamIdSet.has(ca.team_id)) continue;
      const ropId = ropByCode.get(ca.client_code.toUpperCase()) ?? null;
      if (ropId == null) codes.add(ca.client_code);
    }

    return Array.from(codes).sort();
  };

  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      const userId = params?.[0] as string;

      if (s.includes("FROM teams t") && s.includes("rop_user_id")) {
        if (userId === ROP_X) return { rows: [{ team_id: TEAM_X }] };
        if (userId === ROP_Y) return { rows: [{ team_id: TEAM_Y }] };
        return { rows: [] };
      }

      if (s.includes("FROM user_team_memberships WHERE user_id") && !s.includes("team_id IN")) {
        return { rows: ropTeamIds.map((team_id) => ({ team_id })) };
      }

      if (s.includes("client_assignments WHERE responsible_user_id")) {
        const own = opts.ownCodesByRop?.[userId] ?? [];
        return { rows: own.map((client_code) => ({ client_code })) };
      }

      if (s.includes("rop_team_codes") || (s.includes("d_ov.rop_id = $1") && s.includes("UNION"))) {
        const teamIds = (params?.[1] as string[]) ?? [];
        return {
          rows: resolveRopTeamCodes(userId, teamIds).map((client_code) => ({ client_code })),
        };
      }

      if (s.includes("d_ov.rop_id = $1") && s.includes("upper(d.release_code)")) {
        return {
          rows: resolveRopTeamCodes(userId, []).map((client_code) => ({ client_code })),
        };
      }

      if (s.includes("rop_client_grants")) {
        return { rows: [] };
      }

      if (s.includes("dealer_overrides") && s.includes("regional_manager_id")) {
        return { rows: [] };
      }

      void params;
      return { rows: [] };
    },
  } as PoolLike;
}

describe("db-scope-formula rop teamCodes via live rop_id", () => {
  const baselineAssignments: TeamAssignment[] = [
    { client_code: "MA-OWN-01", team_id: TEAM_X },
    { client_code: "MA-OWN-02", team_id: TEAM_X },
    { client_code: "MA-EMPTY-01", team_id: TEAM_X },
  ];

  const baselineDealerRops: DealerRop[] = [
    { client_code: "MA-OWN-01", rop_id: ROP_X },
    { client_code: "MA-OWN-02", rop_id: ROP_X },
    { client_code: "MA-EMPTY-01", rop_id: null },
  ];

  it("regression: ROP with rop_id=self or empty sees same teamCodes as team_id-only baseline", async () => {
    const pool = makePool({
      teamAssignments: baselineAssignments,
      dealerRops: baselineDealerRops,
    });
    const meta = await resolveScopeCodesMeta(pool, ROP_X, "rop");
    expect(meta.teamCodes).toEqual(["MA-EMPTY-01", "MA-OWN-01", "MA-OWN-02"]);
  });

  it("transferred client: team_id of ROP-X but rop_id=ROP-Y → visible only for Y", async () => {
    const pool = makePool({
      teamAssignments: [
        { client_code: "MA-TRANSFER", team_id: TEAM_X },
        { client_code: "MA-TRANSFER", team_id: TEAM_Y },
      ],
      dealerRops: [{ client_code: "MA-TRANSFER", rop_id: ROP_Y }],
    });

    const metaX = await resolveScopeCodesMeta(pool, ROP_X, "rop");
    const metaY = await resolveScopeCodesMeta(pool, ROP_Y, "rop");

    expect(metaX.teamCodes).not.toContain("MA-TRANSFER");
    expect(metaY.teamCodes).toContain("MA-TRANSFER");
  });

  it("empty rop_id: team_id fallback keeps client with ROP-X", async () => {
    const pool = makePool({
      teamAssignments: [{ client_code: "MA-FALLBACK", team_id: TEAM_X }],
      dealerRops: [{ client_code: "MA-FALLBACK", rop_id: null }],
    });
    const meta = await resolveScopeCodesMeta(pool, ROP_X, "rop");
    expect(meta.teamCodes).toEqual(["MA-FALLBACK"]);
  });

  it("no duplication: client with non-empty rop_id appears for exactly one ROP", async () => {
    const pool = makePool({
      teamAssignments: [
        { client_code: "MA-SINGLE", team_id: TEAM_X },
        { client_code: "MA-SINGLE", team_id: TEAM_Y },
      ],
      dealerRops: [{ client_code: "MA-SINGLE", rop_id: ROP_Y }],
    });

    const metaX = await resolveScopeCodesMeta(pool, ROP_X, "rop");
    const metaY = await resolveScopeCodesMeta(pool, ROP_Y, "rop");

    expect(metaX.teamCodes.filter((c) => c === "MA-SINGLE")).toEqual([]);
    expect(metaY.teamCodes.filter((c) => c === "MA-SINGLE")).toEqual(["MA-SINGLE"]);
  });

  it("Yakubova data-fix scenario: skalaban vs kupyanskiy cities by rop_id", async () => {
    const SKALABAN = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";
    const KUPYANSKIY = "ccffcf6e-2505-4eee-b257-ac65b60bb779";
    const yakubovaTeam = TEAM_X;

    const assignments: TeamAssignment[] = [
      { client_code: "MA-VORONEZH", team_id: yakubovaTeam },
      { client_code: "MA-LIPETSK", team_id: yakubovaTeam },
      { client_code: "MA-PRIMORSK", team_id: yakubovaTeam },
      { client_code: "MA-TELMANOVO", team_id: yakubovaTeam },
      { client_code: "MA-SEVASTOPOL", team_id: yakubovaTeam },
    ];

    const dealerRops: DealerRop[] = [
      { client_code: "MA-VORONEZH", rop_id: SKALABAN },
      { client_code: "MA-LIPETSK", rop_id: SKALABAN },
      { client_code: "MA-PRIMORSK", rop_id: KUPYANSKIY },
      { client_code: "MA-TELMANOVO", rop_id: KUPYANSKIY },
      { client_code: "MA-SEVASTOPOL", rop_id: KUPYANSKIY },
    ];

    const poolSkalaban = makePool({
      teamAssignments: assignments,
      dealerRops,
      ropTeamIds: [yakubovaTeam],
    });
    const poolKupyanskiy = makePool({
      teamAssignments: assignments,
      dealerRops,
      ropTeamIds: [yakubovaTeam],
    });

    const skalabanMeta = await resolveScopeCodesMeta(poolSkalaban, SKALABAN, "rop");
    const kupyanskiyMeta = await resolveScopeCodesMeta(poolKupyanskiy, KUPYANSKIY, "rop");

    expect(skalabanMeta.teamCodes).toEqual(["MA-LIPETSK", "MA-VORONEZH"]);
    expect(kupyanskiyMeta.teamCodes).toEqual(["MA-PRIMORSK", "MA-SEVASTOPOL", "MA-TELMANOVO"]);
  });
});
