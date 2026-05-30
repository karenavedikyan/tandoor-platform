export function isBriefNew(publishedAt: string | null | undefined): boolean {
  if (!publishedAt) return false;
  const published = new Date(publishedAt).getTime();
  if (Number.isNaN(published)) return false;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - published < sevenDaysMs;
}
