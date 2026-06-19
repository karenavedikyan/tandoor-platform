/**
 * Showcase distribution state API (Промт 426) — Postgres вместо sessionStorage.
 */

import type { PoolLike } from "./admin/admin-auth.js";

export type ShowcaseCategoryId = "entrance_doors" | "interior_doors" | "hardware" | "molding";
export type ShowcaseRowStatus = "ok" | "attention" | "critical";
export type ShowcaseTaskStatus = "new" | "in_progress" | "done" | "postponed" | "needs_rop";
export type ShowcaseCompleteResultKind =
  | "added_models"
  | "agreed_installation"
  | "updated_samples"
  | "photo_report"
  | "client_refused";

export type ShowcaseDistributionSessionUser = {
  id: string;
  role: string;
  status: string;
  fullName: string;
};

export type ShowcaseRowOverrideDto = {
  actualCount: number;
  status: ShowcaseRowStatus;
  comment?: string;
  updatedAt: string;
  updatedBy: string;
};

export type ShowcaseTaskUpdateDto = {
  status: ShowcaseTaskStatus;
  resultComment?: string;
  nextActionDate?: string;
  nextActionText?: string;
  completedAt?: string;
  updatedBy?: string;
  resultKind?: ShowcaseCompleteResultKind;
  resolvedActualCount?: number;
};

export type ShowcaseHistoryEntryDto = {
  id: string;
  at: string;
  meta: string;
  body: string;
};

export type ShowcaseRecommendationStoredDto = {
  modelId: string;
  modelLabel: string;
  categoryId: ShowcaseCategoryId;
  bucket: "top20" | "novelty";
  reason: string;
  createdAt: string;
  createdBy: string;
};

export type ShowcaseStorageV1Dto = {
  overrides: Record<string, ShowcaseRowOverrideDto>;
  taskUpdates: Record<string, ShowcaseTaskUpdateDto>;
  historyByDealer: Record<string, ShowcaseHistoryEntryDto[]>;
  recommendationTaskEntries?: Record<string, ShowcaseRecommendationStoredDto[]>;
};

export type ShowcaseGlobalTaskRowDto = {
  taskId: string;
  dealerId: string;
  dealerName: string;
  tradePointId: string;
  tradePointName: string;
  categoryId: ShowcaseCategoryId;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  showcaseStatus: ShowcaseTaskStatus;
  dueDate: string;
  targetCount: number;
  actualCount: number;
  deficitCount: number;
};

const CATEGORIES: ShowcaseCategoryId[] = ["entrance_doors", "interior_doors", "hardware", "molding"];
const CATEGORY_LABEL: Record<ShowcaseCategoryId, string> = {
  entrance_doors: "Входные двери",
  interior_doors: "Межкомнатные двери",
  hardware: "Фурнитура",
  molding: "Плинтусы и доборы",
};
const RESULT_LABEL: Record<ShowcaseCompleteResultKind, string> = {
  added_models: "Добавил модели",
  agreed_installation: "Согласовал установку",
  updated_samples: "Обновил образцы",
  photo_report: "Сделал фотоотчёт",
  client_refused: "Клиент отказался",
};

export class ShowcaseDistributionValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export class ShowcaseDistributionForbiddenError extends Error {
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

function dealerOverrideKey(dealerId: string, categoryId: ShowcaseCategoryId): string {
  return `${dealerId}|${categoryId}`;
}

function dealerIdFromClientCode(code: string): string {
  return `client-${code.toLowerCase()}`;
}

function clientCodeFromDealerId(dealerId: string): string {
  return dealerId.replace(/^client-/i, "").toUpperCase();
}

function charSum(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i += 1) sum += s.charCodeAt(i);
  return sum;
}

function hash01(dealerId: string, categoryId: string): number {
  return (charSum(dealerId) * 31 + charSum(categoryId)) % 1000;
}

