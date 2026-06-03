/**
 * Справочник управляемых матриц моделей на витрину — Промт 159.
 * Отдельно от `showcase_matrix_entries` (статусы позиций по торговой точке).
 */

import type { PoolLike } from "./admin/admin-auth.js";
import { canManageShowcaseMatrixCatalogServer } from "./showcase-matrix-catalog-access.js";

/** Синхронизировать с `ClientCategoryId` в `client/src/lib/client-category.ts`. */
export type ShowcaseMatrixCatalogClientCategory =
  | "new_client"
  | "top150"
  | "top350"
  | "top500"
  | "top500plus";

export type ShowcaseMatrixCatalogScopeKind = "global" | "region" | "city";
export type ShowcaseMatrixCatalogStatus = "draft" | "published" | "archived";
export type ShowcaseMatrixCatalogTargetKind = "model" | "variant";
export type ShowcaseMatrixCatalogPriority = "high" | "medium" | "low";
export type ShowcaseMatrixCatalogSegment = "vh" | "mk" | "hardware";

const CLIENT_CATEGORIES = new Set<ShowcaseMatrixCatalogClientCategory>([
  "new_client",
  "top150",
  "top350",
  "top500",
  "top500plus",
]);
const SCOPE_KINDS = new Set<ShowcaseMatrixCatalogScopeKind>(["global", "region", "city"]);
const DEF_STATUSES = new Set<ShowcaseMatrixCatalogStatus>(["draft", "published", "archived"]);
const TARGET_KINDS = new Set<ShowcaseMatrixCatalogTargetKind>(["model", "variant"]);
const PRIORITIES = new Set<ShowcaseMatrixCatalogPriority>(["high", "medium", "low"]);
const SEGMENTS = new Set<ShowcaseMatrixCatalogSegment>(["vh", "mk", "hardware"]);

export type ShowcaseMatrixCatalogActor = {
  id: string;
  role: string;
  status: string;
  fullName: string;
};

export type ShowcaseMatrixDefDto = {
  id: string;
  clientCategory: ShowcaseMatrixCatalogClientCategory;
  scopeKind: ShowcaseMatrixCatalogScopeKind;
  scopeRegion: string | null;
  scopeCity: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  seasonLabel: string | null;
  status: ShowcaseMatrixCatalogStatus;
  title: string | null;
  comment: string | null;
  clientOpId: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  updatedByName: string | null;
};

export type ShowcaseMatrixDefModelDto = {
  id: string;
  defId: string;
  targetKind: ShowcaseMatrixCatalogTargetKind;
  targetId: string;
  priority: ShowcaseMatrixCatalogPriority;
  segment: ShowcaseMatrixCatalogSegment;
  valueWeight: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ShowcaseMatrixDefWithModelsDto = ShowcaseMatrixDefDto & {
  models: ShowcaseMatrixDefModelDto[];
};

export type ShowcaseMatrixDefListFilter = {
  clientCategory?: ShowcaseMatrixCatalogClientCategory;
  scopeKind?: ShowcaseMatrixCatalogScopeKind;
  status?: ShowcaseMatrixCatalogStatus;
  region?: string;
  city?: string;
};

export type ShowcaseMatrixDefUpsertInput = {
  id?: string;
  clientCategory: ShowcaseMatrixCatalogClientCategory;
  scopeKind: ShowcaseMatrixCatalogScopeKind;
  scopeRegion?: string | null;
  scopeCity?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  seasonLabel?: string | null;
  status?: ShowcaseMatrixCatalogStatus;
  title?: string | null;
  comment?: string | null;
  clientOpId?: string | null;
};

export type ShowcaseMatrixDefModelInput = {
  id?: string;
  targetKind: ShowcaseMatrixCatalogTargetKind;
  targetId: string;
  priority?: ShowcaseMatrixCatalogPriority;
  segment: ShowcaseMatrixCatalogSegment;
  valueWeight?: number | null;
  sortOrder?: number;
};

export type ShowcaseMatrixCatalogBatchOp =
  | { op: "upsertDef"; clientOpId?: string; def: ShowcaseMatrixDefUpsertInput }
  | { op: "deleteDef"; id: string; clientOpId?: string }
  | { op: "setDefStatus"; id: string; status: ShowcaseMatrixCatalogStatus; clientOpId?: string }
  | { op: "replaceModels"; defId: string; models: ShowcaseMatrixDefModelInput[]; clientOpId?: string }
  | { op: "upsertModel"; defId: string; model: ShowcaseMatrixDefModelInput; clientOpId?: string }
  | { op: "deleteModel"; id: string; clientOpId?: string };

export class ShowcaseMatrixCatalogValidationError extends Error {
  readonly code = "VALIDATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "ShowcaseMatrixCatalogValidationError";
  }
}

