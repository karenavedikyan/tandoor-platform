/**
 * Showcase install assignments — задания на отгрузку моделей на витрину (Промт 228).
 *
 * Воркфлоу:
 *   1. Регионал (regional_manager) создаёт задание из выбранных моделей для ТТ, назначает менеджера.
 *   2. Менеджер открывает задание по ссылке (с логином), отмечает позиции как отгруженные (item-toggle),
 *      завершает задание (submit).
 *   3. Регионал видит «выполнено», подтверждает позиции «на витрине» (verify) — это переводит
 *      соответствующие записи showcase_matrix_entries в статус installed; либо создаёт followup-задание
 *      по неотгруженным/неподтверждённым позициям.
 *
 * Доступ: только авторизованные пользователи (роли ниже). Ссылка ведёт на внутренний роут #/assignment/<id>.
 */

import {
  upsertShowcaseMatrixEntry,
  type ShowcaseMatrixSessionUser,
} from "./showcase-matrix-handlers.js";
import { resolveResponsiblesForTradePoint } from "./responsibility-resolver.js";

type PoolLike = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

export type AssignmentStatus = "open" | "in_progress" | "submitted" | "verified" | "closed";
export type AssignmentTargetKind = "model" | "variant";
export type AssignmentItemStatus = "pending" | "shipped" | "installed" | "problem";

export type AssignmentSessionUser = {
  id: string;
  role: string;
  status: string;
  fullName: string;
};

export type AssignmentItemDto = {
  id: string;
  assignmentId: string;
  targetKind: AssignmentTargetKind;
  targetId: string;
  modelName: string;
  done: boolean;
  doneAt: string | null;
  doneBy: string | null;
  doneByName: string | null;
  verified: boolean;
  verifiedAt: string | null;
  itemStatus: AssignmentItemStatus;
  problemReason: string | null;
  photoUrl: string | null;
  photoThumbUrl: string | null;
  shippedDate: string | null;
};

export type AssignmentDto = {
  id: string;
  dealerId: string;
  tradePointId: string;
  status: AssignmentStatus;
  title: string;
  comment: string | null;
  dueDate: string | null;
  shippedDate: string | null;
  createdBy: string | null;
  createdByName: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verifiedByName: string | null;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  archivedAt: string | null;
  items: AssignmentItemDto[];
  // Сводка для UI.
  itemsTotal: number;
  itemsDone: number;
  itemsVerified: number;
};

export type AssignmentCommentDto = {
  id: string;
  assignmentId: string;
  authorId: string | null;
  authorName: string | null;
  authorRole: string | null;
  body: string;
  createdAt: string;
};

export class AssignmentValidationError extends Error {
  readonly code: string;
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(message);
    this.code = code;
  }
}

// Роли, которым разрешено работать с заданиями.
const CREATE_ROLES = new Set(["admin", "director", "rop", "regional_manager"]);
const VERIFY_ROLES = new Set(["admin", "director", "rop", "regional_manager"]);
const ANY_ROLE = new Set(["admin", "director", "rop", "regional_manager", "manager"]);
const ELEVATED_ROLES = new Set(["admin", "director"]);
const COMMENT_ACCESS_ROLES = new Set(["admin", "director", "rop", "regional_manager"]);

function isElevated(me: AssignmentSessionUser): boolean {
  return ELEVATED_ROLES.has(me.role);
}

function canManageAssignment(me: AssignmentSessionUser, head: AssignmentDto): boolean {
  return isElevated(me) || head.createdBy === me.id;
}

function canAccessAssignmentComments(me: AssignmentSessionUser, head: AssignmentDto): boolean {
  return (
    COMMENT_ACCESS_ROLES.has(me.role) ||
    head.createdBy === me.id ||
    (head.assigneeUserId != null && head.assigneeUserId === me.id)
  );
}

function parseAssignmentIds(body: Record<string, unknown>): string[] {
  const single = str(body.assignmentId);
  if (single) return [single];
  if (!Array.isArray(body.assignmentIds)) return [];
  return body.assignmentIds.map((x) => String(x)).filter((id) => id.trim().length > 0);
}

function assertActive(me: AssignmentSessionUser): void {
  if (me.status !== "active") throw new AssignmentValidationError("Недостаточно прав.", "FORBIDDEN");
}

function str(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t || undefined;
}

function optStr(raw: unknown): string | null {
  const s = str(raw);
  return s ?? null;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return "";
}

function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toIso(v);
}

function toDateOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toIso(v).slice(0, 10);
}