function targetsForClientCategory(cat: string | null): Record<ShowcaseCategoryId, number> {
  switch (cat) {
    case "top150":
      return { entrance_doors: 10, interior_doors: 8, hardware: 8, molding: 5 };
    case "top350":
      return { entrance_doors: 7, interior_doors: 5, hardware: 5, molding: 4 };
    case "top500":
    case "top500plus":
      return { entrance_doors: 5, interior_doors: 4, hardware: 4, molding: 3 };
    case "new_client":
      return { entrance_doors: 3, interior_doors: 2, hardware: 2, molding: 2 };
    default:
      return { entrance_doors: 4, interior_doors: 3, hardware: 3, molding: 2 };
  }
}

function rowStatus(completionPct: number, deficit: number, target: number): ShowcaseRowStatus {
  if (deficit <= 0 || completionPct >= 95) return "ok";
  if (completionPct >= 70 || deficit <= Math.max(1, Math.floor(target * 0.25))) return "attention";
  return "critical";
}

function dueDateFor(dealerId: string, categoryId: ShowcaseCategoryId): string {
  const d = 8 + (hash01(dealerId, categoryId) % 18);
  return `${String(d).padStart(2, "0")}.05.2026`;
}

function priorityFor(deficit: number, target: number): "high" | "medium" | "low" {
  const ratio = target > 0 ? deficit / target : 0;
  if (ratio > 0.45 || deficit >= 4) return "high";
  if (ratio > 0.2 || deficit >= 2) return "medium";
  return "low";
}

function isUnrestrictedRole(role: string): boolean {
  return role === "admin" || role === "director" || role === "analyst" || role === "marketer" || role === "category_manager";
}

function isReadOnlyRole(role: string): boolean {
  return role === "analyst" || role === "marketer" || role === "director";
}

async function managerOwnsDealer(pool: PoolLike, userId: string, dealerId: string): Promise<boolean> {
  const code = clientCodeFromDealerId(dealerId);
  const r = await pool.query(
    `SELECT 1 FROM client_assignments WHERE client_code = $1 AND responsible_user_id = $2::uuid LIMIT 1`,
    [code, userId],
  );
  return r.rows.length > 0;
}

async function ropOwnsDealer(pool: PoolLike, userId: string, dealerId: string): Promise<boolean> {
  const code = clientCodeFromDealerId(dealerId);
  const r = await pool.query(
    `SELECT 1 FROM client_assignments ca
     INNER JOIN teams t ON t.id = ca.team_id
     WHERE ca.client_code = $1 AND t.rop_user_id = $2::uuid LIMIT 1`,
    [code, userId],
  );
  return r.rows.length > 0;
}

async function canViewDealer(pool: PoolLike, user: ShowcaseDistributionSessionUser, dealerId: string): Promise<boolean> {
  if (isUnrestrictedRole(user.role)) return true;
  if (user.role === "manager") return managerOwnsDealer(pool, user.id, dealerId);
  if (user.role === "rop") return ropOwnsDealer(pool, user.id, dealerId);
  if (user.role === "regional_manager") {
    const r = await pool.query(
      `SELECT 1 FROM dealer_overrides WHERE dealer_id = $1 AND regional_manager_id = $2::uuid LIMIT 1`,
      [dealerId, user.id],
    );
    return r.rows.length > 0;
  }
  return false;
}

async function assertCanView(pool: PoolLike, user: ShowcaseDistributionSessionUser, dealerId: string): Promise<void> {
  if (!(await canViewDealer(pool, user, dealerId))) {
    throw new ShowcaseDistributionForbiddenError("forbidden");
  }
}

async function assertCanComplete(pool: PoolLike, user: ShowcaseDistributionSessionUser, dealerId: string): Promise<void> {
  if (isReadOnlyRole(user.role)) throw new ShowcaseDistributionForbiddenError("read_only");
  if (user.role === "admin") return;
  if (user.role === "manager" && (await managerOwnsDealer(pool, user.id, dealerId))) return;
  throw new ShowcaseDistributionForbiddenError("forbidden");
}

async function assertCanWorkflow(pool: PoolLike, user: ShowcaseDistributionSessionUser, dealerId: string): Promise<void> {
  if (isReadOnlyRole(user.role)) throw new ShowcaseDistributionForbiddenError("read_only");
  if (user.role === "admin") return;
  if (user.role === "manager" && (await managerOwnsDealer(pool, user.id, dealerId))) return;
  if (user.role === "rop" && (await ropOwnsDealer(pool, user.id, dealerId))) return;
  throw new ShowcaseDistributionForbiddenError("forbidden");
}