/** Нормализация названия региона/города для хранения и сравнения (регистронезависимо). */
export function normalizeScopeName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (!collapsed) return null;
  return collapsed.toLocaleLowerCase("ru");
}

function trimStr(raw: unknown, field: string): string {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new ShowcaseMatrixCatalogValidationError(`Укажите ${field}.`);
  }
  return raw.trim();
}

function parseClientCategory(raw: unknown): ShowcaseMatrixCatalogClientCategory {
  const v = trimStr(raw, "clientCategory");
  if (!CLIENT_CATEGORIES.has(v as ShowcaseMatrixCatalogClientCategory)) {
    throw new ShowcaseMatrixCatalogValidationError("Некорректный clientCategory.");
  }
  return v as ShowcaseMatrixCatalogClientCategory;
}

function parseScopeKind(raw: unknown): ShowcaseMatrixCatalogScopeKind {
  const v = trimStr(raw, "scopeKind");
  if (!SCOPE_KINDS.has(v as ShowcaseMatrixCatalogScopeKind)) {
    throw new ShowcaseMatrixCatalogValidationError("Некорректный scopeKind.");
  }
  return v as ShowcaseMatrixCatalogScopeKind;
}

function parseDefStatus(raw: unknown, fallback: ShowcaseMatrixCatalogStatus = "draft"): ShowcaseMatrixCatalogStatus {
  if (raw == null || raw === "") return fallback;
  const v = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (!DEF_STATUSES.has(v as ShowcaseMatrixCatalogStatus)) {
    throw new ShowcaseMatrixCatalogValidationError("Некорректный status.");
  }
  return v as ShowcaseMatrixCatalogStatus;
}

function parseOptionalDate(raw: unknown, field: string): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") {
    throw new ShowcaseMatrixCatalogValidationError(`Некорректный ${field}.`);
  }
  const t = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    throw new ShowcaseMatrixCatalogValidationError(`Некорректный ${field} (ожидается YYYY-MM-DD).`);
  }
  return t;
}

function parseOptionalText(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") {
    throw new ShowcaseMatrixCatalogValidationError("Некорректное текстовое поле.");
  }
  const t = raw.trim();
  return t || null;
}

function parseTargetKind(raw: unknown): ShowcaseMatrixCatalogTargetKind {
  const v = trimStr(raw, "targetKind");
  if (!TARGET_KINDS.has(v as ShowcaseMatrixCatalogTargetKind)) {
    throw new ShowcaseMatrixCatalogValidationError("Некорректный targetKind.");
  }
  return v as ShowcaseMatrixCatalogTargetKind;
}

function parsePriority(raw: unknown): ShowcaseMatrixCatalogPriority {
  if (raw == null || raw === "") return "medium";
  const v = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (!PRIORITIES.has(v as ShowcaseMatrixCatalogPriority)) {
    throw new ShowcaseMatrixCatalogValidationError("Некорректный priority.");
  }
  return v as ShowcaseMatrixCatalogPriority;
}

function parseSegment(raw: unknown): ShowcaseMatrixCatalogSegment {
  const v = trimStr(raw, "segment");
  if (!SEGMENTS.has(v as ShowcaseMatrixCatalogSegment)) {
    throw new ShowcaseMatrixCatalogValidationError("Некорректный segment.");
  }
  return v as ShowcaseMatrixCatalogSegment;
}