function parseOptionalDate(raw: unknown): string | null {
  const s = str(raw);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

const ITEM_STATUS_VALUES = new Set<AssignmentItemStatus>(["pending", "shipped", "installed", "problem"]);

function parseItemStatus(r: Record<string, unknown>): AssignmentItemStatus {
  const raw = r.item_status;
  if (typeof raw === "string" && ITEM_STATUS_VALUES.has(raw as AssignmentItemStatus)) {
    return raw as AssignmentItemStatus;
  }
  if (Boolean(r.verified)) return "installed";
  if (Boolean(r.done)) return "shipped";
  return "pending";
}

async function notifyUser(
  pool: PoolLike,
  args: {
    userId: string;
    kind: string;
    title: string;
    body?: string | null;
    link?: string | null;
    entityId?: string | null;
    actorId?: string | null;
    actorName?: string | null;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO app_notifications (user_id, kind, title, body, link, entity_kind, entity_id, actor_id, actor_name)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid, $9)`,
      [
        args.userId,
        args.kind,
        args.title,
        args.body ?? null,
        args.link ?? null,
        "showcase_assignment",
        args.entityId ?? null,
        args.actorId ?? null,
        args.actorName ?? null,
      ],
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[showcase-assignments] notifyUser failed", m);
  }
}

function assertCanExecuteAssignment(me: AssignmentSessionUser, head: AssignmentDto): void {
  const elevated = me.role === "admin" || me.role === "director" || me.role === "rop";
  if (!elevated && head.assigneeUserId && head.assigneeUserId !== me.id) {
    throw new AssignmentValidationError("Это задание назначено другому исполнителю.", "FORBIDDEN");
  }
  if (head.status === "verified" || head.status === "closed") {
    throw new AssignmentValidationError("Задание уже завершено.", "CONFLICT");
  }
}

function mapItemRow(r: Record<string, unknown>): AssignmentItemDto {
  return {
    id: String(r.id),
    assignmentId: String(r.assignment_id),
    targetKind: (r.target_kind as AssignmentTargetKind) ?? "model",
    targetId: String(r.target_id),
    modelName: (r.model_name as string) ?? "",
    done: Boolean(r.done),
    doneAt: toIsoOrNull(r.done_at),
    doneBy: r.done_by ? String(r.done_by) : null,
    doneByName: (r.done_by_name as string) ?? null,
    verified: Boolean(r.verified),
    verifiedAt: toIsoOrNull(r.verified_at),
    itemStatus: parseItemStatus(r),
    problemReason: (r.problem_reason as string) ?? null,
    photoUrl: (r.photo_url as string) ?? null,
    photoThumbUrl: (r.photo_thumb_url as string) ?? null,
    shippedDate: toDateOrNull(r.shipped_date),
  };
}

function mapAssignmentRow(r: Record<string, unknown>, items: AssignmentItemDto[]): AssignmentDto {
  const itemsDone = items.filter((i) => i.done).length;
  const itemsVerified = items.filter((i) => i.verified).length;
  return {
    id: String(r.id),
    dealerId: String(r.dealer_id),
    tradePointId: String(r.trade_point_id),
    status: (r.status as AssignmentStatus) ?? "open",
    title: (r.title as string) ?? "",
    comment: (r.comment as string) ?? null,
    dueDate: r.due_date ? toIso(r.due_date).slice(0, 10) : null,
    shippedDate: toDateOrNull(r.shipped_date),
    createdBy: r.created_by ? String(r.created_by) : null,
    createdByName: (r.created_by_name as string) ?? null,
    assigneeUserId: r.assignee_user_id ? String(r.assignee_user_id) : null,
    assigneeName: (r.assignee_name as string) ?? null,
    submittedAt: toIsoOrNull(r.submitted_at),
    verifiedAt: toIsoOrNull(r.verified_at),
    verifiedBy: r.verified_by ? String(r.verified_by) : null,
    verifiedByName: (r.verified_by_name as string) ?? null,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
    isArchived: Boolean(r.is_archived),
    archivedAt: toIsoOrNull(r.archived_at),
    items,
    itemsTotal: items.length,
    itemsDone,
    itemsVerified,
  };
}

function mapCommentRow(r: Record<string, unknown>): AssignmentCommentDto {
  return {
    id: String(r.id),
    assignmentId: String(r.assignment_id),
    authorId: r.author_id ? String(r.author_id) : null,
    authorName: (r.author_name as string) ?? null,
    authorRole: (r.author_role as string) ?? null,
    body: String(r.body),
    createdAt: toIso(r.created_at),
  };
}

async function loadItems(pool: PoolLike, assignmentId: string): Promise<AssignmentItemDto[]> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM showcase_install_assignment_items
     WHERE assignment_id = $1
     ORDER BY created_at ASC, model_name ASC`,
    [assignmentId],
  );
  return r.rows.map(mapItemRow);
}

