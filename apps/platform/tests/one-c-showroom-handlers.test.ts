import { describe, expect, it } from "vitest";
import { nameMatches, normalizeName } from "../shared/one-c-name-matching.js";
import {
  buildHierarchy,
  type LegalIndexRow,
  type LkUserRow,
  type OneCShowroomContext,
  type StoreIndexRow,
  type TeamRow,
} from "../shared/one-c-showroom-context.js";
import type { PoolLike } from "../server/db/neon-client.js";
import { countStoresForManagerNames } from "../shared/one-c-showroom-handlers.js";

describe("one-c-name-matching", () => {
  it("matches subset tokens (Скалабан Александр)", () => {
    expect(nameMatches("Скалабан Александр", "Скалабан Александр Александрович")).toBe(true);
  });

  it("matches ё/е (Богачёв vs Богачев)", () => {
    expect(nameMatches("Богачёв Денис Николаевич", "Богачев Денис Николаевич")).toBe(true);
  });

  it("rejects unrelated names", () => {
    expect(nameMatches("Иванов И.И.", "Петров Петр Петрович")).toBe(false);
  });

  it("rejects empty user name", () => {
    expect(nameMatches("", "Иванов")).toBe(false);
    expect(normalizeName(null)).toBe("");
  });
});

function makeCtx(overrides?: Partial<OneCShowroomContext>): OneCShowroomContext {
  const team1 = "team-1";
  const ropId = "rop-1";
  const rm1Id = "rm-1";
  const mgr1Id = "mgr-1";

  const users: LkUserRow[] = [
    {
      id: ropId,
      full_name: "Скалабан Александр",
      phone: null,
      email: null,
      role: "rop",
      role_in_team: "rop",
      team_id: team1,
    },
    {
      id: rm1Id,
      full_name: "Богачёв Денис Николаевич",
      phone: null,
      email: null,
      role: "regional_manager",
      role_in_team: "regional_manager",
      team_id: team1,
    },
    {
      id: mgr1Id,
      full_name: "Илюченко Александр Николаевич",
      phone: null,
      email: null,
      role: "manager",
      role_in_team: "manager",
      team_id: team1,
    },
  ];

  const teams: TeamRow[] = [{ id: team1, name: "Скалабан", rop_user_id: ropId }];
  const legals: LegalIndexRow[] = [
    {
      id_1c: "legal-1",
      regional_manager_name: "Богачев Денис Николаевич",
      responsible_manager_name: "Илюченко Александр Николаевич",
    },
    {
      id_1c: "legal-2",
      regional_manager_name: "Богачев Денис Николаевич",
      responsible_manager_name: "Илюченко Александр Николаевич",
    },
  ];
  const stores: StoreIndexRow[] = [
    { id_1c: "store-1", legal_entity_1c: "legal-1" },
    { id_1c: "store-2", legal_entity_1c: "legal-2" },
  ];

  const usersById = new Map(users.map((u) => [u.id, u]));
  const membershipsByTeam = new Map([[team1, users]]);
  const legalById = new Map(legals.map((l) => [l.id_1c, l]));

  const matchedRegionalByUserId = new Map([[rm1Id, ["Богачев Денис Николаевич"]]]);
  const matchedResponsibleByUserId = new Map([[mgr1Id, ["Илюченко Александр Николаевич"]]]);

  return {
    teams,
    usersById,
    membershipsByTeam,
    regionalNames: ["Богачев Денис Николаевич"],
    responsibleNames: ["Илюченко Александр Николаевич"],
    matchedRegionalByUserId,
    matchedResponsibleByUserId,
    userIdByRegionalName: new Map([["Богачев Денис Николаевич", rm1Id]]),
    userIdByResponsibleName: new Map([["Илюченко Александр Николаевич", mgr1Id]]),
    activeManagerMatchedNames: ["Илюченко Александр Николаевич"],
    activeRmMatchedNames: ["Богачев Денис Николаевич"],
    activeFilterNames: ["Илюченко Александр Николаевич", "Богачев Денис Николаевич"],
    legalById,
    storeRows: stores,
    storesTotal: 2,
    legalsTotal: 2,
    last_imported_at: null,
    ...overrides,
  };
}

describe("one-c hierarchy", () => {
  it("builds tree with store counts", () => {
    const tree = buildHierarchy(makeCtx());
    expect(tree).toHaveLength(1);
    expect(tree[0]?.fullName).toBe("Скалабан Александр");
    expect(tree[0]?.storeCount).toBe(2);
    expect(tree[0]?.rms).toHaveLength(1);
    expect(tree[0]?.rms[0]?.storeCount).toBe(2);
    expect(tree[0]?.rms[0]?.managers).toEqual([]);
    expect(tree[0]?.managers).toHaveLength(1);
    expect(tree[0]?.managers[0]?.storeCount).toBe(2);
  });
});

describe("manager stores query", () => {
  it("counts stores by responsible_manager_name", async () => {
    const pool: PoolLike = {
      query: async (sql: string) => {
        if (sql.includes("COUNT(*)")) {
          return { rows: [{ n: 2 }] };
        }
        return { rows: [] };
      },
    };
    const n = await countStoresForManagerNames(pool, ["Илюченко Александр Николаевич"]);
    expect(n).toBe(2);
  });
});
