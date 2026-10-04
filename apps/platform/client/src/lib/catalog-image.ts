/**
 * Оборачивает URL изображения в Vercel Image Optimization (/_vercel/image),
 * чтобы карточки получали лёгкие WebP-превью нужного размера вместо
 * мегабайтных оригиналов из Blob.
 *
 * width — целевая ширина в CSS-пикселях (берём с запасом ×2 под retina).
 * quality — 1..100.
 */
export function optimizedImage(
  src: string | null | undefined,
  width: number,
  quality = 70,
): string | null {
  if (!src) return null;
  if (!/^https?:\/\//i.test(src)) return src;
  // Timeweb serves prepared image assets; Vercel's optimizer is not available.
  if (import.meta.env.VITE_HOSTING_PROVIDER === "timeweb") return src;
  const w = Math.max(16, Math.round(width));
  const q = Math.min(100, Math.max(1, Math.round(quality)));
  return `/_vercel/image?url=${encodeURIComponent(src)}&w=${w}&q=${q}`;
}