async function loadAssignment(pool: PoolLike, id: string): Promise<AssignmentDto | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM showcase_install_assignments WHERE id = $1 LIMIT 1`,
    [id],
  );
  const row = r.rows[0];
  if (!row) return null;
  const items = await loadItems(pool, id);
  return mapAssignmentRow(row, items);
}

async function insertEvent(
  pool: PoolLike,
  args: { assignmentId: string; kind: string; targetId?: string | null; payload?: Record<string, unknown>; actorId: string; actorName: string },
): Promise<void> {
  await pool.query(
    `INSERT INTO showcase_install_assignment_events (assignment_id, kind, target_id, payload, actor_id, actor_name)
     VALUES ($1, $2, $3, $4::jsonb, $5::uuid, $6)`,
    [args.assignmentId, args.kind, args.targetId ?? null, JSON.stringify(args.payload ?? {}), args.actorId, args.actorName],
  );
}

// ── create ──────────────────────────────────────────────────────────────────
export type AssignmentCreateItemInput = { targetKind?: string; targetId: string; modelName?: string };
export type AssignmentCreateInput = {
  dealerId: string;
  tradePointId: string;
  title?: string;
  comment?: string | null;
  dueDate?: string | null;
  assigneeUserId?: string | null;
  assigneeName?: string | null;
  items: AssignmentCreateItemInput[];
};

export function parseCreateInput(body: Record<string, unknown>): AssignmentCreateInput {
  const dealerId = str(body.dealerId);
  const tradePointId = str(body.tradePointId);
  if (!dealerId) throw new AssignmentValidationError("dealerId обязателен.");
  if (!tradePointId) throw new AssignmentValidationError("tradePointId обязателен.");
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items: AssignmentCreateItemInput[] = [];
  for (const it of rawItems) {
    if (!it || typeof it !== "object") continue;
    const obj = it as Record<string, unknown>;
    const targetId = str(obj.targetId);
    if (!targetId) continue;
    const kind = str(obj.targetKind);
    items.push({
      targetId,
      targetKind: kind === "variant" ? "variant" : "model",
      modelName: str(obj.modelName) ?? "",
    });
  }
  if (items.length === 0) throw new AssignmentValidationError("Нужна хотя бы одна позиция.");
  const due = str(body.dueDate);
  return {
    dealerId,
    tradePointId,
    title: str(body.title) ?? "",
    comment: optStr(body.comment),
    dueDate: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
    assigneeUserId: optStr(body.assigneeUserId),
    assigneeName: optStr(body.assigneeName),
    items,
  };
}

async function insertAssignmentFromInput(
  pool: PoolLike,
  me: AssignmentSessionUser,
  input: AssignmentCreateInput,
): Promise<AssignmentDto> {
  const ins = await pool.query<Record<string, unknown>>(
    `INSERT INTO showcase_install_assignments
       (dealer_id, trade_point_id, status, title, comment, due_date, created_by, created_by_name, assignee_user_id, assignee_name)
     VALUES ($1, $2, 'open', $3, $4, $5::date, $6::uuid, $7, $8::uuid, $9)
     RETURNING *`,
    [
      input.dealerId,
      input.tradePointId,
      input.title ?? "",
      input.comment ?? null,
      input.dueDate,
      me.id,
      me.fullName,
      input.assigneeUserId,
      input.assigneeName,
    ],
  );
  const row = ins.rows[0]!;
  const assignmentId = String(row.id);

  for (const it of input.items) {
    await pool.query(
      `INSERT INTO showcase_install_assignment_items (assignment_id, target_kind, target_id, model_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (assignment_id, target_kind, target_id) DO NOTHING`,
      [assignmentId, it.targetKind ?? "model", it.targetId, it.modelName ?? ""],
    );
  }

  await insertEvent(pool, {
    assignmentId,
    kind: "created",
    payload: { itemsCount: input.items.length, assigneeName: input.assigneeName ?? null },
    actorId: me.id,
    actorName: me.fullName,
  });

  if (input.assigneeUserId) {
    await notifyUser(pool, {
      userId: input.assigneeUserId,
      kind: "assignment_created",
      title: "Новое задание на отгрузку",
      body: input.title || null,
      link: `/#/assignment/${assignmentId}`,
      entityId: assignmentId,
      actorId: me.id,
      actorName: me.fullName,
    });
  }

  const dto = await loadAssignment(pool, assignmentId);
  if (!dto) throw new AssignmentValidationError("Не удалось создать задание.", "INTERNAL_ERROR");
  return dto;
}

async function canUserCreateForTradePoint(
  pool: PoolLike,
  me: AssignmentSessionUser,
  dealerId: string,
  tradePointId: string,
): Promise<boolean> {
  const tpCheck = await pool.query<{ dealer_id: string }>(
    `SELECT dealer_id FROM trade_point_overrides WHERE tp_id = $1 LIMIT 1`,
    [tradePointId],
  );
  const row = tpCheck.rows[0];
  if (!row) return false;
  if (String(row.dealer_id) !== dealerId) return false;
  if (isElevated(me)) return true;
  const resolved = await resolveResponsiblesForTradePoint(pool, tradePointId);
  if (me.role === "rop") return resolved.rop.userId === me.id;
  if (me.role === "regional_manager") return resolved.regional_manager.userId === me.id;
  return false;
}

export async function handleCreate(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; assignment: AssignmentDto }> {
  assertActive(me);
  if (!CREATE_ROLES.has(me.role)) throw new AssignmentValidationError("Недостаточно прав для создания задания.", "FORBIDDEN");
  const input = parseCreateInput(body);
  const assignment = await insertAssignmentFromInput(pool, me, input);
  return { success: true, assignment };
}

export type AssignmentBatchTargetInput = { dealerId: string; tradePointId: string };
export type AssignmentBatchCreateInput = {
  targets: AssignmentBatchTargetInput[];
  items: AssignmentCreateItemInput[];
  title?: string;
  comment?: string | null;
  dueDate?: string | null;
  assigneeUserId?: string | null;
  assigneeName?: string | null;
};

function parseBatchCreateInput(body: Record<string, unknown>): AssignmentBatchCreateInput {
  const rawTargets = Array.isArray(body.targets) ? body.targets : [];
  const targets: AssignmentBatchTargetInput[] = [];
  for (const t of rawTargets) {
    if (!t || typeof t !== "object") continue;
    const obj = t as Record<string, unknown>;
    const dealerId = str(obj.dealerId);
    const tradePointId = str(obj.tradePointId);
    if (!dealerId || !tradePointId) continue;
    targets.push({ dealerId, tradePointId });
  }
  if (targets.length === 0) throw new AssignmentValidationError("Нужна хотя бы одна цель (targets).");

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items: AssignmentCreateItemInput[] = [];
  for (const it of rawItems) {
    if (!it || typeof it !== "object") continue;
    const obj = it as Record<string, unknown>;
    const targetId = str(obj.targetId);
    if (!targetId) continue;
    const kind = str(obj.targetKind);
    items.push({
      targetId,
      targetKind: kind === "variant" ? "variant" : "model",
      modelName: str(obj.modelName) ?? "",
    });
  }
  if (items.length === 0) throw new AssignmentValidationError("Нужна хотя бы одна позиция.");

  const due = str(body.dueDate);
  const commentRaw = body.comment !== undefined ? body.comment : body.note;
  return {
    targets,
    items,
    title: str(body.title) ?? "",
    comment: optStr(commentRaw),
    dueDate: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
    assigneeUserId: optStr(body.assigneeUserId),
    assigneeName: optStr(body.assigneeName),
  };
}