function parseCategoryId(raw: unknown): ShowcaseCategoryId {
  if (typeof raw !== "string" || !CATEGORIES.includes(raw as ShowcaseCategoryId)) {
    throw new ShowcaseDistributionValidationError("VALIDATION_ERROR", "Некорректный categoryId.");
  }
  return raw as ShowcaseCategoryId;
}

function parseTaskStatus(raw: unknown): ShowcaseTaskStatus {
  const allowed: ShowcaseTaskStatus[] = ["new", "in_progress", "done", "postponed", "needs_rop"];
  if (typeof raw !== "string" || !allowed.includes(raw as ShowcaseTaskStatus)) {
    throw new ShowcaseDistributionValidationError("VALIDATION_ERROR", "Некорректный status.");
  }
  return raw as ShowcaseTaskStatus;
}

function parseResultKind(raw: unknown): ShowcaseCompleteResultKind {
  const allowed = Object.keys(RESULT_LABEL) as ShowcaseCompleteResultKind[];
  if (typeof raw !== "string" || !allowed.includes(raw as ShowcaseCompleteResultKind)) {
    throw new ShowcaseDistributionValidationError("VALIDATION_ERROR", "Некорректный resultKind.");
  }
  return raw as ShowcaseCompleteResultKind;
}

function emptyDto(): ShowcaseStorageV1Dto {
  return { overrides: {}, taskUpdates: {}, historyByDealer: {}, recommendationTaskEntries: {} };
}

async function loadStateForDealer(pool: PoolLike, dealerId: string): Promise<ShowcaseStorageV1Dto> {
  const dto = emptyDto();

  const overrides = await pool.query<{
    category_id: string;
    actual_count: number;
    status: string;
    comment: string | null;
    updated_at: string;
    updated_by_name: string | null;
  }>(
    `SELECT category_id, actual_count, status, comment, updated_at, updated_by_name
     FROM showcase_distribution_overrides WHERE dealer_id = $1`,
    [dealerId],
  );
  for (const row of overrides.rows) {
    const cat = row.category_id as ShowcaseCategoryId;
    dto.overrides[dealerOverrideKey(dealerId, cat)] = {
      actualCount: row.actual_count,
      status: row.status as ShowcaseRowStatus,
      comment: row.comment ?? undefined,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by_name ?? "—",
    };
  }

  const taskUpdates = await pool.query<{
    task_id: string;
    status: string;
    result_comment: string | null;
    next_action_date: string | null;
    next_action_text: string | null;
    completed_at: string | null;
    result_kind: string | null;
    resolved_actual_count: number | null;
    updated_by_name: string | null;
  }>(
    `SELECT task_id, status, result_comment, next_action_date, next_action_text, completed_at,
            result_kind, resolved_actual_count, updated_by_name
     FROM showcase_distribution_task_updates WHERE dealer_id = $1`,
    [dealerId],
  );
  for (const row of taskUpdates.rows) {
    dto.taskUpdates[row.task_id] = {
      status: row.status as ShowcaseTaskStatus,
      resultComment: row.result_comment ?? undefined,
      nextActionDate: row.next_action_date ?? undefined,
      nextActionText: row.next_action_text ?? undefined,
      completedAt: row.completed_at ?? undefined,
      updatedBy: row.updated_by_name ?? undefined,
      resultKind: (row.result_kind as ShowcaseCompleteResultKind | null) ?? undefined,
      resolvedActualCount: row.resolved_actual_count ?? undefined,
    };
  }

  const history = await pool.query<{
    id: string;
    at: string;
    meta: string;
    body: string;
  }>(
    `SELECT id, at, meta, body FROM showcase_distribution_history
     WHERE dealer_id = $1 ORDER BY at DESC LIMIT 40`,
    [dealerId],
  );
  dto.historyByDealer[dealerId] = history.rows.map((r) => ({
    id: r.id,
    at: r.at,
    meta: r.meta,
    body: r.body,
  }));

  const recs = await pool.query<{
    model_id: string;
    model_label: string;
    category_id: string;
    bucket: string;
    reason: string;
    created_at: string;
    created_by_name: string | null;
  }>(
    `SELECT model_id, model_label, category_id, bucket, reason, created_at, created_by_name
     FROM showcase_distribution_recommendations WHERE dealer_id = $1`,
    [dealerId],
  );
  dto.recommendationTaskEntries![dealerId] = recs.rows.map((r) => ({
    modelId: r.model_id,
    modelLabel: r.model_label,
    categoryId: r.category_id as ShowcaseCategoryId,
    bucket: r.bucket as "top20" | "novelty",
    reason: r.reason,
    createdAt: r.created_at,
    createdBy: r.created_by_name ?? "—",
  }));

  return dto;
}

