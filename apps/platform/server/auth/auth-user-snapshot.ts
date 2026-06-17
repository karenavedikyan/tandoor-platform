import { eq } from "drizzle-orm";
import type { UserRole, UserStatus } from "../../shared/auth.js";
import { authUsers } from "../../shared/auth-schema.js";
import { getAuthDb } from "./db";

export type AuthUserSnapshot = {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  /** Подпись админа-наблюдателя, если сессия создана через impersonation. */
  impersonatedBy?: string | null;
};

export async function loadAuthUserSnapshot(userId: string): Promise<AuthUserSnapshot | null> {
  const db = getAuthDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: authUsers.id,
      email: authUsers.email,
      fullName: authUsers.fullName,
      role: authUsers.role,
      status: authUsers.status,
      mustChangePassword: authUsers.mustChangePassword,
      lastLoginAt: authUsers.lastLoginAt,
    })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .limit(1);
  const u = rows[0];
  if (!u) return null;
  return {
    userId: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role as UserRole,
    status: u.status as UserStatus,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt ?? null,
  };
}
