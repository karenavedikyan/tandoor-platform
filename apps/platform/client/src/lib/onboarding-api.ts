/**
 * API онбординга первого входа (`/api/admin/onboarding-*`, `profile-telegram-link-token`).
 */

export type OnboardingStatusDTO = {
  mustChangePassword: boolean;
  profileNeedsUpdate: boolean;
  telegramLinked: boolean;
  completedAt: string | null;
};

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const t = await res.text();
    if (!t) return {};
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseStatus(j: Record<string, unknown>): OnboardingStatusDTO | null {
  if (j.success !== true) return null;
  const mustChangePassword = typeof j.mustChangePassword === "boolean" ? j.mustChangePassword : null;
  const profileNeedsUpdate = typeof j.profileNeedsUpdate === "boolean" ? j.profileNeedsUpdate : null;
  const telegramLinked = typeof j.telegramLinked === "boolean" ? j.telegramLinked : null;
  const completedAt =
    j.completedAt === null || j.completedAt === undefined
      ? null
      : typeof j.completedAt === "string"
        ? j.completedAt
        : null;
  if (mustChangePassword === null || profileNeedsUpdate === null || telegramLinked === null) return null;
  return { mustChangePassword, profileNeedsUpdate, telegramLinked, completedAt };
}

export async function fetchOnboardingStatus(): Promise<OnboardingStatusDTO> {
  const res = await fetch("/api/admin/onboarding-status", { method: "GET", credentials: "same-origin" });
  const j = await readJson(res);
  const s = parseStatus(j);
  if (!res.ok || !s) {
    const message = typeof j.message === "string" ? j.message : "Не удалось загрузить статус онбординга.";
    throw new Error(message);
  }
  return s;
}

export async function postOnboardingComplete(): Promise<void> {
  const res = await fetch("/api/admin/onboarding-complete", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const j = await readJson(res);
  if (!res.ok || j.success !== true) {
    const message = typeof j.message === "string" ? j.message : "Не удалось завершить онбординг.";
    throw new Error(message);
  }
}

export async function postTelegramLinkToken(): Promise<{ botUrl: string; expiresAt: string }> {
  const res = await fetch("/api/admin/profile-telegram-link-token", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const j = await readJson(res);
  if (!res.ok || j.success !== true) {
    const message = typeof j.message === "string" ? j.message : "Не удалось получить ссылку на бота.";
    throw new Error(message);
  }
  const botUrl = typeof j.botUrl === "string" ? j.botUrl : "";
  const expiresAt = typeof j.expiresAt === "string" ? j.expiresAt : "";
  if (!botUrl || !expiresAt) throw new Error("Некорректный ответ сервера.");
  return { botUrl, expiresAt };
}