function recomputeOverrideStatus(target: number, actual: number): ShowcaseRowStatus {
  const deficit = Math.max(0, target - actual);
  const completionPct = target <= 0 ? 100 : Math.min(100, Math.round((actual / target) * 100));
  return rowStatus(completionPct, deficit, target);
}

async function getClientCategory(pool: PoolLike, dealerId: string): Promise<string | null> {
  const r = await pool.query<{ client_category: string | null }>(
    `SELECT client_category FROM dealer_overrides WHERE dealer_id = $1 LIMIT 1`,
    [dealerId],
  );
  return r.rows[0]?.client_category ?? null;
}

async function listAccessibleDealers(
  pool: PoolLike,
  user: ShowcaseDistributionSessionUser,
): Promise<{ dealer_id: string; name: string | null; client_category: string | null }[]> {
  if (isUnrestrictedRole(user.role)) {
    const r = await pool.query<{ dealer_id: string; name: string | null; client_category: string | null }>(
      `SELECT DISTINCT dov.dealer_id, dov.name, dov.client_category
       FROM dealer_overrides dov
       INNER JOIN client_assignments ca ON upper(replace(dov.dealer_id, 'client-', '')) = ca.client_code
       ORDER BY dov.dealer_id`,
    );
    return r.rows;
  }
  if (user.role === "manager") {
    const r = await pool.query<{ dealer_id: string; name: string | null; client_category: string | null }>(
      `SELECT DISTINCT dov.dealer_id, dov.name, dov.client_category
       FROM dealer_overrides dov
       INNER JOIN client_assignments ca ON upper(replace(dov.dealer_id, 'client-', '')) = ca.client_code
       WHERE ca.responsible_user_id = $1::uuid
       ORDER BY dov.dealer_id`,
      [user.id],
    );
    return r.rows;
  }
  if (user.role === "rop") {
    const r = await pool.query<{ dealer_id: string; name: string | null; client_category: string | null }>(
      `SELECT DISTINCT dov.dealer_id, dov.name, dov.client_category
       FROM dealer_overrides dov
       INNER JOIN client_assignments ca ON upper(replace(dov.dealer_id, 'client-', '')) = ca.client_code
       INNER JOIN teams t ON t.id = ca.team_id
       WHERE t.rop_user_id = $1::uuid
       ORDER BY dov.dealer_id`,
      [user.id],
    );
    return r.rows;
  }
  if (user.role === "regional_manager") {
    const r = await pool.query<{ dealer_id: string; name: string | null; client_category: string | null }>(
      `SELECT dov.dealer_id, dov.name, dov.client_category
       FROM dealer_overrides dov
       WHERE dov.regional_manager_id = $1::uuid
       ORDER BY dov.dealer_id`,
      [user.id],
    );
    return r.rows;
  }
  return [];
}

