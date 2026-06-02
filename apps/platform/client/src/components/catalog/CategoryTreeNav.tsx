import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Folder, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type CatalogCategoryItem = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order?: number | null;
  product_count: number;
};

export type CategoryTreeNode = CatalogCategoryItem & {
  children: CategoryTreeNode[];
};

function sortNodes(a: CategoryTreeNode, b: CategoryTreeNode): number {
  const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (sa !== sb) return sa - sb;
  return a.name.localeCompare(b.name, "ru");
}

export function buildCategoryTree(flat: CatalogCategoryItem[]): CategoryTreeNode[] {
  const visible = flat.filter((c) => c.product_count > 0);
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
    list.sort(sortNodes);
    for (const n of list) sortRecursive(n.children);
  };
  sortRecursive(roots);
  return roots;
}

type TreePanelProps = {
  nodes: CategoryTreeNode[];
  depth: number;
  selectedId: string;
  openChain: string[];
  onHoverNode: (id: string, depth: number) => void;
  onSelect: (id: string) => void;
  onExpand: (id: string, depth: number) => void;
};

function DesktopTreePanel({
  nodes,
  depth,
  selectedId,
  openChain,
  onHoverNode,
  onSelect,
  onExpand,
}: TreePanelProps) {
  const isRootPanel = depth === 0;

  return (
    <ul
      className={cn(
        "m-0 list-none bg-white p-0",
        isRootPanel
          ? "w-[280px] shadow-[0_2px_20px_rgba(143,150,176,0.35)]"
          : "absolute left-full top-0 z-50 w-[280px] shadow-[0_5px_15px_rgba(143,150,176,0.3)]",
      )}
      role="list"
    >
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const isOpen = openChain[depth] === node.id;
        const isSelected = selectedId === node.id;

        return (
          <li
            key={node.id}
            className="relative"
            onMouseEnter={() => onHoverNode(node.id, depth)}
            data-testid={`catalog-category-node-${node.id}`}
          >
            <div
              className={cn(
                "flex min-h-[50px] items-center gap-1 border-b border-[#e3e6f3]/80 px-[19px] py-[15px] text-[#222631] transition-colors",
                depth === 0 && "hover:bg-[#9aca3c] hover:text-white [&_.node-muted]:hover:text-white/90",
                depth > 0 && "hover:bg-[#e5ffcb] hover:shadow-[inset_-3px_0_0_0_#9aca3c]",
                isSelected && depth === 0 && "bg-[#9aca3c] text-white [&_.node-muted]:text-white/90",
                isSelected && depth > 0 && "bg-[#e5ffcb] shadow-[inset_-3px_0_0_0_#9aca3c]",
              )}
            >
              <Folder
                className={cn(
                  "node-muted h-4 w-4 shrink-0 text-[#8f96b0]",
                  depth === 0 && "group-hover:text-white",
                )}
                aria-hidden
              />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                onClick={() => onSelect(node.id)}
              >
                {node.name}
                <span className="node-muted ml-1 text-xs font-normal text-[#8f96b0]">
                  {node.product_count.toLocaleString("ru-RU")}
                </span>
              </button>
              {hasChildren ? (
                <button
                  type="button"
                  className="node-muted flex h-8 w-8 shrink-0 items-center justify-center rounded text-[#8f96b0] hover:bg-black/5"
                  aria-label={`Раскрыть ${node.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpand(node.id, depth);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            {hasChildren && isOpen ? (
              <DesktopTreePanel
                nodes={node.children}
                depth={depth + 1}
                selectedId={selectedId}
                openChain={openChain}
                onHoverNode={onHoverNode}
                onSelect={onSelect}
                onExpand={onExpand}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function DesktopCategoryTree({
  roots,
  selectedId,
  onSelect,
}: {
  roots: CategoryTreeNode[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [openChain, setOpenChain] = useState<string[]>([]);

  const handleHover = (id: string, depth: number) => {
    setOpenChain((prev) => {
      const next = prev.slice(0, depth);
      next[depth] = id;
      return next;
    });
  };

  const handleExpand = (id: string, depth: number) => {
    handleHover(id, depth);
  };

  return (
    <div className="relative" onMouseLeave={() => setOpenChain([])}>
      <ul className="m-0 w-[280px] list-none bg-white p-0">
        <li>
          <button
            type="button"
            className={cn(
              "flex min-h-[50px] w-full items-center border-b border-[#e3e6f3]/80 px-[19px] py-[15px] text-left text-sm font-medium transition-colors",
              selectedId === "all"
                ? "bg-[#9aca3c] text-white"
                : "text-[#222631] hover:bg-[#9aca3c] hover:text-white",
            )}
            data-testid="catalog-category-node-all"
            onClick={() => onSelect("all")}
          >
            Все разделы
          </button>
        </li>
        {roots.map((node) => {
          const hasChildren = node.children.length > 0;
          const isOpen = openChain[0] === node.id;
          const isSelected = selectedId === node.id;
          return (
            <li
              key={node.id}
              className="relative"
              onMouseEnter={() => hasChildren && handleHover(node.id, 0)}
              data-testid={`catalog-category-node-${node.id}`}
            >
              <div
                className={cn(
                  "flex min-h-[50px] items-center gap-1 border-b border-[#e3e6f3]/80 px-[19px] py-[15px] text-[#222631] transition-colors",
                  "hover:bg-[#9aca3c] hover:text-white [&_.node-muted]:hover:text-white/90",
                  isSelected && "bg-[#9aca3c] text-white [&_.node-muted]:text-white/90",
                )}
              >
                <Folder className="node-muted h-4 w-4 shrink-0 text-[#8f96b0]" aria-hidden />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm font-medium"
                  onClick={() => onSelect(node.id)}
                >
                  {node.name}
                  <span className="node-muted ml-1 text-xs font-normal text-[#8f96b0]">
                    {node.product_count.toLocaleString("ru-RU")}
                  </span>
                </button>
                {hasChildren ? (
                  <button
                    type="button"
                    className="node-muted flex h-8 w-8 shrink-0 items-center justify-center text-[#8f96b0]"
                    aria-label={`Раскрыть ${node.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExpand(node.id, 0);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {hasChildren && isOpen ? (
                <DesktopTreePanel
                  nodes={node.children}
                  depth={1}
                  selectedId={selectedId}
                  openChain={openChain}
                  onHoverNode={handleHover}
                  onSelect={onSelect}
                  onExpand={handleExpand}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MobileCategoryTree({
  roots,
  selectedId,
  onSelect,
}: {
  roots: CategoryTreeNode[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [path, setPath] = useState<CategoryTreeNode[]>([]);
  const currentNodes = path.length === 0 ? roots : path[path.length - 1]!.children;
  const currentParent = path.length > 0 ? path[path.length - 1]! : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[#e3e6f3] px-[21px] py-3">
        <h2 className="text-[22px] font-semibold leading-[26px] text-foreground">Каталог</h2>
        {currentParent ? (
          <p className="mt-1 truncate text-sm text-[#7d8e9a]">{currentParent.name}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {path.length > 0 ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 bg-[#9aca3c] px-[19px] py-3 text-sm font-semibold text-white"
            onClick={() => setPath((p) => p.slice(0, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Назад
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "flex min-h-[50px] w-full items-center border-b border-[#e3e6f3] px-[19px] py-[15px] text-left text-sm font-medium",
              selectedId === "all" ? "bg-[#9aca3c] text-white" : "text-[#222631]",
            )}
            data-testid="catalog-category-node-all"
            onClick={() => onSelect("all")}
          >
            Все разделы
          </button>
        )}

        <ul className="m-0 list-none p-0">
          {currentNodes.map((node) => {
            const hasChildren = node.children.length > 0;
            const isSelected = selectedId === node.id;
            return (
              <li key={node.id} data-testid={`catalog-category-node-${node.id}`}>
                <div
                  className={cn(
                    "flex min-h-[50px] items-center gap-1 border-b border-[#e3e6f3]/80 px-[19px] py-[15px]",
                    isSelected && "bg-[#e5ffcb] shadow-[inset_-3px_0_0_0_#9aca3c]",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium text-[#222631]"
                    onClick={() => onSelect(node.id)}
                  >
                    {node.name}
                    <span className="ml-1 text-xs text-[#8f96b0]">
                      {node.product_count.toLocaleString("ru-RU")}
                    </span>
                  </button>
                  {hasChildren ? (
                    <button
                      type="button"
                      className="flex h-8 w-8 shrink-0 items-center justify-center text-[#8f96b0]"
                      aria-label={`Открыть подразделы ${node.name}`}
                      onClick={() => setPath((p) => [...p, node])}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

type CategoryTreeNavProps = {
  categories: CatalogCategoryItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CategoryTreeNav({
  categories,
  selectedId,
  onSelect,
  open,
  onOpenChange,
}: CategoryTreeNavProps) {
  const isMobile = useIsMobile();
  const roots = useMemo(() => buildCategoryTree(categories), [categories]);

  const triggerLabel = useMemo(() => {
    if (selectedId === "all") return "Каталог";
    const name = categories.find((c) => c.id === selectedId)?.name;
    return name ? `Каталог: ${name}` : "Каталог";
  }, [categories, selectedId]);

  const handleSelect = (id: string) => {
    onSelect(id);
    onOpenChange(false);
  };

  const triggerButton = (
    <Button
      type="button"
      size="sm"
      className="w-full gap-2 bg-[#9aca3c] text-white hover:bg-[#86b832]"
      data-testid="catalog-category-tree-open"
      aria-expanded={open}
    >
      <LayoutGrid className="h-4 w-4 shrink-0" />
      <span className="truncate text-xs font-semibold sm:text-sm">{triggerLabel}</span>
    </Button>
  );

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          size="sm"
          className="w-full gap-2 bg-[#9aca3c] text-white hover:bg-[#86b832]"
          data-testid="catalog-category-tree-open"
          aria-expanded={open}
          onClick={() => onOpenChange(true)}
        >
          <LayoutGrid className="h-4 w-4 shrink-0" />
          <span className="truncate text-xs font-semibold sm:text-sm">{triggerLabel}</span>
        </Button>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="left" className="flex w-[300px] max-w-[90vw] flex-col gap-0 overflow-hidden p-0">
            <SheetTitle className="sr-only">Каталог</SheetTitle>
            <MobileCategoryTree key={open ? "open" : "closed"} roots={roots} selectedId={selectedId} onSelect={handleSelect} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-auto max-w-none border-0 bg-transparent p-0 shadow-none"
      >
        <div className="overflow-hidden rounded-md border border-[#e3e6f3]">
          <div className="border-b border-[#e3e6f3] bg-white px-[19px] py-3">
            <h2 className="text-[22px] font-semibold leading-[26px] text-[#222631]">Каталог</h2>
          </div>
          <DesktopCategoryTree roots={roots} selectedId={selectedId} onSelect={handleSelect} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
