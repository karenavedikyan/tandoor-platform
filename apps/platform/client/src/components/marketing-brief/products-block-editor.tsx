import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClientAvatar } from "@/components/ui/client-avatar";
import {
  asProductsBlock,
  formatBriefPriceRub,
  newBriefBlockItemId,
  parseBriefPriceInput,
  productDisplayName,
  SegmentBadges,
  SegmentMultiSelect,
} from "@/components/marketing-brief/marketing-brief-block-shared";
import type { MarketingBriefBlockRow, ProductsBlockItem } from "@/lib/marketing-briefs-api";
import {
  getProductById,
  searchCatalog,
  snapshotCatalogProduct,
  type CatalogProduct,
} from "@/lib/catalog-data";
import { cn } from "@/lib/utils";

function ProductThumb({ item }: { item: ProductsBlockItem }) {
  const url = item.image_url?.trim();
  const name = productDisplayName(item);
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-12 w-12 shrink-0 rounded-lg border border-border/60 object-cover"
      />
    );
  }
  return <ClientAvatar size={48} shape="square" name={name} seed={item.id} className="shrink-0" />;
}

function SortableProductRow({
  item,
  readOnly,
  onEdit,
  onDelete,
}: {
  item: ProductsBlockItem;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: readOnly,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border/70 bg-muted/10 p-3",
        isDragging && "opacity-90 shadow-md",
      )}
    >
      <div className="flex gap-3">
        {!readOnly ? (
          <button
            type="button"
            className="mt-1 flex h-10 min-h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
            aria-label="Перетащить"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        <ProductThumb item={item} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-[#222631]">{productDisplayName(item)}</p>
          {item.article?.trim() ? (
            <p className="text-xs text-[#8F96B0]">Артикул: {item.article}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Цена-витрина: {formatBriefPriceRub(item.price_showroom)} · Цена-розница:{" "}
            {formatBriefPriceRub(item.price_retail)}
          </p>
          <SegmentBadges segments={item.segments} />
          {item.note?.trim() ? <p className="text-xs text-muted-foreground">{item.note}</p> : null}
          {!readOnly ? (
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={onEdit}>
                <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                Редактировать
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                Удалить
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type ProductFormState = {
  manual: boolean;
  catalog_id: string | null;
  name: string;
  article: string;
  image_url: string;
  price_showroom: string;
  price_retail: string;
  note: string;
  segments: ProductsBlockItem["segments"];
};

function itemToForm(item: ProductsBlockItem): ProductFormState {
  return {
    manual: item.manual,
    catalog_id: item.catalog_id ?? null,
    name: item.name ?? "",
    article: item.article ?? "",
    image_url: item.image_url ?? "",
    price_showroom: item.price_showroom != null ? String(item.price_showroom) : "",
    price_retail: item.price_retail != null ? String(item.price_retail) : "",
    note: item.note ?? "",
    segments: item.segments ?? [],
  };
}

function formToItem(base: ProductsBlockItem | null, form: ProductFormState): ProductsBlockItem {
  return {
    id: base?.id ?? newBriefBlockItemId(),
    manual: form.manual,
    catalog_id: form.catalog_id,
    name: form.name.trim() || undefined,
    article: form.article.trim() || undefined,
    image_url: form.image_url.trim() || undefined,
    price_showroom: parseBriefPriceInput(form.price_showroom),
    price_retail: parseBriefPriceInput(form.price_retail),
    note: form.note.trim() || undefined,
    segments: form.segments?.length ? form.segments : undefined,
  };
}

function ProductItemForm({
  form,
  setForm,
  readOnly,
}: {
  form: ProductFormState;
  setForm: (f: ProductFormState) => void;
  readOnly?: boolean;
}) {
  const [catalogQuery, setCatalogQuery] = useState("");
  const catalogProduct = form.catalog_id ? getProductById(form.catalog_id) : undefined;
  const catalogHref = form.catalog_id ? `/catalog/${form.catalog_id}` : null;
  const catalogResults = useMemo(() => searchCatalog(catalogQuery, 12), [catalogQuery]);

  function applyCatalogProduct(p: CatalogProduct) {
    const snap = snapshotCatalogProduct(p);
    setForm({
      ...form,
      manual: false,
      catalog_id: snap.catalog_id,
      name: snap.name,
      article: snap.article,
      image_url: snap.image_url ?? "",
      price_retail: snap.price_retail != null ? String(snap.price_retail) : form.price_retail,
    });
    setCatalogQuery("");
  }

  return (
    <div className="space-y-3" data-testid="product-item-form">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
        <Label className="text-xs font-medium">Источник товара</Label>
        <div className="flex items-center gap-2 text-xs">
          <span className={cn(!form.manual && "font-semibold text-[#222631]")}>Из каталога</span>
          <Switch
            checked={form.manual}
            disabled={readOnly}
            onCheckedChange={(checked) => setForm({ ...form, manual: checked })}
            data-testid="product-item-manual-toggle"
            aria-label="Ручной ввод"
          />
          <span className={cn(form.manual && "font-semibold text-[#222631]")}>Вручную</span>
        </div>
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Из каталога — выбор по моделям Тандор. Вручную — если модели нет в каталоге.
      </p>

      {!form.manual ? (
        <div className="space-y-2">
          <Label className="text-xs">Выбрать из каталога</Label>
          <Input
            placeholder="Поиск по названию, артикулу, серии…"
            value={catalogQuery}
            disabled={readOnly}
            onChange={(e) => setCatalogQuery(e.target.value)}
            data-testid="input-product-catalog-search"
          />
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/60 p-1">
            {catalogResults.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={readOnly}
                className={cn(
                  "flex w-full gap-2 rounded-md p-2 text-left text-sm hover:bg-muted/60",
                  form.catalog_id === p.id && "bg-[#9ACA3C]/10 ring-1 ring-[#9ACA3C]/40",
                )}
                onClick={() => applyCatalogProduct(p)}
              >
                {p.image ? (
                  <img src={p.image} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : null}
                <span className="min-w-0 truncate font-medium">{p.name}</span>
              </button>
            ))}
          </div>
          {form.catalog_id ? (
            <p className="text-xs text-[#5a7a28]">
              Выбран: {form.name || catalogProduct?.name}
              {catalogHref && catalogProduct ? (
                <>
                  {" · "}
                  <Link href={catalogHref} className="underline">
                    карточка
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label className="text-xs">Название</Label>
        <Input
          value={form.name}
          disabled={readOnly || (!form.manual && Boolean(form.catalog_id))}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <p className="text-[10px] leading-snug text-muted-foreground">
          Полное название модели и цвет, как в PDF-брифе.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Артикул</Label>
        <Input
          value={form.article}
          disabled={readOnly || (!form.manual && Boolean(form.catalog_id))}
          onChange={(e) => setForm({ ...form, article: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">URL фото</Label>
        <Input
          value={form.image_url}
          disabled={readOnly}
          onChange={(e) => setForm({ ...form, image_url: e.target.value })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Цена-витрина</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={form.price_showroom}
            disabled={readOnly}
            onChange={(e) => setForm({ ...form, price_showroom: e.target.value })}
          />
          <p className="text-[10px] leading-snug text-muted-foreground">В рублях. Можно оставить пустым.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Цена-розница</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={form.price_retail}
            disabled={readOnly}
            onChange={(e) => setForm({ ...form, price_retail: e.target.value })}
          />
          <p className="text-[10px] leading-snug text-muted-foreground">В рублях. Можно оставить пустым.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Сегменты</Label>
        <SegmentMultiSelect
          value={form.segments ?? []}
          disabled={readOnly}
          onChange={(segments) => setForm({ ...form, segments })}
        />
        <p className="text-[10px] leading-snug text-muted-foreground">К каким сегментам ТОП относится модель.</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Заметка</Label>
        <Textarea
          rows={2}
          value={form.note}
          disabled={readOnly}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
      </div>
    </div>
  );
}

function CatalogPickDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (item: ProductsBlockItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [form, setForm] = useState<ProductFormState | null>(null);

  const results = useMemo(() => searchCatalog(query, 30), [query]);

  function selectProduct(p: CatalogProduct) {
    setSelected(p);
    const snap = snapshotCatalogProduct(p);
    setForm({
      manual: false,
      catalog_id: snap.catalog_id,
      name: snap.name,
      article: snap.article,
      image_url: snap.image_url ?? "",
      price_showroom: "",
      price_retail: snap.price_retail != null ? String(snap.price_retail) : "",
      note: "",
      segments: [],
    });
  }

  function handleAdd() {
    if (!form || !form.name.trim()) return;
    onAdd(formToItem(null, form));
    onOpenChange(false);
    setQuery("");
    setSelected(null);
    setForm(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Добавить из каталога</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Input
              placeholder="Найти по названию, артикулу, серии…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="input-catalog-brief-search"
            />
            <div className="max-h-[min(50vh,360px)] space-y-1 overflow-y-auto rounded-lg border border-border/60 p-1">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={cn(
                    "flex w-full gap-2 rounded-md p-2 text-left hover:bg-muted/60",
                    selected?.id === p.id && "bg-[#9ACA3C]/10 ring-1 ring-[#9ACA3C]/40",
                  )}
                  onClick={() => selectProduct(p)}
                >
                  {p.image ? (
                    <img src={p.image} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                  ) : (
                    <ClientAvatar size={48} shape="square" name={p.name} seed={p.id} />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-[#8F96B0]">
                      {p.article} · {p.series}
                    </p>
                    {p.priceRetailRub != null ? (
                      <p className="text-xs text-muted-foreground">{formatBriefPriceRub(p.priceRetailRub)}</p>
                    ) : null}
                  </div>
                </button>
              ))}
              {results.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Ничего не найдено</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            {form ? (
              <ProductItemForm form={form} setForm={setForm} />
            ) : (
              <p className="text-sm text-muted-foreground">Выберите товар слева</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" disabled={!form?.name.trim()} onClick={handleAdd}>
            Добавить в блок
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsBlockEditor({
  block,
  readOnly,
  onPatch,
}: {
  block: MarketingBriefBlockRow;
  readOnly: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const p = asProductsBlock(block.payload);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductsBlockItem | null>(null);
  const [manualForm, setManualForm] = useState<ProductFormState>({
    manual: true,
    catalog_id: null,
    name: "",
    article: "",
    image_url: "",
    price_showroom: "",
    price_retail: "",
    note: "",
    segments: [],
  });
  const [editForm, setEditForm] = useState<ProductFormState | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function updateItems(items: ProductsBlockItem[]) {
    onPatch({ items });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = p.items.findIndex((i) => i.id === active.id);
    const newIndex = p.items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    updateItems(arrayMove(p.items, oldIndex, newIndex));
  }

  return (
    <div className="space-y-3" data-testid="products-block-editor">
      <div className="space-y-1.5">
        <Label className="text-xs">Заголовок</Label>
        <Input
          value={p.heading ?? ""}
          disabled={readOnly}
          placeholder="Товар месяца"
          onChange={(e) => onPatch({ heading: e.target.value })}
        />
        <p className="text-[10px] leading-snug text-muted-foreground">Необязательно. Например: «Что выставлять».</p>
      </div>

      {p.items.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={p.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {p.items.map((item) => (
                <SortableProductRow
                  key={item.id}
                  item={item}
                  readOnly={readOnly}
                  onEdit={() => {
                    setEditItem(item);
                    setEditForm(itemToForm(item));
                  }}
                  onDelete={() => updateItems(p.items.filter((i) => i.id !== item.id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-sm text-muted-foreground">Список товаров пуст</p>
      )}

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="flex-1 gap-1 sm:flex-none" onClick={() => setCatalogOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Из каталога
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 gap-1 sm:flex-none"
            onClick={() => {
              setManualForm({
                manual: true,
                catalog_id: null,
                name: "",
                article: "",
                image_url: "",
                price_showroom: "",
                price_retail: "",
                note: "",
                segments: [],
              });
              setManualOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Вручную
          </Button>
        </div>
      ) : null}

      <CatalogPickDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onAdd={(item) => updateItems([...p.items, item])}
      />

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить вручную</DialogTitle>
          </DialogHeader>
          <ProductItemForm form={manualForm} setForm={setManualForm} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManualOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={!manualForm.name.trim()}
              onClick={() => {
                updateItems([...p.items, formToItem(null, manualForm)]);
                setManualOpen(false);
              }}
            >
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editItem != null}
        onOpenChange={(o) => {
          if (!o) {
            setEditItem(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать товар</DialogTitle>
          </DialogHeader>
          {editForm ? <ProductItemForm form={editForm} setForm={setEditForm} readOnly={readOnly} /> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditItem(null)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={!editForm?.name.trim()}
              onClick={() => {
                if (!editItem || !editForm) return;
                const next = formToItem(editItem, editForm);
                updateItems(p.items.map((i) => (i.id === editItem.id ? next : i)));
                setEditItem(null);
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
