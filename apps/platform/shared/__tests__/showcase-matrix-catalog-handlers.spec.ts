import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { PoolLike } from "../../server/db/neon-client.js";
import {
  assertMatrixDefEffectiveDates,
  compareMatrixDefTieBreak,
  isMatrixDefEffectiveOnDate,
  normalizeMatrixDefScope,
  normalizeScopeName,
  parseMatrixDefUpsertInput,
  pickResolvedMatrixDef,
  replaceMatrixDefModels,
  resolveActiveMatrixDef,
  ShowcaseMatrixCatalogValidationError,
  upsertMatrixDef,
  type ShowcaseMatrixCatalogActor,
  type ShowcaseMatrixDefDto,
  type ShowcaseMatrixDefModelInput,
} from "../showcase-matrix-catalog-handlers.js";

const ACTOR: ShowcaseMatrixCatalogActor = {
  id: "00000000-0000-4000-8000-000000000001",
  role: "admin",
  status: "active",
  fullName: "Test Admin",
};

type DefRow = Record<string, unknown>;
type ModelRow = Record<string, unknown>;

function makeDef(partial: Partial<ShowcaseMatrixDefDto> & Pick<ShowcaseMatrixDefDto, "id">): ShowcaseMatrixDefDto {
  return {
    clientCategory: "top150",
    scopeKind: "global",
    scopeRegion: null,
    scopeCity: null,
    effectiveFrom: null,
    effectiveTo: null,
    seasonLabel: null,
    status: "published",
    title: null,
    comment: null,
    clientOpId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    updatedBy: null,
    updatedByName: null,
    ...partial,
  };
}

class InMemoryMatrixCatalogDb implements PoolLike {
  defs = new Map<string, DefRow>();
  models = new Map<string, ModelRow>();

