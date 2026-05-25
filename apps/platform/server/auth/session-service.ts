import { and, eq, isNull } from "drizzle-orm";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { sessions } from "../../shared/auth-schema";
import { getAuthDb } from "./db";
import { sessionTtlSeconds } from "./session-ttl";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sha256Buffer(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function timingSafeEqualHex(storedHex: string, plainToken: string): boolean {
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHex, "hex");
  } catch {
    return false;
  }
  const computed = sha256Buffer(plainToken);
  if (stored.length !== computed.length) return false;
  return timingSafeEqual(stored, computed);
}

function newRefreshTokenOpaque(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(input: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<{ sessionId: string; refreshToken: string; expiresAt: string }> {
  const db = getAuthDb();
  if (!db) {
    throw new Error("Auth database is not configured (DATABASE_URL / POSTGRES_URL / NEON_DATABASE_URL).");
  }
  const refreshToken = newRefreshTokenOpaque();
  const refreshTokenHash = sha256Hex(refreshToken);
  const sessionId = randomUUID();
  const ttlSec = sessionTtlSeconds();
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();

  await db.insert(sessions).values({
    id: sessionId,
    userId: input.userId,
    refreshTokenHash,
    userAgent: input.userAgent ?? null,
    ip: input.ip ?? null,
    expiresAt,
    revokedAt: null,
  });

  return { sessionId, refreshToken, expiresAt };
}

export async function getSessionByRefreshToken(
  refreshToken: string,
): Promise<{ userId: string; sessionId: string; expiresAt: string } | null> {
  const db = getAuthDb();
  if (!db) return null;

  const hashHex = sha256Hex(refreshToken);
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.refreshTokenHash, hashHex), isNull(sessions.revokedAt)))
    .limit(1);

  if (rows.length !== 1) return null;
  const row = rows[0]!;

  if (!timingSafeEqualHex(row.refreshTokenHash, refreshToken)) return null;

  const ex = new Date(row.expiresAt).getTime();
  if (!Number.isFinite(ex) || ex <= Date.now()) return null;

  return { userId: row.userId, sessionId: row.id, expiresAt: row.expiresAt };
}

export async function revokeSession(sessionId: string): Promise<void> {
  const db = getAuthDb();
  if (!db) return;
  const now = new Date().toISOString();
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  const db = getAuthDb();
  if (!db) return;
  const now = new Date().toISOString();
  await db.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