export async function handleCreateBatch(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; assignments: AssignmentDto[]; createdCount: number; skippedCount: number }> {
  assertActive(me);
  if (!CREATE_ROLES.has(me.role)) {
    throw new AssignmentValidationError("Недостаточно прав для создания задания.", "FORBIDDEN");
  }
  const input = parseBatchCreateInput(body);
  const assignments: AssignmentDto[] = [];
  let skippedCount = 0;

  for (const target of input.targets) {
    try {
      const allowed = await canUserCreateForTradePoint(pool, me, target.dealerId, target.tradePointId);
      if (!allowed) {
        skippedCount += 1;
        continue;
      }

      let assigneeUserId = input.assigneeUserId ?? null;
      let assigneeName = input.assigneeName ?? null;
      if (!assigneeUserId) {
        const resolved = await resolveResponsiblesForTradePoint(pool, target.tradePointId);
        assigneeUserId = resolved.manager.userId ?? null;
        assigneeName = resolved.manager.userName ?? null;
        if (!assigneeUserId) {
          skippedCount += 1;
          continue;
        }
      }

      const assignment = await insertAssignmentFromInput(pool, me, {
        dealerId: target.dealerId,
        tradePointId: target.tradePointId,
        title: input.title ?? "",
        comment: input.comment ?? null,
        dueDate: input.dueDate,
        assigneeUserId,
        assigneeName,
        items: input.items,
      });
      assignments.push(assignment);
    } catch (e) {
      console.error("[showcase-assignments] batch target skipped", e);
      skippedCount += 1;
    }
  }

  return {
    success: true,
    assignments,
    createdCount: assignments.length,
    skippedCount,
  };
}

// ── get ─────────────────────────────────────────────────────────────────────
export async function handleGet(
  pool: PoolLike,
  me: AssignmentSessionUser,
  id: string | undefined,
): Promise<{ success: true; assignment: AssignmentDto }> {
  assertActive(me);
  if (!ANY_ROLE.has(me.role)) throw new AssignmentValidationError("Недостаточно прав.", "FORBIDDEN");
  if (!id) throw new AssignmentValidationError("id обязателен.");
  const dto = await loadAssignment(pool, id);
  if (!dto) throw new AssignmentValidationError("Задание не найдено.", "NOT_FOUND");
  return { success: true, assignment: dto };
}

// ── list ────────────────────────────────────────────────────────────────────
export type AssignmentListFilter = {
  tradePointId?: string;
  dealerId?: string;
  assigneeUserId?: string;
  createdBy?: string;
  status?: string;
  mine?: boolean; // задания, где текущий пользователь — исполнитель
  includeArchived?: boolean;
  archivedOnly?: boolean;
};

export async function handleList(
  pool: PoolLike,
  me: AssignmentSessionUser,
  filter: AssignmentListFilter,
): Promise<{ success: true; assignments: AssignmentDto[] }> {
  assertActive(me);
  if (!ANY_ROLE.has(me.role)) throw new AssignmentValidationError("Недостаточно прав.", "FORBIDDEN");

  const conds: string[] = [];
  const params: unknown[] = [];
  const push = (sql: string, val: unknown) => {
    params.push(val);
    conds.push(sql.replace("$?", `$${params.length}`));
  };

  if (filter.tradePointId) push("trade_point_id = $?", filter.tradePointId);
  if (filter.dealerId) push("dealer_id = $?", filter.dealerId);
  if (filter.status) push("status = $?", filter.status);
  if (filter.archivedOnly) {
    conds.push("is_archived = true");
  } else if (!filter.includeArchived) {
    conds.push("is_archived = false");
  }
  // Менеджер видит только свои задания (как исполнитель), если не указано иное.
  if (filter.mine || me.role === "manager") {
    push("assignee_user_id = $?::uuid", me.id);
  } else {
    if (filter.assigneeUserId) push("assignee_user_id = $?::uuid", filter.assigneeUserId);
    if (filter.createdBy) push("created_by = $?::uuid", filter.createdBy);
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM showcase_install_assignments ${where} ORDER BY created_at DESC LIMIT 200`,
    params,
  );
  const assignments: AssignmentDto[] = [];
  for (const row of r.rows) {
    const items = await loadItems(pool, String(row.id));
    assignments.push(mapAssignmentRow(row, items));
  }
  return { success: true, assignments };
}

// ── item-toggle (менеджер отмечает отгрузку) ──────────────────────────────────
export async function handleItemToggle(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; assignment: AssignmentDto }> {
  assertActive(me);
  if (!ANY_ROLE.has(me.role)) throw new AssignmentValidationError("Недостаточно прав.", "FORBIDDEN");
  const assignmentId = str(body.assignmentId);
  const itemId = str(body.itemId);
  const done = body.done === true;
  if (!assignmentId || !itemId) throw new AssignmentValidationError("assignmentId и itemId обязательны.");

  const head = await loadAssignment(pool, assignmentId);
  if (!head) throw new AssignmentValidationError("Задание не найдено.", "NOT_FOUND");
  assertCanExecuteAssignment(me, head);
  if (head.status === "submitted") {
    throw new AssignmentValidationError("Задание уже отправлено.", "CONFLICT");
  }

  await pool.query(
    `UPDATE showcase_install_assignment_items
     SET done = $2,
         done_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
         done_by = CASE WHEN $2 THEN $3::uuid ELSE NULL END,
         done_by_name = CASE WHEN $2 THEN $4 ELSE NULL END,
         item_status = CASE
           WHEN $2 THEN 'shipped'
           WHEN item_status = 'installed' THEN 'installed'
           ELSE 'pending'
         END,
         problem_reason = CASE WHEN $2 THEN NULL ELSE problem_reason END,
         updated_at = NOW()
     WHERE id = $1 AND assignment_id = $5 AND item_status <> 'installed'`,
    [itemId, done, me.id, me.fullName, assignmentId],
  );

  // Перевести задание в in_progress при первой отметке.
  if (head.status === "open") {
    await pool.query(`UPDATE showcase_install_assignments SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [assignmentId]);
  }

  await insertEvent(pool, {
    assignmentId,
    kind: done ? "item_done" : "item_undone",
    targetId: itemId,
    actorId: me.id,
    actorName: me.fullName,
  });

  const dto = await loadAssignment(pool, assignmentId);
  return { success: true, assignment: dto! };
}

