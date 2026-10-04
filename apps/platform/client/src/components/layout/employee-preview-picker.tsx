import { useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useStartEmployeePreview, type EmployeePreviewStartInput } from "@/lib/use-employee-preview";
import { useWholesaleEmployees, type WholesaleEmployeePickerRow } from "@/lib/use-wholesale-employees";

const ASSIGNMENT_LABELS: Record<string, string> = {
  head_of_sales: "РОП",
  responsible_manager: "Ответственный",
  regional_manager: "Региональный",
  hardware_manager: "Фурнитура",
  store_manager: "Менеджер ТТ",
};

type Props = {
  layout?: "sidebar" | "mobile" | "collapsed";
  disabled?: boolean;
};

function PickerBody({ onDone }: { onDone: () => void }) {
  const [search, setSearch] = useState("");
  const [pendingGuid, setPendingGuid] = useState<string | null>(null);
  const { toast } = useToast();
  const start = useStartEmployeePreview();
  const employeesQ = useWholesaleEmployees(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = employeesQ.data ?? [];
    if (!q) return list;
    return list.filter(
      (e) =>
        e.fullName.toLowerCase().includes(q) ||
        e.employeeGuid.includes(q) ||
        (e.position ?? "").toLowerCase().includes(q),
    );
  }, [employeesQ.data, search]);

  const startPreview = async (row: WholesaleEmployeePickerRow, assignmentType: EmployeePreviewStartInput["assignmentType"]) => {
    setPendingGuid(row.employeeGuid);
    try {
      await start.mutateAsync({
        employeeGuid: row.employeeGuid,
        assignmentType,
      });
      toast({
        title: "Предпросмотр включён",
        description: `${row.fullName} · ${ASSIGNMENT_LABELS[assignmentType] ?? assignmentType}`,
      });
      onDone();
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: "Не удалось начать предпросмотр",
        description: e instanceof Error ? e.message : "Ошибка запроса",
      });
    } finally {
      setPendingGuid(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск сотрудника ОПТ"
          className="h-9 pl-8 text-sm"
          data-testid="input-employee-preview-search"
          autoFocus
        />
      </div>
      {employeesQ.isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Загрузка roster…</p>
      ) : employeesQ.isError ? (
        <p className="py-6 text-center text-sm text-destructive">Справочник ОПТ недоступен</p>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Сотрудники не найдены</p>
      ) : (
        <ul className="max-h-[min(60vh,420px)] space-y-2 overflow-y-auto pr-0.5">
          {filtered.map((row) => (
            <li
              key={row.employeeGuid}
              className="rounded-lg border border-border/60 bg-card p-2"
              data-testid={`employee-preview-row-${row.employeeGuid}`}
            >
              <p className="text-sm font-medium">{row.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {row.position ?? "—"}
                {!row.inRoster ? " · вне roster" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {(row.assignmentTypes.length > 0 ? row.assignmentTypes : ["responsible_manager"]).map((t) => (
                  <Button
                    key={`${row.employeeGuid}-${t}`}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={pendingGuid === row.employeeGuid || start.isPending}
                    onClick={() =>
                      void startPreview(row, t as EmployeePreviewStartInput["assignmentType"])
                    }
                    data-testid={`btn-preview-start-${row.employeeGuid}-${t}`}
                  >
                    {ASSIGNMENT_LABELS[t] ?? t}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EmployeePreviewPicker({ layout = "sidebar", disabled }: Props) {
  const [open, setOpen] = useState(false);

  if (layout === "collapsed") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            disabled={disabled}
            aria-label="Предпросмотр сотрудника ОПТ"
            data-testid="btn-employee-preview-collapsed"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start">
          <PickerBody onDone={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
    );
  }

  if (layout === "mobile") {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled} data-testid="btn-employee-preview-mobile">
            <Eye className="mr-1 h-4 w-4" />
            Предпросмотр ОПТ
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85vh]">
          <SheetHeader>
            <SheetTitle>Предпросмотр сотрудника ОПТ</SheetTitle>
          </SheetHeader>
          <PickerBody onDone={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={disabled}
          data-testid="btn-employee-preview-sidebar"
        >
          <Eye className="h-4 w-4 shrink-0" />
          <span className="truncate">Предпросмотр ОПТ</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <PickerBody onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