function parseSortOrder(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  let n: number;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string" && raw.trim() !== "") n = Number(raw.trim());
  else throw new ShowcaseMatrixCatalogValidationError("Некорректный sortOrder.");
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new ShowcaseMatrixCatalogValidationError("Некорректный sortOrder.");
  }
  return n;
}

function parseOptionalValueWeight(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  let n: number;
  if (typeof raw === "number") n = raw;
  else if (typeof raw === "string" && raw.trim() !== "") n = Number(raw.trim());
  else throw new ShowcaseMatrixCatalogValidationError("Некорректный valueWeight.");
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 100) {
    throw new ShowcaseMatrixCatalogValidationError("valueWeight должен быть целым от 1 до 100.");
  }
  return n;
}

export type NormalizedMatrixDefScope = {
  scopeKind: ShowcaseMatrixCatalogScopeKind;
  scopeRegion: string | null;
  scopeCity: string | null;
};

/** Правила NULL для области действия (global / region / city). */
export function normalizeMatrixDefScope(input: {
  scopeKind: ShowcaseMatrixCatalogScopeKind;
  scopeRegion?: string | null;
  scopeCity?: string | null;
}): NormalizedMatrixDefScope {
  const scopeKind = input.scopeKind;
  const rawRegion = input.scopeRegion ?? null;
  const rawCity = input.scopeCity ?? null;

  if (scopeKind === "global") {
    if (rawRegion != null && String(rawRegion).trim()) {
      throw new ShowcaseMatrixCatalogValidationError("Для global scope_region должен быть пустым.");
    }
    if (rawCity != null && String(rawCity).trim()) {
      throw new ShowcaseMatrixCatalogValidationError("Для global scope_city должен быть пустым.");
    }
    return { scopeKind, scopeRegion: null, scopeCity: null };
  }

  if (scopeKind === "region") {
    const scopeRegion = normalizeScopeName(typeof rawRegion === "string" ? rawRegion : null);
    if (!scopeRegion) {
      throw new ShowcaseMatrixCatalogValidationError("Для region укажите scope_region.");
    }
    if (rawCity != null && String(rawCity).trim()) {
      throw new ShowcaseMatrixCatalogValidationError("Для region scope_city должен быть пустым.");
    }
    return { scopeKind, scopeRegion, scopeCity: null };
  }

  const scopeRegion = normalizeScopeName(typeof rawRegion === "string" ? rawRegion : null);
  const scopeCity = normalizeScopeName(typeof rawCity === "string" ? rawCity : null);
  if (!scopeRegion || !scopeCity) {
    throw new ShowcaseMatrixCatalogValidationError("Для city укажите scope_region и scope_city.");
  }
  return { scopeKind, scopeRegion, scopeCity };
}

export function assertMatrixDefEffectiveDates(
  effectiveFrom: string | null,
  effectiveTo: string | null,
): void {
  if (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo) {
    throw new ShowcaseMatrixCatalogValidationError("effective_from не может быть позже effective_to.");
  }
}

export function parseMatrixDefUpsertInput(body: Record<string, unknown>): ShowcaseMatrixDefUpsertInput {
  const scopeKind = parseScopeKind(body.scopeKind);
  const scope = normalizeMatrixDefScope({
    scopeKind,
    scopeRegion: body.scopeRegion as string | null | undefined,
    scopeCity: body.scopeCity as string | null | undefined,
  });
  const effectiveFrom = parseOptionalDate(body.effectiveFrom, "effectiveFrom");
  const effectiveTo = parseOptionalDate(body.effectiveTo, "effectiveTo");
  assertMatrixDefEffectiveDates(effectiveFrom, effectiveTo);

  const idRaw = body.id;
  const id =
    typeof idRaw === "string" && idRaw.trim() ? idRaw.trim() : undefined;

  return {
    id,
    clientCategory: parseClientCategory(body.clientCategory),
    scopeKind: scope.scopeKind,
    scopeRegion: scope.scopeRegion,
    scopeCity: scope.scopeCity,
    effectiveFrom,
    effectiveTo,
    seasonLabel: parseOptionalText(body.seasonLabel),
    status: body.status != null ? parseDefStatus(body.status) : undefined,
    title: parseOptionalText(body.title),
    comment: parseOptionalText(body.comment),
    clientOpId: parseOptionalText(body.clientOpId),
  };
}

