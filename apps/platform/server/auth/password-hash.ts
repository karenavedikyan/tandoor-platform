import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function isStrongEnough(
  plain: string,
  emailForCompare?: string,
): { ok: true } | { ok: false; reason: string } {
  const t = plain.trim();
  if (!t) return { ok: false, reason: "Пароль не может быть пустым." };
  if (t.length < 8) return { ok: false, reason: "Пароль должен быть не короче 8 символов." };
  if (emailForCompare?.trim()) {
    const e = emailForCompare.trim().toLowerCase();
    if (t.toLowerCase() === e) return { ok: false, reason: "Пароль не должен совпадать с email." };
  }
  return { ok: true };
}
