/**
 * Standalone smoke-проверка auth-цепочки (без Jest).
 *
 * ENV:
 *   BASE_URL (default: https://tandoor-platform.vercel.app)
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD
 */

type Json = Record<string, unknown>;

function step(n: number, ok: boolean, message: string): void {
  console.log(`[STEP ${n}] ${ok ? "OK" : "FAIL"} ${message}`);
}

function mergeCookieJar(prev: string, setCookie: string | null): string {
  if (!setCookie) return prev;
  const jar = new Map<string, string>();
  for (const part of prev.split(";").map((p) => p.trim()).filter(Boolean)) {
    const idx = part.indexOf("=");
    if (idx > 0) jar.set(part.slice(0, idx), part.slice(idx + 1));
  }
  const segments = setCookie.split(/,(?=[^;]+=)/);
  for (const seg of segments) {
    const first = seg.split(";")[0]?.trim();
    if (!first) continue;
    const idx = first.indexOf("=");
    if (idx > 0) jar.set(first.slice(0, idx), first.slice(idx + 1));
  }
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function readJson(res: Response): Promise<Json> {
  const t = await res.text();
  if (!t) return {};
  try {
    return JSON.parse(t) as Json;
  } catch {
    return {};
  }
}

function mustEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

function originFromBaseUrl(base: string): string {
  const u = new URL(base.includes("://") ? base : `https://${base}`);
  return u.origin;
}

async function main(): Promise<void> {
  const base = (process.env.BASE_URL?.trim() || "https://tandoor-platform.vercel.app").replace(/\/$/, "");
  const origin = originFromBaseUrl(base);
  const adminEmail = mustEnv("ADMIN_EMAIL");
  const adminPassword = mustEnv("ADMIN_PASSWORD");

  let adminCookie = "";
  let userCookie = "";

  const headersBase = {
    "Content-Type": "application/json",
    Origin: origin,
  } as Record<string, string>;

  // 1) admin login
  let adminUserId = "";
  {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: headersBase,
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const body = await readJson(res);
    const ok = res.ok && body.success === true;
    step(1, ok, ok ? "admin login" : `status=${res.status}`);
    if (!ok) process.exit(1);
    adminCookie = mergeCookieJar("", res.headers.get("set-cookie"));
    const u = body.user as { id?: string } | undefined;
    adminUserId = typeof u?.id === "string" ? u.id : "";
  }

  // 1b) cookie roundtrip: GET /api/auth/me сразу после login должен вернуть того же пользователя.
  // Это страховка от регрессий в ридере сессии (см. инцидент 17.06.2026 с PR #751).
  {
    const res = await fetch(`${base}/api/auth/me`, {
      method: "GET",
      headers: { ...headersBase, Cookie: adminCookie },
    });
    const body = await readJson(res);
    const u = body.user as { id?: string } | undefined;
    const sameUser = typeof u?.id === "string" && (!adminUserId || u.id === adminUserId);
    const ok = res.ok && body.success === true && sameUser;
    step(101, ok, ok ? "cookie roundtrip /api/auth/me" : `status=${res.status} success=${body.success} user=${u?.id ?? "none"}`);
    if (!ok) process.exit(1);
  }

  const ts = Date.now();
  const inviteEmail = `smoke-${ts}@tandoor.local`;
  const invitePassword = "SmokePass-9zZ-abcd";
  const redeemPassword = "SmokePass-9zZ-EFGH";
  const finalPassword = "SmokePass-9zZ-ZZZ9";

  // 2) create invitation
  let inviteToken = "";
  {
    const res = await fetch(`${base}/api/invitations/create`, {
      method: "POST",
      headers: { ...headersBase, Cookie: adminCookie },
      body: JSON.stringify({ email: inviteEmail, role: "manager", fullName: "Smoke User" }),
    });
    const body = await readJson(res);
    const ok = res.ok && body.success === true;
    step(2, ok, ok ? "invitation create" : `status=${res.status}`);
    if (!ok) process.exit(1);
    const inv = body.invitation as { acceptUrl?: string } | undefined;
    const url = typeof inv?.acceptUrl === "string" ? inv.acceptUrl : "";
    const m = url.match(/\/invite\/([^/?#]+)/);
    inviteToken = m?.[1] ?? "";
    if (!inviteToken) {
      step(2, false, "no token in acceptUrl");
      process.exit(1);
    }
  }

  // 3) accept invitation
  let smokeUserId = "";
  {
    const res = await fetch(`${base}/api/invitations/accept`, {
      method: "POST",
      headers: headersBase,
      body: JSON.stringify({ token: inviteToken, fullName: "Smoke User", password: invitePassword }),
    });
    const body = await readJson(res);
    const ok = res.ok && body.success === true;
    step(3, ok, ok ? "invitation accept" : `status=${res.status}`);
    if (!ok) process.exit(1);
    const u = body.user as { id?: string } | undefined;
    smokeUserId = typeof u?.id === "string" ? u.id : "";
    if (!smokeUserId) {
      step(3, false, "no user id");
      process.exit(1);
    }
    userCookie = mergeCookieJar("", res.headers.get("set-cookie"));
  }

  // 4) change role (admin)
  {
    const res = await fetch(`${base}/api/admin/users-update-role`, {
      method: "POST",
      headers: { ...headersBase, Cookie: adminCookie },
      body: JSON.stringify({ id: smokeUserId, role: "regional_manager" }),
    });
    const body = await readJson(res);
    const ok = res.ok && body.success === true;
    step(4, ok, ok ? "users-update-role" : `status=${res.status}`);
    if (!ok) process.exit(1);
  }

  // 5) password reset link create (admin)
  let resetToken = "";
  {
    const res = await fetch(`${base}/api/admin/password-reset-link-create`, {
      method: "POST",
      headers: { ...headersBase, Cookie: adminCookie },
      body: JSON.stringify({ userId: smokeUserId }),
    });
    const body = await readJson(res);
    const ok = res.ok && body.success === true;
    step(5, ok, ok ? "password-reset-link-create" : `status=${res.status}`);
    if (!ok) process.exit(1);
    resetToken = typeof body.token === "string" ? body.token : "";
    if (!resetToken) {
      step(5, false, "no reset token");
      process.exit(1);
    }
  }

  // 6) redeem reset link
  {
    const res = await fetch(`${base}/api/auth/password-reset-link-redeem`, {
      method: "POST",
      headers: headersBase,
      body: JSON.stringify({ token: resetToken, newPassword: redeemPassword }),
    });
    const body = await readJson(res);
    const ok = res.ok && body.success === true;
    step(6, ok, ok ? "password-reset-link-redeem" : `status=${res.status}`);
    if (!ok) process.exit(1);
  }

  // 7) login as smoke user with new password
  let smokeUserSelfId = "";
  {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: headersBase,
      body: JSON.stringify({ email: inviteEmail, password: redeemPassword }),
    });
    const body = await readJson(res);
    const ok = res.ok && body.success === true;
    step(7, ok, ok ? "login smoke user" : `status=${res.status}`);
    if (!ok) process.exit(1);
    userCookie = mergeCookieJar("", res.headers.get("set-cookie"));
    const u = body.user as { id?: string } | undefined;
    smokeUserSelfId = typeof u?.id === "string" ? u.id : "";
  }

  // 7b) cookie roundtrip для смок-юзера: GET /api/auth/me должен вернуть его же.
  {
    const res = await fetch(`${base}/api/auth/me`, {
      method: "GET",
      headers: { ...headersBase, Cookie: userCookie },
    });
    const body = await readJson(res);
    const u = body.user as { id?: string } | undefined;
    const sameUser = typeof u?.id === "string" && (!smokeUserSelfId || u.id === smokeUserSelfId);
    const ok = res.ok && body.success === true && sameUser;
    step(107, ok, ok ? "cookie roundtrip smoke /api/auth/me" : `status=${res.status} success=${body.success}`);
    if (!ok) process.exit(1);
  }

  // 8) change password self
  {
    const res = await fetch(`${base}/api/admin/profile-change-password`, {
      method: "POST",
      headers: { ...headersBase, Cookie: userCookie },
      body: JSON.stringify({ currentPassword: redeemPassword, newPassword: finalPassword }),
    });
    const body = await readJson(res);
    const ok = res.ok && body.success === true;
    step(8, ok, ok ? "profile-change-password" : `status=${res.status}`);
    if (!ok) process.exit(1);
    userCookie = mergeCookieJar(userCookie, res.headers.get("set-cookie"));
  }

  // 9) disable smoke user (admin)
  {
    const res = await fetch(`${base}/api/admin/users-update-status`, {
      method: "POST",
      headers: { ...headersBase, Cookie: adminCookie },
      body: JSON.stringify({ id: smokeUserId, status: "disabled" }),
    });
    const body = await readJson(res);
    const ok = res.ok && body.success === true;
    step(9, ok, ok ? "users-update-status disabled" : `status=${res.status}`);
    if (!ok) process.exit(1);
  }

  // 10) logout smoke user (best-effort)
  {
    const res = await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers: { ...headersBase, Cookie: userCookie },
    });
    const body = await readJson(res);
    const ok = res.ok && body.success === true;
    step(10, ok, ok ? "logout" : `status=${res.status}`);
    if (!ok) process.exit(1);
  }

  console.log("ALL PASS");
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