// ── item-set-status (менеджер: shipped / problem / pending + фото) ───────────
export async function handleItemSetStatus(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; assignment: AssignmentDto }> {
  assertActive(me);
  if (!ANY_ROLE.has(me.role)) throw new AssignmentValidationError("Недостаточно прав.", "FORBIDDEN");
  const assignmentId = str(body.assignmentId);
  const itemId = str(body.itemId);
  const itemStatusRaw = str(body.itemStatus);
  if (!assignmentId || !itemId || !itemStatusRaw) {
    throw new AssignmentValidationError("assignmentId, itemId и itemStatus обязательны.");
  }
  if (!ITEM_STATUS_VALUES.has(itemStatusRaw as AssignmentItemStatus) || itemStatusRaw === "installed") {
    throw new AssignmentValidationError("Недопустимый itemStatus.");
  }
  const itemStatus = itemStatusRaw as AssignmentItemStatus;

  const head = await loadAssignment(pool, assignmentId);
  if (!head) throw new AssignmentValidationError("Задание не найдено.", "NOT_FOUND");
  assertCanExecuteAssignment(me, head);
  if (head.status === "submitted") {
    throw new AssignmentValidationError("Задание уже отправлено.", "CONFLICT");
  }

  const item = head.items.find((i) => i.id === itemId);
  if (!item) throw new AssignmentValidationError("Позиция не найдена.", "NOT_FOUND");
  if (item.itemStatus === "installed") {
    throw new AssignmentValidationError("Позиция уже на витрине и не может быть изменена.", "CONFLICT");
  }

  const problemReason = optStr(body.problemReason);
  if (itemStatus === "problem" && !problemReason) {
    throw new AssignmentValidationError("Укажите причину проблемы.");
  }

  const photoUrl = optStr(body.photoUrl);
  const photoThumbUrl = optStr(body.photoThumbUrl);
  const shippedDate = parseOptionalDate(body.shippedDate);

  if (itemStatus === "shipped") {
    await pool.query(
      `UPDATE showcase_install_assignment_items
       SET item_status = 'shipped',
           done = TRUE,
           done_at = NOW(),
           done_by = $3::uuid,
           done_by_name = $4,
           problem_reason = NULL,
           photo_url = COALESCE($5, photo_url),
           photo_thumb_url = COALESCE($6, photo_thumb_url),
           shipped_date = COALESCE($7::date, shipped_date),
           updated_at = NOW()
       WHERE id = $1 AND assignment_id = $2`,
      [itemId, assignmentId, me.id, me.fullName, photoUrl, photoThumbUrl, shippedDate],
    );
  } else if (itemStatus === "problem") {
    await pool.query(
      `UPDATE showcase_install_assignment_items
       SET item_status = 'problem',
           done = FALSE,
           done_at = NULL,
           done_by = NULL,
           done_by_name = NULL,
           problem_reason = $3,
           photo_url = COALESCE($4, photo_url),
           photo_thumb_url = COALESCE($5, photo_thumb_url),
           updated_at = NOW()
       WHERE id = $1 AND assignment_id = $2`,
      [itemId, assignmentId, problemReason, photoUrl, photoThumbUrl],
    );
  } else {
    await pool.query(
      `UPDATE showcase_install_assignment_items
       SET item_status = 'pending',
           done = FALSE,
           done_at = NULL,
           done_by = NULL,
           done_by_name = NULL,
           problem_reason = NULL,
           photo_url = COALESCE($3, photo_url),
           photo_thumb_url = COALESCE($4, photo_thumb_url),
           updated_at = NOW()
       WHERE id = $1 AND assignment_id = $2`,
      [itemId, assignmentId, photoUrl, photoThumbUrl],
    );
  }

  if (head.status === "open") {
    await pool.query(
      `UPDATE showcase_install_assignments SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
      [assignmentId],
    );
  }

  await insertEvent(pool, {
    assignmentId,
    kind: "item_status",
    targetId: itemId,
    payload: { itemStatus, problemReason: problemReason ?? null },
    actorId: me.id,
    actorName: me.fullName,
  });

  const dto = await loadAssignment(pool, assignmentId);
  return { success: true, assignment: dto! };
}

// ── submit (менеджер завершил) ────────────────────────────────────────────────
export async function handleSubmit(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; assignment: AssignmentDto }> {
  assertActive(me);
  const assignmentId = str(body.assignmentId);
  if (!assignmentId) throw new AssignmentValidationError("assignmentId обязателен.");
  const head = await loadAssignment(pool, assignmentId);
  if (!head) throw new AssignmentValidationError("Задание не найдено.", "NOT_FOUND");
  assertCanExecuteAssignment(me, head);
  if (head.status === "submitted" || head.status === "verified" || head.status === "closed") {
    throw new AssignmentValidationError("Задание уже отправлено.", "CONFLICT");
  }

  const shippedDate = parseOptionalDate(body.shippedDate);
  const comment = str(body.comment);

  await pool.query(
    `UPDATE showcase_install_assignments
     SET status = 'submitted',
         submitted_at = NOW(),
         updated_at = NOW(),
         shipped_date = COALESCE($2::date, shipped_date),
         comment = CASE WHEN $3::text IS NOT NULL AND $3::text <> '' THEN $3::text ELSE comment END
     WHERE id = $1`,
    [assignmentId, shippedDate, comment ?? null],
  );
  await insertEvent(pool, { assignmentId, kind: "submitted", actorId: me.id, actorName: me.fullName });

  if (head.createdBy) {
    await notifyUser(pool, {
      userId: head.createdBy,
      kind: "assignment_submitted",
      title: "Задание выполнено менеджером",
      body: head.title,
      link: `/#/assignment/${assignmentId}`,
      entityId: assignmentId,
      actorId: me.id,
      actorName: me.fullName,
    });
  }

  const dto = await loadAssignment(pool, assignmentId);
  return { success: true, assignment: dto! };
}