export function parseMatrixDefModelInput(body: Record<string, unknown>): ShowcaseMatrixDefModelInput {
  return {
    id: typeof body.id === "string" && body.id.trim() ? body.id.trim() : undefined,
    targetKind: parseTargetKind(body.targetKind),
    targetId: trimStr(body.targetId, "targetId"),
    priority: parsePriority(body.priority),
    segment: parseSegment(body.segment),
    valueWeight: parseOptionalValueWeight(body.valueWeight),
    sortOrder: parseSortOrder(body.sortOrder),
  };
}

function assertCanMutate(actor: ShowcaseMatrixCatalogActor): void {
  if (actor.status !== "active") {
    throw new ShowcaseMatrixCatalogValidationError("Недостаточно прав.");
  }
  // TODO: персональный grant-флаг из БД.
  if (!canManageShowcaseMatrixCatalogServer(actor.role)) {
    throw new ShowcaseMatrixCatalogValidationError("Недостаточно прав.");
  }
}

function mapDefRow(row: Record<string, unknown>): ShowcaseMatrixDefDto {
  return {
    id: String(row.id),
    clientCategory: String(row.client_category) as ShowcaseMatrixCatalogClientCategory,
    scopeKind: String(row.scope_kind) as ShowcaseMatrixCatalogScopeKind,
    scopeRegion: row.scope_region != null ? String(row.scope_region) : null,
    scopeCity: row.scope_city != null ? String(row.scope_city) : null,
    effectiveFrom: row.effective_from != null ? String(row.effective_from).slice(0, 10) : null,
    effectiveTo: row.effective_to != null ? String(row.effective_to).slice(0, 10) : null,
    seasonLabel: row.season_label != null ? String(row.season_label) : null,
    status: String(row.status) as ShowcaseMatrixCatalogStatus,
    title: row.title != null ? String(row.title) : null,
    comment: row.comment != null ? String(row.comment) : null,
    clientOpId: row.client_op_id != null ? String(row.client_op_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    updatedBy: row.updated_by != null ? String(row.updated_by) : null,
    updatedByName: row.updated_by_name != null ? String(row.updated_by_name) : null,
  };
}

function mapModelRow(row: Record<string, unknown>): ShowcaseMatrixDefModelDto {
  return {
    id: String(row.id),
    defId: String(row.def_id),
    targetKind: String(row.target_kind) as ShowcaseMatrixCatalogTargetKind,
    targetId: String(row.target_id),
    priority: String(row.priority) as ShowcaseMatrixCatalogPriority,
    segment: String(row.segment) as ShowcaseMatrixCatalogSegment,
    valueWeight: row.value_weight != null ? Number(row.value_weight) : null,
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Период матрицы покрывает дату onDate (границы включительны; NULL = без ограничения). */
export function isMatrixDefEffectiveOnDate(
  def: Pick<ShowcaseMatrixDefDto, "effectiveFrom" | "effectiveTo">,
  onDate: string,
): boolean {
  if (def.effectiveFrom && onDate < def.effectiveFrom) return false;
  if (def.effectiveTo && onDate > def.effectiveTo) return false;
  return true;
}

/**
 * Тай-брейк при нескольких версиях на одном уровне области:
 * позже начинающийся effective_from (NULL = самый ранний),
 * затем свежее updated_at, затем id.
 */
export function compareMatrixDefTieBreak(a: ShowcaseMatrixDefDto, b: ShowcaseMatrixDefDto): number {
  const aFrom = a.effectiveFrom;
  const bFrom = b.effectiveFrom;
  if (aFrom !== bFrom) {
    if (!aFrom) return 1;
    if (!bFrom) return -1;
    return bFrom.localeCompare(aFrom);
  }
  const upd = b.updatedAt.localeCompare(a.updatedAt);
  if (upd !== 0) return upd;
  return b.id.localeCompare(a.id);
}

function defMatchesScope(
  def: ShowcaseMatrixDefDto,
  regionNorm: string | null,
  cityNorm: string | null,
): boolean {
  if (def.scopeKind === "global") return true;
  if (def.scopeKind === "region") {
    return regionNorm != null && def.scopeRegion === regionNorm;
  }
  return (
    regionNorm != null &&
    cityNorm != null &&
    def.scopeRegion === regionNorm &&
    def.scopeCity === cityNorm
  );
}

/**
 * Выбор одной матрицы: сначала city, затем region, затем global;
 * внутри уровня — тай-брейк по effective_from / updated_at / id.
 */
export function pickResolvedMatrixDef(
  candidates: ShowcaseMatrixDefDto[],
  params: { region: string | null; city: string | null },
): ShowcaseMatrixDefDto | null {
  const regionNorm = normalizeScopeName(params.region);
  const cityNorm = normalizeScopeName(params.city);

  const levels: ShowcaseMatrixCatalogScopeKind[] = ["city", "region", "global"];
  for (const level of levels) {
    const atLevel = candidates.filter(
      (d) => d.scopeKind === level && defMatchesScope(d, regionNorm, cityNorm),
    );
    if (atLevel.length === 0) continue;
    const sorted = [...atLevel].sort(compareMatrixDefTieBreak);
    return sorted[0] ?? null;
  }
  return null;
}

async function fetchDefByClientOpId(
  pool: PoolLike,
  clientOpId: string,
): Promise<ShowcaseMatrixDefDto | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM showcase_matrix_defs WHERE client_op_id = $1 LIMIT 1`,
    [clientOpId],
  );
  return r.rows[0] ? mapDefRow(r.rows[0]) : null;
}

async function fetchDefById(pool: PoolLike, id: string): Promise<ShowcaseMatrixDefDto | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM showcase_matrix_defs WHERE id = $1::uuid LIMIT 1`,
    [id],
  );
  return r.rows[0] ? mapDefRow(r.rows[0]) : null;
}

async function fetchModelsForDef(pool: PoolLike, defId: string): Promise<ShowcaseMatrixDefModelDto[]> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM showcase_matrix_def_models WHERE def_id = $1::uuid ORDER BY sort_order ASC, id ASC`,
    [defId],
  );
  return r.rows.map(mapModelRow);
}

export async function listMatrixDefs(
  pool: PoolLike,
  filter: ShowcaseMatrixDefListFilter = {},
): Promise<ShowcaseMatrixDefDto[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filter.clientCategory) {
    params.push(filter.clientCategory);
    clauses.push(`client_category = $${params.length}`);
  }
  if (filter.scopeKind) {
    params.push(filter.scopeKind);
    clauses.push(`scope_kind = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    clauses.push(`status = $${params.length}`);
  }
  if (filter.region) {
    const norm = normalizeScopeName(filter.region);
    params.push(norm);
    clauses.push(`scope_region = $${params.length}`);
  }
  if (filter.city) {
    const norm = normalizeScopeName(filter.city);
    params.push(norm);
    clauses.push(`scope_city = $${params.length}`);
  }

  let sql = `SELECT * FROM showcase_matrix_defs`;
  if (clauses.length > 0) {
    sql += ` WHERE ${clauses.join(" AND ")}`;
  }
  sql += ` ORDER BY updated_at DESC, id DESC`;

  const r = await pool.query<Record<string, unknown>>(sql, params);
  return r.rows.map(mapDefRow);
}