  query<T = Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
  ): Promise<{ rows: T[]; rowCount?: number }> {
    const sql = text.trim();

    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return Promise.resolve({ rows: [], rowCount: 0 });
    }

    if (sql.startsWith("SELECT * FROM showcase_matrix_defs WHERE client_op_id")) {
      const opId = params[0] as string;
      const row = [...this.defs.values()].find((d) => d.client_op_id === opId);
      return Promise.resolve({ rows: row ? [row as T] : [] });
    }

    if (sql.startsWith("SELECT * FROM showcase_matrix_defs WHERE id")) {
      const id = params[0] as string;
      const row = this.defs.get(id);
      return Promise.resolve({ rows: row ? [row as T] : [] });
    }

    if (sql.startsWith("SELECT * FROM showcase_matrix_defs")) {
      let rows = [...this.defs.values()];
      if (sql.includes("status = 'published'")) {
        const category = params[0] as string;
        const onDate = params[1] as string;
        rows = rows.filter((r) => {
          if (r.status !== "published") return false;
          if (r.client_category !== category) return false;
          const from = r.effective_from as string | null;
          const to = r.effective_to as string | null;
          if (from && onDate < from) return false;
          if (to && onDate > to) return false;
          return true;
        });
      }
      return Promise.resolve({ rows: rows as T[] });
    }

    if (sql.startsWith("SELECT * FROM showcase_matrix_def_models WHERE def_id")) {
      const defId = params[0] as string;
      const rows = [...this.models.values()]
        .filter((m) => m.def_id === defId)
        .sort((a, b) => {
          const so = Number(a.sort_order) - Number(b.sort_order);
          if (so !== 0) return so;
          return String(a.id).localeCompare(String(b.id));
        });
      return Promise.resolve({ rows: rows as T[] });
    }

    if (sql.startsWith("INSERT INTO showcase_matrix_defs")) {
      const id = randomUUID();
      const row: DefRow = {
        id,
        client_category: params[0],
        scope_kind: params[1],
        scope_region: params[2],
        scope_city: params[3],
        effective_from: params[4],
        effective_to: params[5],
        season_label: params[6],
        status: params[7],
        title: params[8],
        comment: params[9],
        client_op_id: params[10],
        created_at: "2026-05-01T12:00:00.000Z",
        updated_at: "2026-05-01T12:00:00.000Z",
        updated_by: params[11],
        updated_by_name: params[12],
      };
      this.defs.set(id, row);
      return Promise.resolve({ rows: [row as T], rowCount: 1 });
    }

    if (sql.startsWith("UPDATE showcase_matrix_defs SET")) {
      const id = params[0] as string;
      const prev = this.defs.get(id);
      if (!prev) return Promise.resolve({ rows: [] });
      const row: DefRow = {
        ...prev,
        client_category: params[1],
        scope_kind: params[2],
        scope_region: params[3],
        scope_city: params[4],
        effective_from: params[5],
        effective_to: params[6],
        season_label: params[7],
        status: params[8],
        title: params[9],
        comment: params[10],
        client_op_id: params[11] ?? prev.client_op_id,
        updated_at: "2026-05-02T12:00:00.000Z",
        updated_by: params[12],
        updated_by_name: params[13],
      };
      this.defs.set(id, row);
      return Promise.resolve({ rows: [row as T], rowCount: 1 });
    }

    if (sql.startsWith("DELETE FROM showcase_matrix_def_models WHERE def_id")) {
      const defId = params[0] as string;
      let count = 0;
      for (const [id, m] of this.models) {
        if (m.def_id === defId) {
          this.models.delete(id);
          count += 1;
        }
      }
      return Promise.resolve({ rows: [], rowCount: count });
    }

    if (sql.startsWith("INSERT INTO showcase_matrix_def_models")) {
      const id = randomUUID();
      const row: ModelRow = {
        id,
        def_id: params[0],
        target_kind: params[1],
        target_id: params[2],
        priority: params[3],
        segment: params[4],
        value_weight: params[5],
        sort_order: params[6],
        catalog_1c_id: params[7] ?? null,
        created_at: "2026-05-01T12:00:00.000Z",
        updated_at: "2026-05-01T12:00:00.000Z",
      };
      const dup = [...this.models.values()].find(
        (m) =>
          m.def_id === row.def_id &&
          m.target_kind === row.target_kind &&
          m.target_id === row.target_id,
      );
      if (dup && !sql.includes("ON CONFLICT")) {
        return Promise.reject(new Error("duplicate key value violates unique constraint"));
      }
      this.models.set(id, row);
      return Promise.resolve({ rows: [row as T], rowCount: 1 });
    }

    return Promise.reject(new Error(`Unhandled SQL in test mock: ${sql.slice(0, 80)}`));
  }
}

describe("normalizeScopeName", () => {
  it("trims, collapses spaces, lowercases for comparison", () => {
    expect(normalizeScopeName("  Москва  ")).toBe("москва");
    expect(normalizeScopeName("Санкт   Петербург")).toBe("санкт петербург");
  });
});

describe("normalizeMatrixDefScope validation", () => {
  it("requires NULL region/city for global", () => {
    expect(() =>
      normalizeMatrixDefScope({ scopeKind: "global", scopeRegion: "москва" }),
    ).toThrow(ShowcaseMatrixCatalogValidationError);
  });

  it("requires region for region scope", () => {
    expect(() => normalizeMatrixDefScope({ scopeKind: "region" })).toThrow(
      ShowcaseMatrixCatalogValidationError,
    );
    const r = normalizeMatrixDefScope({ scopeKind: "region", scopeRegion: "Москва" });
    expect(r.scopeRegion).toBe("москва");
    expect(r.scopeCity).toBeNull();
  });

  it("requires region and city for city scope", () => {
    const c = normalizeMatrixDefScope({
      scopeKind: "city",
      scopeRegion: "Московская область",
      scopeCity: "Москва",
    });
    expect(c.scopeRegion).toBe("московская область");
    expect(c.scopeCity).toBe("москва");
  });
});