function buildGlobalTasksForDealer(
  dealerId: string,
  dealerName: string,
  clientCategory: string | null,
  state: ShowcaseStorageV1Dto,
): ShowcaseGlobalTaskRowDto[] {
  const targets = targetsForClientCategory(clientCategory);
  const rows = CATEGORIES.map((categoryId) => {
    const targetCount = targets[categoryId];
    const h = hash01(dealerId, categoryId);
    const baseActual = Math.min(targetCount, h % Math.max(targetCount + 3, 6));
    const o = state.overrides[dealerOverrideKey(dealerId, categoryId)];
    const actualCount = o?.actualCount ?? baseActual;
    const deficitCount = Math.max(0, targetCount - actualCount);
    return { categoryId, targetCount, actualCount, deficitCount };
  });

  const out: ShowcaseGlobalTaskRowDto[] = [];
  const tpId = `${dealerId}-tp`;
  const tpName = "Торговая точка";

  for (const r of rows) {
    if (r.deficitCount <= 0) continue;
    const taskId = `sd-${dealerId}-${r.categoryId}`;
    const u = state.taskUpdates[taskId];
    const status = u?.status ?? "new";
    if (status === "done") continue;
    const actualCount = u?.resolvedActualCount ?? r.actualCount;
    out.push({
      taskId,
      dealerId,
      dealerName,
      tradePointId: tpId,
      tradePointName: tpName,
      categoryId: r.categoryId,
      title: `Витрина: ${CATEGORY_LABEL[r.categoryId]}`,
      description: `План ${r.targetCount} поз., факт ${actualCount}. Дефицит ${r.deficitCount}.`,
      priority: priorityFor(r.deficitCount, r.targetCount),
      showcaseStatus: status,
      dueDate: dueDateFor(dealerId, r.categoryId),
      targetCount: r.targetCount,
      actualCount,
      deficitCount: Math.max(0, r.targetCount - actualCount),
    });
  }

  const recs = state.recommendationTaskEntries?.[dealerId] ?? [];
  for (const rec of recs) {
    const taskId = `rec-${dealerId}-${rec.modelId}`;
    const u = state.taskUpdates[taskId];
    const status = u?.status ?? "new";
    if (status === "done") continue;
    out.push({
      taskId,
      dealerId,
      dealerName,
      tradePointId: tpId,
      tradePointName: tpName,
      categoryId: rec.categoryId,
      title: `Рекомендация: ${rec.modelLabel}`,
      description: rec.reason,
      priority: rec.bucket === "top20" ? "high" : "medium",
      showcaseStatus: status,
      dueDate: dueDateFor(dealerId, rec.categoryId),
      targetCount: 1,
      actualCount: 0,
      deficitCount: 1,
    });
  }

  return out;
}

export async function handleShowcaseDistributionState(
  pool: PoolLike,
  user: ShowcaseDistributionSessionUser,
  dealerId: string,
): Promise<{ success: true; state: ShowcaseStorageV1Dto }> {
  if (!dealerId.trim()) throw new ShowcaseDistributionValidationError("VALIDATION_ERROR", "Укажите dealerId.");
  await assertCanView(pool, user, dealerId);
  const state = await loadStateForDealer(pool, dealerId);
  return { success: true, state };
}

export async function handleShowcaseDistributionGlobalTasks(
  pool: PoolLike,
  user: ShowcaseDistributionSessionUser,
): Promise<{ success: true; tasks: ShowcaseGlobalTaskRowDto[] }> {
  const dealers = await listAccessibleDealers(pool, user);
  const tasks: ShowcaseGlobalTaskRowDto[] = [];
  for (const d of dealers) {
    const state = await loadStateForDealer(pool, d.dealer_id);
    tasks.push(...buildGlobalTasksForDealer(d.dealer_id, d.name ?? d.dealer_id, d.client_category, state));
  }
  return { success: true, tasks };
}

