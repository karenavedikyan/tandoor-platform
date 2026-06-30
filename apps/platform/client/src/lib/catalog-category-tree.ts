export type CatalogCategoryFlat = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order?: number | null;
  product_count: number;
};

export type CategoryTreeNode = CatalogCategoryFlat & {
  children: CategoryTreeNode[];
};

export function dedupeCategoriesById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function sortCategoryNodes(a: CatalogCategoryFlat, b: CatalogCategoryFlat): number {
  const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (sa !== sb) return sa - sb;
  return a.name.localeCompare(b.name, "ru");
}

export function buildCategoryTree(flat: CatalogCategoryFlat[]): CategoryTreeNode[] {
  const unique = dedupeCategoriesById(flat);
  const visible = unique.filter((c) => c.product_count > 0);
  const nodes = new Map<string, CategoryTreeNode>();
  for (const c of visible) {
    nodes.set(c.id, { ...c, children: [] });
  }

  const roots: CategoryTreeNode[] = [];
  for (const c of visible) {
    const node = nodes.get(c.id)!;
    if (c.parent_id == null) {
      roots.push(node);
      continue;
    }
    const parent = nodes.get(c.parent_id);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortRecursive = (list: CategoryTreeNode[]) => {
    list.sort(sortCategoryNodes);
    for (const n of list) sortRecursive(n.children);
  };
  sortRecursive(roots);
  return roots;
}

export function findCategoryPath(roots: CategoryTreeNode[], targetId: string): CategoryTreeNode[] {
  for (const root of roots) {
    const path = findPathFromNode(root, targetId);
    if (path) return path;
  }
  return [];
}

function findPathFromNode(node: CategoryTreeNode, targetId: string): CategoryTreeNode[] | null {
  if (node.id === targetId) return [node];
  for (const child of node.children) {
    const sub = findPathFromNode(child, targetId);
    if (sub) return [node, ...sub];
  }
  return null;
}

export type CategoryFilterLevels = {
  roots: CategoryTreeNode[];
  activeRootId: string | null;
  subsections: CategoryTreeNode[];
  activeSubsectionId: string | null;
  leaves: CategoryTreeNode[];
};

/** Уровни чипов для /catalog: корни → подразделы → листья выбранной ветки. */
export function resolveCategoryFilterLevels(
  flat: CatalogCategoryFlat[],
  selectedId: string,
): CategoryFilterLevels {
  const roots = buildCategoryTree(flat);
  const empty: CategoryFilterLevels = {
    roots,
    activeRootId: null,
    subsections: [],
    activeSubsectionId: null,
    leaves: [],
  };

  if (selectedId === "all") return empty;

  const path = findCategoryPath(roots, selectedId);
  if (path.length === 0) return empty;

  const root = path[0]!;
  const subsections = dedupeCategoriesById(root.children);

  if (path.length === 1) {
    return { roots, activeRootId: root.id, subsections, activeSubsectionId: null, leaves: [] };
  }

  const subsection = path[1]!;
  const leaves = dedupeCategoriesById(subsection.children);

  return {
    roots,
    activeRootId: root.id,
    subsections,
    activeSubsectionId: subsection.id,
    leaves,
  };
}