describe("parseMatrixDefUpsertInput", () => {
  it("rejects invalid client_category and date range", () => {
    expect(() =>
      parseMatrixDefUpsertInput({
        clientCategory: "invalid",
        scopeKind: "global",
      }),
    ).toThrow(ShowcaseMatrixCatalogValidationError);

    expect(() =>
      parseMatrixDefUpsertInput({
        clientCategory: "top150",
        scopeKind: "global",
        effectiveFrom: "2026-12-01",
        effectiveTo: "2026-01-01",
      }),
    ).toThrow(ShowcaseMatrixCatalogValidationError);
  });

  it("accepts valid global def", () => {
    const parsed = parseMatrixDefUpsertInput({
      clientCategory: "top350",
      scopeKind: "global",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-12-31",
      status: "draft",
    });
    expect(parsed.clientCategory).toBe("top350");
    expect(parsed.scopeRegion).toBeNull();
    assertMatrixDefEffectiveDates(parsed.effectiveFrom ?? null, parsed.effectiveTo ?? null);
  });
});

describe("upsertMatrixDef access", () => {
  it("allows category_manager to upsert matrix defs", async () => {
    const pool = new InMemoryMatrixCatalogDb();
    const actor: ShowcaseMatrixCatalogActor = {
      id: "00000000-0000-4000-8000-000000000002",
      role: "category_manager",
      status: "active",
      fullName: "Категорийный менеджер",
    };
    const { def } = await upsertMatrixDef(pool, actor, {
      clientCategory: "top150",
      scopeKind: "global",
    });
    expect(def.id).toBeTruthy();
    expect(def.clientCategory).toBe("top150");
  });
});

describe("pickResolvedMatrixDef", () => {
  const globalDef = makeDef({ id: "g1", scopeKind: "global" });
  const regionDef = makeDef({
    id: "r1",
    scopeKind: "region",
    scopeRegion: "московская область",
  });
  const cityDef = makeDef({
    id: "c1",
    scopeKind: "city",
    scopeRegion: "московская область",
    scopeCity: "москва",
  });

  it("falls back city → region → global", () => {
    const all = [globalDef, regionDef, cityDef];
    expect(
      pickResolvedMatrixDef(all, {
        region: "Московская  область",
        city: "Москва",
      })?.id,
    ).toBe("c1");

    expect(
      pickResolvedMatrixDef(all, {
        region: "Московская область",
        city: null,
      })?.id,
    ).toBe("r1");

    expect(pickResolvedMatrixDef(all, { region: null, city: null })?.id).toBe("g1");
  });

  it("matches region/city case-insensitively", () => {
    expect(
      pickResolvedMatrixDef([cityDef], { region: "МОСКОВСКАЯ ОБЛАСТЬ", city: "москва" })?.id,
    ).toBe("c1");
  });
});

