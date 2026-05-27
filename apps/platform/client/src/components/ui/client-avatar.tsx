import { useEffect, useState, type CSSProperties, type ReactElement } from "react";
import { cn } from "@/lib/utils";

/**
 * Палитра фолбэк-аватара клиента. Восемь акцентных цветов, подобраны для
 * читабельности на любом фоне (light/dark) при белом тексте — контраст AA+.
 *
 * Не используем токены темы намеренно: это акцент-индикатор, а не часть темы.
 */
const PALETTE: readonly string[] = [
  "#4C8DFF",
  "#A156D7",
  "#E0488B",
  "#F4791F",
  "#F2B636",
  "#1FB89F",
  "#4DB050",
  "#7A8290",
];

const ORG_SUFFIX_RE = /\b(?:ИП|ООО|ОАО|ЗАО|ПАО|АО|ИНН|ОГРН)\b\.?/gi;
const QUOTE_RE = /[«»“”"'`]/g;
const PAREN_RE = /\([^)]*\)/g;

/**
 * Достаёт инициалы из имени/названия клиента. Срезает оргсуффиксы (ИП/ООО/…),
 * скобки и кавычки. Возвращает 1-2 заглавных символа (UTF-8 safe).
 */
export function getClientInitials(name: string): string {
  const cleaned = (name || "")
    .replace(PAREN_RE, " ")
    .replace(QUOTE_RE, " ")
    .replace(ORG_SUFFIX_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "?";
  const words = cleaned.split(" ").filter((w) => w.length > 0);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    const w = words[0]!;
    return Array.from(w).slice(0, 2).join("").toUpperCase();
  }
  const first = Array.from(words[0]!)[0] ?? "";
  let secondWord = words[1]!;
  if (Array.from(secondWord).length < 1 && words[2]) {
    secondWord = words[2]!;
  }
  const second = Array.from(secondWord)[0] ?? "";
  return (first + second).toUpperCase();
}

/**
 * Детерминированный выбор цвета фолбэк-аватара по строке-сиду.
 * Простой 32-bit хэш ((h<<5)-h)+code | 0; |x| % palette.length.
 */
export function pickAvatarColor(seed: string): string {
  const s = (seed || "tandoor").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

export type ClientAvatarProps = {
  /** ФИО клиента / название юрлица — используется для инициалов и для seed (если нет id). */
  name?: string | null;
  /** Стабильный сид для цвета (обычно clientId или ИНН). Если не задан — используется name. */
  seed?: string | null;
  /** URL фото клиента. Если undefined/null/пусто — рендерится фолбэк с инициалами. */
  photoUrl?: string | null;
  /** Размер в пикселях. По умолчанию 40. */
  size?: number;
  /** Форма: круг (default) или скруглённый квадрат. */
  shape?: "circle" | "square";
  /** Доп. классы для корневого контейнера (не перекрывают inline width/height). */
  className?: string;
  /** Alt для <img>. По умолчанию — name. */
  alt?: string;
};

/**
 * Аватар клиента с детерминированным фолбэком на инициалы.
 *
 * - Если `photoUrl` задан и не сломан — рендерится `<img>` с object-fit: cover.
 * - Если фото нет ИЛИ загрузка упала (onError) — рендерим инициалы на цветном фоне.
 * - Цвет фона стабилен относительно `seed` (или `name`, если `seed` пуст).
 * - В фолбэке не делаем сетевых запросов.
 */
export function ClientAvatar(props: ClientAvatarProps): ReactElement {
  const { name, seed, photoUrl, size = 40, shape = "circle", className, alt } = props;
  const [broken, setBroken] = useState(false);

  // Сбрасываем флаг "сломанная картинка" при смене URL.
  useEffect(() => {
    setBroken(false);
  }, [photoUrl]);

  const text = (name ?? "").trim();
  const initials = getClientInitials(text);
  const colorSeed = ((seed ?? "").trim() || text || "tandoor").toLowerCase();
  const bg = pickAvatarColor(colorSeed);
  const safePhoto = typeof photoUrl === "string" ? photoUrl.trim() : "";
  const useImage = safePhoto.length > 0 && !broken;

  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: useImage ? "transparent" : bg,
    color: "#ffffff",
  };
  const fontSize = Math.max(12, Math.round(size * 0.42));

  return (
    <div
      data-testid="client-avatar"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden",
        shape === "circle" ? "rounded-full" : "rounded-xl",
        className,
      )}
      style={containerStyle}
      aria-label={alt ?? text ?? "Аватар клиента"}
      role="img"
    >
      {useImage ? (
        <img
          src={safePhoto}
          alt={alt ?? text}
          loading="lazy"
          onError={() => setBroken(true)}
          style={{ width: size, height: size, objectFit: "cover" }}
        />
      ) : (
        <span className="font-semibold leading-none" style={{ fontSize }}>
          {initials}
        </span>
      )}
    </div>
  );
}