export async function getMatrixDef(
  pool: PoolLike,
  id: string,
): Promise<ShowcaseMatrixDefWithModelsDto | null> {
  const def = await fetchDefById(pool, id);
  if (!def) return null;
  const models = await fetchModelsForDef(pool, id);
  return { ...def, models };
}

export async function upsertMatrixDef(
  pool: PoolLike,
  actor: ShowcaseMatrixCatalogActor,
  input: ShowcaseMatrixDefUpsertInput,
): Promise<{ def: ShowcaseMatrixDefDto; idempotent: boolean }> {
  assertCanMutate(actor);

  const clientOpId = input.clientOpId ?? null;
  if (clientOpId) {
    const existing = await fetchDefByClientOpId(pool, clientOpId);
    if (existing) {
      return { def: existing, idempotent: true };
    }
  }

  const status = input.status ?? "draft";
  if (!DEF_STATUSES.has(status)) {
    throw new ShowcaseMatrixCatalogValidationError("Некорректный status.");
  }

  const scope = normalizeMatrixDefScope({
    scopeKind: input.scopeKind,
    scopeRegion: input.scopeRegion,
    scopeCity: input.scopeCity,
  });
  assertMatrixDefEffectiveDates(input.effectiveFrom ?? null, input.effectiveTo ?? null);

  if (input.id) {
    const prev = await fetchDefById(pool, input.id);
    if (!prev) {
      throw new ShowcaseMatrixCatalogValidationError("Матрица не найдена.");
    }
    const r = await pool.query<Record<string, unknown>>(
      `UPDATE showcase_matrix_defs SET
         client_category = $2,
         scope_kind = $3,
         scope_region = $4,
         scope_city = $5,
         effective_from = $6::date,
         effective_to = $7::date,
         season_label = $8,
         status = $9,
         title = $10,
         comment = $11,
         client_op_id = COALESCE($12, client_op_id),
         updated_at = NOW(),
         updated_by = $13::uuid,
         updated_by_name = $14
       WHERE id = $1::uuid
       RETURNING *`,
      [
        input.id,
        input.clientCategory,
        scope.scopeKind,
        scope.scopeRegion,
        scope.scopeCity,
        input.effectiveFrom ?? null,
        input.effectiveTo ?? null,
        input.seasonLabel ?? null,
        status,
        input.title ?? null,
        input.comment ?? null,
        clientOpId,
        actor.id,
        actor.fullName,
      ],
    );
    return { def: mapDefRow(r.rows[0]!), idempotent: false };
  }

  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO showcase_matrix_defs (
       client_category, scope_kind, scope_region, scope_city,
       effective_from, effective_to, season_label, status, title, comment,
       client_op_id, updated_by, updated_by_name
     ) VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $9, $10, $11, $12::uuid, $13)
     RETURNING *`,
    [
      input.clientCategory,
      scope.scopeKind,
      scope.scopeRegion,
      scope.scopeCity,
      input.effectiveFrom ?? null,
      input.effectiveTo ?? null,
      input.seasonLabel ?? null,
      status,
      input.title ?? null,
      input.comment ?? null,
      clientOpId,
      actor.id,
      actor.fullName,
    ],
  );
  return { def: mapDefRow(r.rows[0]!), idempotent: false };
}

export async function setMatrixDefStatus(
  pool: PoolLike,
  id: string,
  status: ShowcaseMatrixCatalogStatus,
  actor: ShowcaseMatrixCatalogActor,
): Promise<ShowcaseMatrixDefDto> {
  assertCanMutate(actor);
  if (!DEF_STATUSES.has(status)) {
    throw new ShowcaseMatrixCatalogValidationError("Некорректный status.");
  }
  const r = await pool.query<Record<string, unknown>>(
    `UPDATE showcase_matrix_defs SET
       status = $2,
       updated_at = NOW(),
       updated_by = $3::uuid,
       updated_by_name = $4
     WHERE id = $1::uuid
     RETURNING *`,
    [id, status, actor.id, actor.fullName],
  );
  if (!r.rows[0]) {
    throw new ShowcaseMatrixCatalogValidationError("Матрица не найдена.");
  }
  return mapDefRow(r.rows[0]);
}

export async function deleteMatrixDef(pool: PoolLike, id: string, actor: ShowcaseMatrixCatalogActor): Promise<void> {
  assertCanMutate(actor);
  const r = await pool.query(`DELETE FROM showcase_matrix_defs WHERE id = $1::uuid`, [id]);
  if ((r.rowCount ?? 0) === 0) {
    throw new ShowcaseMatrixCatalogValidationError("Матрица не найдена.");
  }
}

function validateModelInputs(models: ShowcaseMatrixDefModelInput[]): void {
  const seen = new Set<string>();
  for (const m of models) {
    const key = `${m.targetKind}:${m.targetId}`;
    if (seen.has(key)) {
      throw new ShowcaseMatrixCatalogValidationError(
        `Дубликат позиции в составе: ${m.targetKind} / ${m.targetId}.`,
      );
    }
    seen.add(key);
    parseTargetKind(m.targetKind);
    parsePriority(m.priority);
    parseSegment(m.segment);
    parseOptionalValueWeight(m.valueWeight);
    parseSortOrder(m.sortOrder);
  }
}

export async function replaceMatrixDefModels(
  pool: PoolLike,
  defId: string,
  models: ShowcaseMatrixDefModelInput[],
  actor: ShowcaseMatrixCatalogActor,
): Promise<ShowcaseMatrixDefModelDto[]> {
  assertCanMutate(actor);
  const def = await fetchDefById(pool, defId);
  if (!def) {
    throw new ShowcaseMatrixCatalogValidationError("Матрица не найдена.");
  }
  validateModelInputs(models);

  await pool.query("BEGIN");
  try {
    await pool.query(`DELETE FROM showcase_matrix_def_models WHERE def_id = $1::uuid`, [defId]);
    const inserted: ShowcaseMatrixDefModelDto[] = [];
    for (const m of models) {
      const r = await pool.query<Record<string, unknown>>(
        `INSERT INTO showcase_matrix_def_models (
           def_id, target_kind, target_id, priority, segment, value_weight, sort_order
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          defId,
          m.targetKind,
          m.targetId,
          m.priority ?? "medium",
          m.segment,
          m.valueWeight ?? null,
          m.sortOrder ?? 0,
        ],
      );
      inserted.push(mapModelRow(r.rows[0]!));
    }
    await pool.query("COMMIT");
    return inserted;
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}

