import { useCallback, useEffect, useRef, useState } from "react";

export type SectionSavePhase = "idle" | "saving" | "success";

const SUCCESS_MS = 1800;

/**
 * Состояние кнопки «Сохранить» для блоков актуализации: сохраняем… → «Сохранено» (зелёная) → сброс.
 * Вызовите markDirty при изменении полей секции, чтобы сбросить «Сохранено» после правок.
 */
export function useSectionSaveFeedback() {
  const [phase, setPhase] = useState<SectionSavePhase>("idle");
  const [isDirty, setIsDirty] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const markDirty = useCallback(() => {
    clearTimer();
    setIsDirty(true);
    setPhase("idle");
  }, [clearTimer]);

  const runSave = useCallback(
    async (fn: () => Promise<boolean>) => {
      clearTimer();
      setPhase("saving");
      try {
        const ok = await fn();
        if (!ok) {
          setPhase("idle");
          return false;
        }
        setIsDirty(false);
        setPhase("success");
        timerRef.current = window.setTimeout(() => {
          setPhase("idle");
          timerRef.current = null;
        }, SUCCESS_MS);
        return true;
      } catch {
        setPhase("idle");
        return false;
      }
    },
    [clearTimer],
  );

  return { phase, isDirty, runSave, markDirty };
}
