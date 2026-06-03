export type GroupedProperty = { name: string; value: string };
export type PropertyGroup = { title: string; properties: GroupedProperty[] };

/** Collapse property/description values longer than this in buyer product card UI. */
export const LONG_VALUE_THRESHOLD = 160;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeCode(s: string | null | undefined): boolean {
  if (!s) return true;
  const t = s.trim();
  if (!t) return true;
  if (UUID_RE.test(t)) return true;
  if (t.length >= 16 && !t.includes(" ") && /^[0-9a-f-]+$/i.test(t)) return true;
  return false;
}

const HIDDEN_PATTERNS: RegExp[] = [
  /^ссылка/i,
  /ссылка/i,
  /^guid/i,
  /guid$/i,
  /идентификатор/i,
  /^акция(действует|сайт|период)/i,
  /^акция/i,
  /^сайт\s/i,
  /^код\s+для\s+маркетплейс/i,
  /^артикул\s+для\s+маркетплейс/i,
  /^id[\s_]/i,
  /^главная$/i,
  /^главная\s*\(бот\)/i,
  /\(бот\)/i,
  /^тип\s+товара$/i,
  /^хит\s+продаж$/i,
  /^новинка$/i,
  /^акция$/i,
  /^название\s+для\s+сайта$/i,
  /_опт(овик)?$/i,
  /маркетплейс/i,
];

const DESCRIPTION_NAMES = new Set(["описание", "описание для сайта"]);

const SHORT_PRIORITY = [
  "Покрытие",
  "Толщина",
  "Тип погонажа",
  "Размер, мм",
  "Цвет",
  "Материал",
];

const GROUPS: { title: string; match: (name: string) => boolean }[] = [
  { title: "Размеры и форма", match: (n) => /размер|толщин|ширин|высот|длин|вес|габарит/i.test(n) },
  { title: "Материал и покрытие", match: (n) => /материал|покрыт|цвет|поверхност|структур/i.test(n) },
  { title: "Эксплуатация", match: (n) => /эксплуатац|класс|нагрузк|тепл|влаг|устойчив|пожар/i.test(n) },
  { title: "Комплектация", match: (n) => /упаковк|комплект|количество|в одной|штук/i.test(n) },
  { title: "Производитель и гарантия", match: (n) => /производ|бренд|страна|гарант/i.test(n) },
];

function normName(name: string): string {
  return name.trim();
}

export function isDescriptionProperty(name: string): boolean {
  return DESCRIPTION_NAMES.has(name.trim().toLowerCase());
}

export function isHidden(name: string): boolean {
  const n = normName(name);
  if (!n) return true;
  if (isDescriptionProperty(n)) return true;
  return HIDDEN_PATTERNS.some((re) => re.test(n));
}

export function visibleProperties(props: GroupedProperty[]): GroupedProperty[] {
  return props.filter((p) => p.value.trim() !== "" && !isHidden(p.name));
}

export function pickShortProperties(props: GroupedProperty[]): GroupedProperty[] {
  const visible = visibleProperties(props);
  const picked: GroupedProperty[] = [];
  const used = new Set<string>();

  for (const label of SHORT_PRIORITY) {
    const found = visible.find((p) => p.name.trim().toLowerCase() === label.toLowerCase());
    if (found && !used.has(found.name)) {
      picked.push(found);
      used.add(found.name);
    }
    if (picked.length >= 3) break;
  }

  for (const p of visible) {
    if (picked.length >= 3) break;
    if (!used.has(p.name)) {
      picked.push(p);
      used.add(p.name);
    }
  }

  return picked.slice(0, 3);
}

export function groupProperties(props: GroupedProperty[]): PropertyGroup[] {
  const visible = visibleProperties(props);
  const assigned = new Set<GroupedProperty>();
  const result: PropertyGroup[] = [];

  for (const g of GROUPS) {
    const groupProps = visible.filter((p) => {
      if (assigned.has(p)) return false;
      return g.match(p.name);
    });
    for (const p of groupProps) assigned.add(p);
    if (groupProps.length > 0) {
      result.push({ title: g.title, properties: groupProps });
    }
  }

  const other = visible.filter((p) => !assigned.has(p));
  if (other.length > 0) {
    result.push({ title: "Другое", properties: other });
  }

  return result;
}