// ── verify (регионал подтверждает «на витрине») ──────────────────────────────
export async function handleVerify(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; assignment: AssignmentDto }> {
  assertActive(me);
  if (!VERIFY_ROLES.has(me.role)) throw new AssignmentValidationError("Недостаточно прав для подтверждения.", "FORBIDDEN");
  const assignmentId = str(body.assignmentId);
  if (!assignmentId) throw new AssignmentValidationError("assignmentId обязателен.");
  // Список itemId, которые подтверждаются «на витрине». Если не указано — подтверждаются все done-позиции.
  const rawIds = Array.isArray(body.itemIds) ? body.itemIds.map((x) => String(x)) : null;

  const head = await loadAssignment(pool, assignmentId);
  if (!head) throw new AssignmentValidationError("Задание не найдено.", "NOT_FOUND");

  const toVerify = head.items.filter((i) => {
    if (rawIds) return rawIds.includes(i.id);
    return i.done; // по умолчанию все отгруженные
  });

  const matrixSession: ShowcaseMatrixSessionUser = {
    id: me.id,
    role: me.role,
    status: me.status,
    fullName: me.fullName,
  };

  for (const item of toVerify) {
    // Пометить позицию verified.
    await pool.query(
      `UPDATE showcase_install_assignment_items
       SET verified = TRUE, verified_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND assignment_id = $2`,
      [item.id, assignmentId],
    );
    // Перевести запись матрицы в installed (источник правды по витрине).
    await upsertShowcaseMatrixEntry(pool, matrixSession, {
      dealerId: head.dealerId,
      tradePointId: head.tradePointId,
      targetKind: item.targetKind,
      targetId: item.targetId,
      status: "installed",
      comment: `Подтверждено по заданию ${assignmentId.slice(0, 8)}`,
    });
    await insertEvent(pool, {
      assignmentId,
      kind: "verified",
      targetId: item.targetId,
      actorId: me.id,
      actorName: me.fullName,
    });
  }

  // Если все позиции задания подтверждены — задание verified, иначе остаётся submitted/in_progress.
  const after = await loadAssignment(pool, assignmentId);
  const allVerified = after!.items.length > 0 && after!.items.every((i) => i.verified);
  if (allVerified) {
    await pool.query(
      `UPDATE showcase_install_assignments SET status = 'verified', verified_at = NOW(), verified_by = $2::uuid, verified_by_name = $3, updated_at = NOW() WHERE id = $1`,
      [assignmentId, me.id, me.fullName],
    );
  } else {
    await pool.query(`UPDATE showcase_install_assignments SET updated_at = NOW() WHERE id = $1`, [assignmentId]);
  }

  const verifiedCount = toVerify.length;
  if (verifiedCount > 0) {
    const notifyBody = `${verifiedCount} позиций подтверждено на витрине по заданию «${head.title}»`;
    const notifyLink = `/#/assignment/${assignmentId}`;
    if (head.createdBy && head.createdBy !== me.id) {
      await notifyUser(pool, {
        userId: head.createdBy,
        kind: "assignment_verified",
        title: "Витрина подтверждена",
        body: notifyBody,
        link: notifyLink,
        entityId: assignmentId,
        actorId: me.id,
        actorName: me.fullName,
      });
    }
    if (
      head.assigneeUserId &&
      head.assigneeUserId !== me.id &&
      head.assigneeUserId !== head.createdBy
    ) {
      await notifyUser(pool, {
        userId: head.assigneeUserId,
        kind: "assignment_verified",
        title: "Витрина подтверждена",
        body: notifyBody,
        link: notifyLink,
        entityId: assignmentId,
        actorId: me.id,
        actorName: me.fullName,
      });
    }
  }

  const dto = await loadAssignment(pool, assignmentId);
  return { success: true, assignment: dto! };
}