export async function upsertMatrixDefModel(
  pool: PoolLike,
  defId: string,
  model: ShowcaseMatrixDefModelInput,
  actor: ShowcaseMatrixCatalogActor,
): Promise<ShowcaseMatrixDefModelDto> {
  assertCanMutate(actor);
  const def = await fetchDefById(pool, defId);
  if (!def) {
    throw new ShowcaseMatrixCatalogValidationError("Матрица не найдена.");
  }
  validateModelInputs([model]);

  if (model.id) {
    const r = await pool.query<Record<string, unknown>>(
      `UPDATE showcase_matrix_def_models SET
         target_kind = $3,
         target_id = $4,
         priority = $5,
         segment = $6,
         value_weight = $7,
         sort_order = $8,
         updated_at = NOW()
       WHERE id = $1::uuid AND def_id = $2::uuid
       RETURNING *`,
      [
        model.id,
        defId,
        model.targetKind,
        model.targetId,
        model.priority ?? "medium",
        model.segment,
        model.valueWeight ?? null,
        model.sortOrder ?? 0,
      ],
    );
    if (!r.rows[0]) {
      throw new ShowcaseMatrixCatalogValidationError("Позиция не найдена.");
    }
    return mapModelRow(r.rows[0]);
  }

  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO showcase_matrix_def_models (
       def_id, target_kind, target_id, priority, segment, value_weight, sort_order
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (def_id, target_kind, target_id) DO UPDATE SET
       priority = EXCLUDED.priority,
       segment = EXCLUDED.segment,
       value_weight = EXCLUDED.value_weight,
       sort_order = EXCLUDED.sort_order,
       updated_at = NOW()
     RETURNING *`,
    [
      defId,
      model.targetKind,
      model.targetId,
      model.priority ?? "medium",
      model.segment,
      model.valueWeight ?? null,
      model.sortOrder ?? 0,
    ],
  );
  return mapModelRow(r.rows[0]!);
}

export async function deleteMatrixDefModel(
  pool: PoolLike,
  id: string,
  actor: ShowcaseMatrixCatalogActor,
): Promise<void> {
  assertCanMutate(actor);
  const r = await pool.query(`DELETE FROM showcase_matrix_def_models WHERE id = $1::uuid`, [id]);
  if ((r.rowCount ?? 0) === 0) {
    throw new ShowcaseMatrixCatalogValidationError("Позиция не найдена.");
  }
}

export type ShowcaseMatrixCatalogBatchResultItem =
  | { clientOpId?: string; ok: true; def?: ShowcaseMatrixDefDto; models?: ShowcaseMatrixDefModelDto[] }
  | { clientOpId?: string; ok: false; error: string };

export async function batchSyncMatrixCatalog(
  pool: PoolLike,
  actor: ShowcaseMatrixCatalogActor,
  ops: ShowcaseMatrixCatalogBatchOp[],
): Promise<{
  results: ShowcaseMatrixCatalogBatchResultItem[];
  applied: number;
  skipped: number;
}> {
  assertCanMutate(actor);
  const results: ShowcaseMatrixCatalogBatchResultItem[] = [];
  let applied = 0;
  let skipped = 0;

  for (const op of ops) {
    const clientOpId = "clientOpId" in op ? op.clientOpId : undefined;
    try {
      if (op.op === "upsertDef") {
        const { def, idempotent } = await upsertMatrixDef(pool, actor, op.def);
        results.push({ clientOpId, ok: true, def });
        if (idempotent) skipped += 1;
        else applied += 1;
      } else if (op.op === "deleteDef") {
        await deleteMatrixDef(pool, op.id, actor);
        results.push({ clientOpId, ok: true });
        applied += 1;
      } else if (op.op === "setDefStatus") {
        const def = await setMatrixDefStatus(pool, op.id, op.status, actor);
        results.push({ clientOpId, ok: true, def });
        applied += 1;
      } else if (op.op === "replaceModels") {
        const models = await replaceMatrixDefModels(pool, op.defId, op.models, actor);
        results.push({ clientOpId, ok: true, models });
        applied += 1;
      } else if (op.op === "upsertModel") {
        const row = await upsertMatrixDefModel(pool, op.defId, op.model, actor);
        results.push({ clientOpId, ok: true, models: [row] });
        applied += 1;
      } else if (op.op === "deleteModel") {
        await deleteMatrixDefModel(pool, op.id, actor);
        results.push({ clientOpId, ok: true });
        applied += 1;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ clientOpId, ok: false, error: message });
    }
  }

  return { results, applied, skipped };
}

export async function resolveActiveMatrixDef(
  pool: PoolLike,
  params: {
    clientCategory: ShowcaseMatrixCatalogClientCategory;
    region: string | null;
    city: string | null;
    onDate: string;
  },
): Promise<ShowcaseMatrixDefWithModelsDto | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.onDate)) {
    throw new ShowcaseMatrixCatalogValidationError("onDate должен быть YYYY-MM-DD.");
  }

  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM showcase_matrix_defs
     WHERE status = 'published'
       AND client_category = $1
       AND (effective_from IS NULL OR effective_from <= $2::date)
       AND (effective_to IS NULL OR effective_to >= $2::date)`,
    [params.clientCategory, params.onDate],
  );

  const defs = r.rows.map(mapDefRow).filter((d) => isMatrixDefEffectiveOnDate(d, params.onDate));
  const picked = pickResolvedMatrixDef(defs, {
    region: params.region,
    city: params.city,
  });
  if (!picked) return null;

  const models = await fetchModelsForDef(pool, picked.id);
  return { ...picked, models };
}