export async function handleShowcaseDistributionTaskComplete(
  pool: PoolLike,
  user: ShowcaseDistributionSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; state: ShowcaseStorageV1Dto }> {
  const dealerId = typeof body.dealerId === "string" ? body.dealerId.trim() : "";
  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  const categoryId = parseCategoryId(body.categoryId);
  const newActualCount = Number(body.newActualCount);
  const resultKind = parseResultKind(body.resultKind);
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  const nextActionDate = typeof body.nextActionDate === "string" ? body.nextActionDate.trim() : "";
  const nextActionText = typeof body.nextActionText === "string" ? body.nextActionText.trim() : "";
  if (!dealerId || !taskId || !Number.isFinite(newActualCount) || newActualCount < 0) {
    throw new ShowcaseDistributionValidationError("VALIDATION_ERROR", "Некорректный payload.");
  }
  await assertCanComplete(pool, user, dealerId);

  const clientCategory = await getClientCategory(pool, dealerId);
  const target = targetsForClientCategory(clientCategory)[categoryId];
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const actorName = user.fullName || user.id;
  const status = recomputeOverrideStatus(target, newActualCount);

  await pool.query("BEGIN");
  try {
    await pool.query(
      `INSERT INTO showcase_distribution_task_updates
         (task_id, dealer_id, category_id, status, result_comment, next_action_date, next_action_text,
          completed_at, result_kind, resolved_actual_count, updated_at, updated_by, updated_by_name)
       VALUES ($1, $2, $3, 'done', $4, $5, $6, $7, $8, $9, now(), $10, $11)
       ON CONFLICT (task_id) DO UPDATE SET
         status = 'done', result_comment = EXCLUDED.result_comment, next_action_date = EXCLUDED.next_action_date,
         next_action_text = EXCLUDED.next_action_text, completed_at = EXCLUDED.completed_at,
         result_kind = EXCLUDED.result_kind, resolved_actual_count = EXCLUDED.resolved_actual_count,
         updated_at = now(), updated_by = EXCLUDED.updated_by, updated_by_name = EXCLUDED.updated_by_name`,
      [taskId, dealerId, categoryId, comment, nextActionDate, nextActionText, day, resultKind, newActualCount, user.id, actorName],
    );

    await pool.query(
      `INSERT INTO showcase_distribution_overrides
         (dealer_id, category_id, actual_count, status, comment, updated_at, updated_by, updated_by_name)
       VALUES ($1, $2, $3, $4, $5, now(), $6, $7)
       ON CONFLICT (dealer_id, category_id) DO UPDATE SET
         actual_count = EXCLUDED.actual_count, status = EXCLUDED.status, comment = EXCLUDED.comment,
         updated_at = now(), updated_by = EXCLUDED.updated_by, updated_by_name = EXCLUDED.updated_by_name`,
      [dealerId, categoryId, newActualCount, status, comment, user.id, actorName],
    );

    const histId = `sh-${dealerId}-${taskId}-${Date.now()}`;
    const catLabel = CATEGORY_LABEL[categoryId];
    await pool.query(
      `INSERT INTO showcase_distribution_history (id, dealer_id, at, meta, body, actor_id, actor_name)
       VALUES ($1, $2, now(), $3, $4, $5, $6)`,
      [
        histId,
        dealerId,
        `${day} · ${actorName}`,
        `Менеджер обновил витрину: ${catLabel}, факт ${newActualCount} из плана ${target}. Результат: ${RESULT_LABEL[resultKind]}. Комментарий: ${comment}`,
        user.id,
        actorName,
      ],
    );

    await pool.query("COMMIT");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }

  const state = await loadStateForDealer(pool, dealerId);
  return { success: true, state };
}

export async function handleShowcaseDistributionTaskStatus(
  pool: PoolLike,
  user: ShowcaseDistributionSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; state: ShowcaseStorageV1Dto }> {
  const dealerId = typeof body.dealerId === "string" ? body.dealerId.trim() : "";
  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
  const categoryId = parseCategoryId(body.categoryId);
  const status = parseTaskStatus(body.status);
  if (!dealerId || !taskId) throw new ShowcaseDistributionValidationError("VALIDATION_ERROR", "Некорректный payload.");
  await assertCanWorkflow(pool, user, dealerId);
  const actorName = user.fullName || user.id;

  await pool.query(
    `INSERT INTO showcase_distribution_task_updates
       (task_id, dealer_id, category_id, status, updated_at, updated_by, updated_by_name)
     VALUES ($1, $2, $3, $4, now(), $5, $6)
     ON CONFLICT (task_id) DO UPDATE SET
       status = EXCLUDED.status, updated_at = now(), updated_by = EXCLUDED.updated_by, updated_by_name = EXCLUDED.updated_by_name`,
    [taskId, dealerId, categoryId, status, user.id, actorName],
  );

  const state = await loadStateForDealer(pool, dealerId);
  return { success: true, state };
}