// ── followup (регионал создаёт новое задание по неподтверждённым позициям) ────
export async function handleFollowup(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; assignment: AssignmentDto }> {
  assertActive(me);
  if (!CREATE_ROLES.has(me.role)) throw new AssignmentValidationError("Недостаточно прав.", "FORBIDDEN");
  const sourceId = str(body.assignmentId);
  if (!sourceId) throw new AssignmentValidationError("assignmentId обязателен.");
  const source = await loadAssignment(pool, sourceId);
  if (!source) throw new AssignmentValidationError("Исходное задание не найдено.", "NOT_FOUND");

  // Берём позиции, которые НЕ подтверждены (не стоят на витрине).
  const pending = source.items.filter((i) => !i.verified);
  if (pending.length === 0) throw new AssignmentValidationError("Нет неподтверждённых позиций для нового задания.");

  const created = await handleCreate(pool, me, {
    dealerId: source.dealerId,
    tradePointId: source.tradePointId,
    title: source.title ? `Повтор: ${source.title}` : "Повторное задание на отгрузку",
    comment: optStr(body.comment),
    dueDate: optStr(body.dueDate),
    assigneeUserId: source.assigneeUserId,
    assigneeName: source.assigneeName,
    items: pending.map((i) => ({ targetKind: i.targetKind, targetId: i.targetId, modelName: i.modelName })),
  });

  await insertEvent(pool, {
    assignmentId: sourceId,
    kind: "followup",
    payload: { newAssignmentId: created.assignment.id, itemsCount: pending.length },
    actorId: me.id,
    actorName: me.fullName,
  });

  return created;
}

// ── close ─────────────────────────────────────────────────────────────────────
export async function handleClose(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; assignment: AssignmentDto }> {
  assertActive(me);
  if (!CREATE_ROLES.has(me.role)) throw new AssignmentValidationError("Недостаточно прав.", "FORBIDDEN");
  const assignmentId = str(body.assignmentId);
  if (!assignmentId) throw new AssignmentValidationError("assignmentId обязателен.");
  await pool.query(`UPDATE showcase_install_assignments SET status = 'closed', updated_at = NOW() WHERE id = $1`, [assignmentId]);
  await insertEvent(pool, { assignmentId, kind: "closed", actorId: me.id, actorName: me.fullName });
  const dto = await loadAssignment(pool, assignmentId);
  return { success: true, assignment: dto! };
}

// ── update (создатель / elevated) ───────────────────────────────────────────
export async function handleUpdate(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; assignment: AssignmentDto }> {
  assertActive(me);
  const assignmentId = str(body.assignmentId);
  if (!assignmentId) throw new AssignmentValidationError("assignmentId обязателен.");
  const head = await loadAssignment(pool, assignmentId);
  if (!head) throw new AssignmentValidationError("Задание не найдено.", "NOT_FOUND");
  if (!canManageAssignment(me, head)) {
    throw new AssignmentValidationError("Недостаточно прав.", "FORBIDDEN");
  }
  if (head.status === "verified" || head.status === "closed") {
    throw new AssignmentValidationError("Завершённое задание нельзя редактировать.", "CONFLICT");
  }

  const titleRaw = body.title !== undefined ? str(body.title) : undefined;
  const titleParam = titleRaw && titleRaw.length > 0 ? titleRaw : null;
  const commentParam = body.comment !== undefined ? optStr(body.comment) : null;
  const dueParam = body.dueDate !== undefined ? parseOptionalDate(body.dueDate) : null;
  const assigneeIdParam = body.assigneeUserId !== undefined ? optStr(body.assigneeUserId) : null;
  const assigneeNameParam = body.assigneeName !== undefined ? optStr(body.assigneeName) : null;
  const prevAssignee = head.assigneeUserId;

  await pool.query(
    `UPDATE showcase_install_assignments SET
       title = CASE WHEN $2::text IS NOT NULL THEN $2::text ELSE title END,
       comment = CASE WHEN $8::boolean THEN $3::text ELSE comment END,
       due_date = CASE WHEN $4::boolean THEN $5::date ELSE due_date END,
       assignee_user_id = CASE WHEN $6::boolean THEN $7::uuid ELSE assignee_user_id END,
       assignee_name = CASE WHEN $9::boolean THEN $10::text ELSE assignee_name END,
       updated_at = NOW()
     WHERE id = $1`,
    [
      assignmentId,
      titleParam,
      commentParam,
      body.dueDate !== undefined,
      dueParam,
      body.assigneeUserId !== undefined,
      assigneeIdParam,
      body.comment !== undefined,
      body.assigneeName !== undefined,
      assigneeNameParam,
    ],
  );

  const dto = (await loadAssignment(pool, assignmentId))!;
  const newAssignee = dto.assigneeUserId;
  if (body.assigneeUserId !== undefined && newAssignee && newAssignee !== prevAssignee) {
    await notifyUser(pool, {
      userId: newAssignee,
      kind: "assignment_reassigned",
      title: "Вам назначено задание",
      body: dto.title,
      link: `/#/assignment/${assignmentId}`,
      entityId: assignmentId,
      actorId: me.id,
      actorName: me.fullName,
    });
  }

  await insertEvent(pool, {
    assignmentId,
    kind: "updated",
    actorId: me.id,
    actorName: me.fullName,
  });

  return { success: true, assignment: dto };
}

