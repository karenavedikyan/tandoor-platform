"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type SafeImageProps = {
  src: string;
  alt?: string;
  className?: string;
  /** object-cover для превью в карточках */
  objectFit?: "cover" | "contain";
};

/**
 * Изображение с skeleton, fallback и повторной попыткой загрузки (без «залипания» в битом состоянии).
 */
export function SafeImage({ src, alt = "", className, objectFit = "cover" }: SafeImageProps) {
  const [phase, setPhase] = useState<"loading" | "ok" | "error">("loading");
  const [tryKey, setTryKey] = useState(0);

  useEffect(() => {
    setPhase("loading");
    setTryKey(0);
  }, [src]);

  const retry = useCallback(() => {
    setPhase("loading");
    setTryKey((k) => k + 1);
  }, []);

  if (!src.trim()) {
    return (
      <div
        className={cn("flex items-center justify-center bg-[#EEEFF6] text-[10px] font-medium text-[#8F96B0]", className)}
        data-testid="safe-image-empty"
      >
        Нет фото
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-1 bg-[#EEEFF6] p-2 text-center", className)}>
        <span className="text-[10px] font-medium text-[#8F96B0]">Не удалось загрузить</span>
        <button
          type="button"
          className="rounded border border-[#9ACA3C]/40 bg-[#FFFFFF] px-2 py-0.5 text-[10px] font-semibold text-[#222631] hover:bg-[#9ACA3C]/10"
          onClick={retry}
        >
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-[#EEEFF6]", className)}>
      {phase === "loading" ? (
        <div className="absolute inset-0 animate-pulse bg-[#E3E6F3]" aria-hidden data-testid="safe-image-skeleton" />
      ) : null}
      <img
        key={`${src}-${tryKey}`}
        src={src}
        alt={alt}
        className={cn("relative z-[1] h-full w-full", objectFit === "cover" ? "object-cover" : "object-contain")}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setPhase("ok")}
        onError={() => setPhase("error")}
      />
    </div>
  );
}