export async function handleShowcaseDistributionRecommendation(
  pool: PoolLike,
  user: ShowcaseDistributionSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; state: ShowcaseStorageV1Dto } | { success: false; conflict: true; message: string }> {
  const dealerId = typeof body.dealerId === "string" ? body.dealerId.trim() : "";
  const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";
  const modelLabel = typeof body.modelLabel === "string" ? body.modelLabel.trim() : "";
  const categoryId = parseCategoryId(body.categoryId);
  const bucket = body.bucket === "top20" || body.bucket === "novelty" ? body.bucket : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!dealerId || !modelId || !modelLabel || !bucket || !reason) {
    throw new ShowcaseDistributionValidationError("VALIDATION_ERROR", "Некорректный payload.");
  }
  await assertCanWorkflow(pool, user, dealerId);
  const actorName = user.fullName || user.id;
  const now = new Date().toISOString();
  const day = now.slice(0, 10);

  const ins = await pool.query(
    `INSERT INTO showcase_distribution_recommendations
       (dealer_id, model_id, model_label, category_id, bucket, reason, created_at, created_by, created_by_name)
     VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $8)
     ON CONFLICT (dealer_id, model_id) DO NOTHING
     RETURNING model_id`,
    [dealerId, modelId, modelLabel, categoryId, bucket, reason, user.id, actorName],
  );
  if (ins.rows.length === 0) {
    return { success: false, conflict: true, message: "Рекомендация уже добавлена." };
  }

  const histId = `sh-rec-${dealerId}-${modelId}-${Date.now()}`;
  const bucketRu = bucket === "top20" ? "ТОП 20" : "Новинка";
  await pool.query(
    `INSERT INTO showcase_distribution_history (id, dealer_id, at, meta, body, actor_id, actor_name)
     VALUES ($1, $2, now(), $3, $4, $5, $6)`,
    [
      histId,
      dealerId,
      `${day} · ${actorName}`,
      `Добавлена задача по витрине из рекомендации: ${modelLabel} (${bucketRu}). ${reason}`,
      user.id,
      actorName,
    ],
  );

  const state = await loadStateForDealer(pool, dealerId);
  return { success: true, state };
}

export async function handleShowcaseDistributionOverride(
  pool: PoolLike,
  user: ShowcaseDistributionSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; state: ShowcaseStorageV1Dto }> {
  if (user.role !== "admin" && user.role !== "director") {
    throw new ShowcaseDistributionForbiddenError("forbidden");
  }
  const dealerId = typeof body.dealerId === "string" ? body.dealerId.trim() : "";
  const categoryId = parseCategoryId(body.categoryId);
  const actualCount = Number(body.actualCount);
  const status = body.status as ShowcaseRowStatus;
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (!dealerId || !Number.isFinite(actualCount) || !["ok", "attention", "critical"].includes(status)) {
    throw new ShowcaseDistributionValidationError("VALIDATION_ERROR", "Некорректный payload.");
  }
  const actorName = user.fullName || user.id;

  await pool.query(
    `INSERT INTO showcase_distribution_overrides
       (dealer_id, category_id, actual_count, status, comment, updated_at, updated_by, updated_by_name)
     VALUES ($1, $2, $3, $4, $5, now(), $6, $7)
     ON CONFLICT (dealer_id, category_id) DO UPDATE SET
       actual_count = EXCLUDED.actual_count, status = EXCLUDED.status, comment = EXCLUDED.comment,
       updated_at = now(), updated_by = EXCLUDED.updated_by, updated_by_name = EXCLUDED.updated_by_name`,
    [dealerId, categoryId, actualCount, status, comment, user.id, actorName],
  );

  const histId = `sh-ovr-${dealerId}-${categoryId}-${Date.now()}`;
  await pool.query(
    `INSERT INTO showcase_distribution_history (id, dealer_id, at, meta, body, actor_id, actor_name)
     VALUES ($1, $2, now(), $3, $4, $5, $6)`,
    [histId, dealerId, `${new Date().toISOString().slice(0, 10)} · ${actorName}`, `Админ-правка: ${CATEGORY_LABEL[categoryId]}, факт ${actualCount}.`, user.id, actorName],
  );

  const state = await loadStateForDealer(pool, dealerId);
  return { success: true, state };
}