describe("isMatrixDefEffectiveOnDate and tie-break", () => {
  it("filters by inclusive period with open NULL bounds", () => {
    const def = makeDef({
      id: "d1",
      effectiveFrom: "2026-03-01",
      effectiveTo: "2026-03-31",
    });
    expect(isMatrixDefEffectiveOnDate(def, "2026-02-28")).toBe(false);
    expect(isMatrixDefEffectiveOnDate(def, "2026-03-15")).toBe(true);
    expect(isMatrixDefEffectiveOnDate(def, "2026-04-01")).toBe(false);
    expect(isMatrixDefEffectiveOnDate(makeDef({ id: "d2", effectiveFrom: null, effectiveTo: null }), "2026-01-01")).toBe(
      true,
    );
  });

  it("prefers later effective_from, then updated_at, then id", () => {
    const older = makeDef({
      id: "aaa",
      effectiveFrom: "2026-01-01",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const newer = makeDef({
      id: "bbb",
      effectiveFrom: "2026-06-01",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const sorted = [older, newer].sort(compareMatrixDefTieBreak);
    expect(sorted[0]?.id).toBe("bbb");

    const nullFrom = makeDef({ id: "ccc", effectiveFrom: null, updatedAt: "2026-02-01T00:00:00.000Z" });
    const withFrom = makeDef({ id: "ddd", effectiveFrom: "2026-03-01", updatedAt: "2026-01-01T00:00:00.000Z" });
    expect([nullFrom, withFrom].sort(compareMatrixDefTieBreak)[0]?.id).toBe("ddd");
  });
});

describe("resolveActiveMatrixDef", () => {
  it("returns most specific published matrix for date", async () => {
    const pool = new InMemoryMatrixCatalogDb();
    pool.defs.set(
      "global-id",
      {
        id: "global-id",
        client_category: "top150",
        scope_kind: "global",
        scope_region: null,
        scope_city: null,
        effective_from: null,
        effective_to: null,
        status: "published",
        season_label: null,
        title: null,
        comment: null,
        client_op_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        updated_by: null,
        updated_by_name: null,
      },
    );
    pool.defs.set(
      "city-id",
      {
        id: "city-id",
        client_category: "top150",
        scope_kind: "city",
        scope_region: "московская область",
        scope_city: "москва",
        effective_from: "2026-01-01",
        effective_to: null,
        status: "published",
        season_label: null,
        title: null,
        comment: null,
        client_op_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-02-01T00:00:00.000Z",
        updated_by: null,
        updated_by_name: null,
      },
    );
    pool.models.set("m1", {
      id: "m1",
      def_id: "city-id",
      target_kind: "model",
      target_id: "sku-1",
      priority: "high",
      segment: "vh",
      value_weight: 10,
      sort_order: 0,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const resolved = await resolveActiveMatrixDef(pool, {
      clientCategory: "top150",
      region: "Московская область",
      city: "Москва",
      onDate: "2026-05-15",
    });
    expect(resolved?.id).toBe("city-id");
    expect(resolved?.models).toHaveLength(1);
    expect(resolved?.models[0]?.targetId).toBe("sku-1");
  });

  it("returns null when no published matrix matches date", async () => {
    const pool = new InMemoryMatrixCatalogDb();
    pool.defs.set("draft-id", {
      id: "draft-id",
      client_category: "top150",
      scope_kind: "global",
      scope_region: null,
      scope_city: null,
      effective_from: null,
      effective_to: null,
      status: "draft",
      season_label: null,
      title: null,
      comment: null,
      client_op_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      updated_by: null,
      updated_by_name: null,
    });

    const resolved = await resolveActiveMatrixDef(pool, {
      clientCategory: "top150",
      region: null,
      city: null,
      onDate: "2026-05-15",
    });
    expect(resolved).toBeNull();
  });
});

describe("replaceMatrixDefModels", () => {
  it("replaces composition transactionally and enforces unique targets", async () => {
    const pool = new InMemoryMatrixCatalogDb();
    const { def } = await upsertMatrixDef(pool, ACTOR, {
      clientCategory: "top500",
      scopeKind: "global",
    });

    const models: ShowcaseMatrixDefModelInput[] = [
      { targetKind: "model", targetId: "a", segment: "vh", priority: "high", sortOrder: 0 },
      { targetKind: "variant", targetId: "b", segment: "mk", sortOrder: 1, valueWeight: 50 },
    ];
    const inserted = await replaceMatrixDefModels(pool, def.id, models, ACTOR);
    expect(inserted).toHaveLength(2);

    const replaced = await replaceMatrixDefModels(
      pool,
      def.id,
      [{ targetKind: "model", targetId: "c", segment: "hardware" }],
      ACTOR,
    );
    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.targetId).toBe("c");
    expect([...pool.models.values()].filter((m) => m.def_id === def.id)).toHaveLength(1);

    await expect(
      replaceMatrixDefModels(
        pool,
        def.id,
        [
          { targetKind: "model", targetId: "x", segment: "vh" },
          { targetKind: "model", targetId: "x", segment: "mk" },
        ],
        ACTOR,
      ),
    ).rejects.toThrow(ShowcaseMatrixCatalogValidationError);
  });
});
