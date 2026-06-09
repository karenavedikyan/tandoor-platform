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
  items: AssignmentItemDto[];
  // Сводка для UI.
  itemsTotal: number;
  itemsDone: number;
  itemsVerified: number;
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
    items,
    itemsTotal: items.length,
    itemsDone,
    itemsVerified,
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

export async function handleCreate(
  pool: PoolLike,
  me: AssignmentSessionUser,
  body: Record<string, unknown>,
): Promise<{ success: true; assignment: AssignmentDto }> {
  assertActive(me);
  if (!CREATE_ROLES.has(me.role)) throw new AssignmentValidationError("Недостаточно прав для создания задания.", "FORBIDDEN");
  const input = parseCreateInput(body);

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
  return { success: true, assignment: dto! };
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