function parseTaskDealerId(taskId: string, categoryId: string): string | null {
  const suffix = `-${categoryId}`;
  if (!taskId.startsWith("sd-") || !taskId.endsWith(suffix)) return null;
  return taskId.slice(3, taskId.length - suffix.length);
}

/** TODO: удалить через 2 недели после деплоя — одноразовый импорт из sessionStorage. */
export async function handleShowcaseDistributionImport(
  pool: PoolLike,
  user: ShowcaseDistributionSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; imported: number }> {
  const raw = body.storage;
  if (!raw || typeof raw !== "object") {
    throw new ShowcaseDistributionValidationError("VALIDATION_ERROR", "Укажите storage.");
  }
  const storage = raw as {
    overrides?: Record<string, { actualCount: number; status: string; comment?: string; updatedAt: string; updatedBy: string }>;
    taskUpdates?: Record<string, { status?: string; categoryId?: string; dealerId?: string } & Record<string, unknown>>;
    historyByDealer?: Record<string, ShowcaseHistoryEntryDto[]>;
    recommendationTaskEntries?: Record<string, ShowcaseRecommendationStoredDto[]>;
  };
  let imported = 0;
  const actorName = user.fullName || user.id;

  await pool.query("BEGIN");
  try {
    for (const [key, o] of Object.entries(storage.overrides ?? {})) {
      const sep = key.indexOf("|");
      if (sep < 0) continue;
      const dealerId = key.slice(0, sep);
      const categoryId = key.slice(sep + 1);
      if (!(await canViewDealer(pool, user, dealerId))) continue;
      await pool.query(
        `INSERT INTO showcase_distribution_overrides (dealer_id, category_id, actual_count, status, comment, updated_at, updated_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (dealer_id, category_id) DO NOTHING`,
        [dealerId, categoryId, o.actualCount, o.status, o.comment ?? null, o.updatedAt, o.updatedBy],
      );
      imported += 1;
    }
    for (const [taskId, u] of Object.entries(storage.taskUpdates ?? {})) {
      const categoryId = typeof u.categoryId === "string" ? u.categoryId : (taskId.split("-").pop() ?? "entrance_doors");
      const dId =
        typeof u.dealerId === "string" && u.dealerId.trim()
          ? u.dealerId.trim()
          : parseTaskDealerId(taskId, categoryId) ?? "";
      if (!dId || !(await canViewDealer(pool, user, dId))) continue;
      await pool.query(
        `INSERT INTO showcase_distribution_task_updates (task_id, dealer_id, category_id, status, updated_at, updated_by_name)
         VALUES ($1, $2, $3, $4, now(), $5)
         ON CONFLICT (task_id) DO NOTHING`,
        [taskId, dId, categoryId, u.status ?? "new", actorName],
      );
      imported += 1;
    }
    for (const [dealerId, entries] of Object.entries(storage.historyByDealer ?? {})) {
      if (!(await canViewDealer(pool, user, dealerId))) continue;
      for (const h of entries) {
        await pool.query(
          `INSERT INTO showcase_distribution_history (id, dealer_id, at, meta, body)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [h.id, dealerId, h.at, h.meta, h.body],
        );
        imported += 1;
      }
    }
    for (const [dealerId, recs] of Object.entries(storage.recommendationTaskEntries ?? {})) {
      if (!(await canViewDealer(pool, user, dealerId))) continue;
      for (const rec of recs) {
        await pool.query(
          `INSERT INTO showcase_distribution_recommendations
             (dealer_id, model_id, model_label, category_id, bucket, reason, created_at, created_by_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (dealer_id, model_id) DO NOTHING`,
          [dealerId, rec.modelId, rec.modelLabel, rec.categoryId, rec.bucket, rec.reason, rec.createdAt, rec.createdBy],
        );
        imported += 1;
      }
    }
    await pool.query("COMMIT");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }

  return { success: true, imported };
}

export { dealerIdFromClientCode, clientCodeFromDealerId };
