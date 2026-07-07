/**
 * FIO matching between LK users.full_name and 1C manager name fields.
 */

export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

/** true, если все токены userFullName встречаются в oneCFullName */
export function nameMatches(userFullName: string, oneCFullName: string): boolean {
  const u = normalizeName(userFullName).split(" ").filter(Boolean);
  if (u.length === 0) return false;
  const o = new Set(normalizeName(oneCFullName).split(" ").filter(Boolean));
  return u.every((t) => o.has(t));
}

export function findMatchingOneCNames(userFullName: string, oneCNames: readonly string[]): string[] {
  if (!userFullName.trim()) return [];
  const matched: string[] = [];
  for (const oneCName of oneCNames) {
    if (oneCName && nameMatches(userFullName, oneCName)) {
      matched.push(oneCName);
    }
  }
  return matched;
}

export function buildReverseNameLookup(
  users: readonly { id: string; full_name: string }[],
  oneCNames: readonly string[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const oneCName of oneCNames) {
    if (!oneCName?.trim()) continue;
    for (const user of users) {
      if (nameMatches(user.full_name, oneCName)) {
        if (!map.has(oneCName)) map.set(oneCName, user.id);
        break;
      }
    }
  }
  return map;
}
