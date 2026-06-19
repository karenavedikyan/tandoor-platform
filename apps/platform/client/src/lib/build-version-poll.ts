import { toast } from "@/hooks/use-toast";

/**
 * Промт 434: периодически опрашиваем /api/health/version и сверяемся с meta-тегом,
 * который vite вшил в index.html во время билда. При расхождении — мягкий тост
 * и через короткую задержку window.location.reload() (handshake промта 433 при
 * необходимости очистит устаревший localStorage).
 */

const META_COMMIT_NAME = "tandoor-build-commit";
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 минут на focus
const RELOAD_DELAY_MS = 2500; // дать пользователю прочитать тост

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let reloadScheduled = false;

function getMetaCommit(): string | null {
  const el = document.querySelector(`meta[name="${META_COMMIT_NAME}"]`);
  const c = el?.getAttribute("content")?.trim();
  if (!c) return null;
  if (c === "__BUILD_COMMIT__") return null; // dev без vite-плагина — пропускаем
  if (c === "dev") return null; // локально — пропускаем
  return c;
}

async function fetchServerCommit(): Promise<string | null> {
  try {
    const r = await fetch("/api/health/version", {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { success?: boolean; commit?: string };
    if (!j.success || !j.commit) return null;
    if (j.commit === "dev") return null;
    return j.commit;
  } catch {
    return null;
  }
}

async function checkOnce(): Promise<void> {
  if (reloadScheduled) return;
  const local = getMetaCommit();
  if (!local) return;
  const remote = await fetchServerCommit();
  if (!remote) return;
  if (remote === local) return;

  reloadScheduled = true;
  // eslint-disable-next-line no-console
  console.info("[build-version] new version available", { local, remote });
  toast({
    title: "Доступна новая версия",
    description: "Сейчас обновим страницу.",
  });
  setTimeout(() => {
    try {
      window.location.reload();
    } catch {
      /* ignore */
    }
  }, RELOAD_DELAY_MS);
}

export function startBuildVersionPoll(): void {
  if (started) return;
  started = true;

  // Сразу при старте после первой загрузки (с маленькой задержкой, чтобы не конкурировать со стартапом)
  setTimeout(() => {
    void checkOnce();
  }, 30 * 1000);

  // Периодически
  timer = setInterval(() => {
    void checkOnce();
  }, POLL_INTERVAL_MS);

  // При возвращении фокуса (пользователь вернулся к вкладке после долгого отсутствия)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void checkOnce();
    }
  });
  window.addEventListener("focus", () => {
    void checkOnce();
  });
}

export function stopBuildVersionPollForTests(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
  reloadScheduled = false;
}

/** Для admin footer-бейджа: commit из meta-тега (null если dev / плейсхолдер). */
export function readBuildCommitFromMeta(): string | null {
  return getMetaCommit();
}