// ── archive / unarchive ───────────────────────────────────────────────────────
export async function handleArchive(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; archived: number; skipped: number }> {
  assertActive(me);
  const ids = parseAssignmentIds(body);
  if (ids.length === 0) throw new AssignmentValidationError("Укажите assignmentId или assignmentIds.");
  let archived = 0;
  let skipped = 0;
  for (const id of ids) {
    const head = await loadAssignment(pool, id);
    if (!head || !canManageAssignment(me, head)) {
      skipped++;
      continue;
    }
    await pool.query(
      `UPDATE showcase_install_assignments SET is_archived = true, archived_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
    await insertEvent(pool, { assignmentId: id, kind: "archived", actorId: me.id, actorName: me.fullName });
    archived++;
  }
  return { success: true, archived, skipped };
}

export async function handleUnarchive(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; unarchived: number; skipped: number }> {
  assertActive(me);
  const ids = parseAssignmentIds(body);
  if (ids.length === 0) throw new AssignmentValidationError("Укажите assignmentId или assignmentIds.");
  let unarchived = 0;
  let skipped = 0;
  for (const id of ids) {
    const head = await loadAssignment(pool, id);
    if (!head || !canManageAssignment(me, head)) {
      skipped++;
      continue;
    }
    await pool.query(
      `UPDATE showcase_install_assignments SET is_archived = false, archived_at = NULL, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    await insertEvent(pool, { assignmentId: id, kind: "unarchived", actorId: me.id, actorName: me.fullName });
    unarchived++;
  }
  return { success: true, unarchived, skipped };
}

// ── delete (жёсткое) ──────────────────────────────────────────────────────────
export async function handleDelete(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; deleted: number; skipped: number }> {
  assertActive(me);
  const ids = parseAssignmentIds(body);
  if (ids.length === 0) throw new AssignmentValidationError("Укажите assignmentId или assignmentIds.");
  const toDelete: string[] = [];
  let skipped = 0;
  for (const id of ids) {
    const head = await loadAssignment(pool, id);
    if (!head || !canManageAssignment(me, head)) {
      skipped++;
      continue;
    }
    toDelete.push(id);
  }
  if (toDelete.length > 0) {
    await pool.query(`DELETE FROM showcase_install_assignment_items WHERE assignment_id = ANY($1::uuid[])`, [toDelete]);
    await pool.query(`DELETE FROM showcase_install_assignment_events WHERE assignment_id = ANY($1::uuid[])`, [toDelete]);
    await pool.query(`DELETE FROM showcase_install_assignment_comments WHERE assignment_id = ANY($1::uuid[])`, [toDelete]);
    await pool.query(`DELETE FROM showcase_install_assignments WHERE id = ANY($1::uuid[])`, [toDelete]);
  }
  return { success: true, deleted: toDelete.length, skipped };
}

// ── remind ────────────────────────────────────────────────────────────────────
export async function handleRemind(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; reminded: number; skipped: number }> {
  assertActive(me);
  const ids = parseAssignmentIds(body);
  if (ids.length === 0) throw new AssignmentValidationError("Укажите assignmentId или assignmentIds.");
  let reminded = 0;
  let skipped = 0;
  for (const id of ids) {
    const head = await loadAssignment(pool, id);
    if (!head || !canManageAssignment(me, head)) {
      skipped++;
      continue;
    }
    if (!head.assigneeUserId || head.status === "verified" || head.status === "closed") {
      skipped++;
      continue;
    }
    await notifyUser(pool, {
      userId: head.assigneeUserId,
      kind: "assignment_reminder",
      title: "Напоминание о задании",
      body: head.title,
      link: `/#/assignment/${id}`,
      entityId: id,
      actorId: me.id,
      actorName: me.fullName,
    });
    reminded++;
  }
  return { success: true, reminded, skipped };
}

// ── comments ──────────────────────────────────────────────────────────────────
export async function handleListComments(
  pool: PoolLike,
  me: AssignmentSessionUser,
  assignmentId: string | undefined,
): Promise<{ success: true; comments: AssignmentCommentDto[] }> {
  assertActive(me);
  if (!assignmentId) throw new AssignmentValidationError("assignmentId обязателен.");
  const head = await loadAssignment(pool, assignmentId);
  if (!head) throw new AssignmentValidationError("Задание не найдено.", "NOT_FOUND");
  if (!canAccessAssignmentComments(me, head)) {
    throw new AssignmentValidationError("Недостаточно прав.", "FORBIDDEN");
  }
  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM showcase_install_assignment_comments WHERE assignment_id = $1 ORDER BY created_at ASC`,
    [assignmentId],
  );
  return { success: true, comments: r.rows.map(mapCommentRow) };
}

export async function handleAddComment(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; comment: AssignmentCommentDto }> {
  assertActive(me);
  const assignmentId = str(body.assignmentId);
  if (!assignmentId) throw new AssignmentValidationError("assignmentId обязателен.");
  const text = str(body.body);
  if (!text) throw new AssignmentValidationError("Укажите текст комментария.");
  const head = await loadAssignment(pool, assignmentId);
  if (!head) throw new AssignmentValidationError("Задание не найдено.", "NOT_FOUND");
  if (!canAccessAssignmentComments(me, head)) {
    throw new AssignmentValidationError("Недостаточно прав.", "FORBIDDEN");
  }

  const ins = await pool.query<Record<string, unknown>>(
    `INSERT INTO showcase_install_assignment_comments (assignment_id, author_id, author_name, author_role, body)
     VALUES ($1, $2::uuid, $3, $4, $5)
     RETURNING *`,
    [assignmentId, me.id, me.fullName, me.role, text],
  );
  const comment = mapCommentRow(ins.rows[0]!);

  const notifyTarget =
    me.id === head.createdBy
      ? head.assigneeUserId && head.assigneeUserId !== me.id
        ? head.assigneeUserId
        : null
      : head.createdBy && head.createdBy !== me.id
        ? head.createdBy
        : null;
  if (notifyTarget) {
    await notifyUser(pool, {
      userId: notifyTarget,
      kind: "assignment_comment",
      title: "Новый комментарий к заданию",
      body: head.title,
      link: `/#/assignment/${assignmentId}`,
      entityId: assignmentId,
      actorId: me.id,
      actorName: me.fullName,
    });
  }

  await insertEvent(pool, {
    assignmentId,
    kind: "comment",
    payload: { commentId: comment.id },
    actorId: me.id,
    actorName: me.fullName,
  });

  return { success: true, comment };
}
