/**
 * Вызывается из `auth-seed-admin.mjs` через tsx (импорты `server/auth`, `@shared/*`).
 */
import { eq, sql } from "drizzle-orm";
import { authUsers } from "@shared/auth-schema";
import { getAuthDb } from "../server/auth/db";
import { hashPassword, isStrongEnough } from "../server/auth/password-hash";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`[auth-seed-admin] ${name} is required.`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const email = requireEnv("ADMIN_EMAIL").toLowerCase();
  const password = requireEnv("ADMIN_PASSWORD");
  const fullName = process.env.ADMIN_FULL_NAME?.trim() || "Администратор";
  requireEnv("DATABASE_URL");

  const strength = isStrongEnough(password, email);
  if (!strength.ok) {
    console.error(`[auth-seed-admin] ADMIN_PASSWORD: ${strength.reason}`);
    process.exit(1);
  }

  const db = getAuthDb();
  if (!db) {
    console.error("[auth-seed-admin] Auth database is not configured (DATABASE_URL).");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const existing = await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.email, email)).limit(1);

  if (existing[0]) {
    await db
      .update(authUsers)
      .set({
        passwordHash,
        role: "admin",
        status: "active",
        mustChangePassword: false,
        updatedAt: sql`now()`,
      })
      .where(eq(authUsers.email, email));
    console.log(`[auth-seed-admin] Updated admin user for ${email}.`);
    return;
  }

  await db.insert(authUsers).values({
    email,
    fullName,
    role: "admin",
    status: "active",
    passwordHash,
    mustChangePassword: false,
    createdBy: null,
    phone: null,
  });
  console.log(`[auth-seed-admin] Created admin user for ${email}.`);
}

main().catch((e) => {
  console.error("[auth-seed-admin]", e instanceof Error ? e.message : e);
  process.exit(1);
});
