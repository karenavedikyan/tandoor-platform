import type { OneCStoreListItem } from "@/lib/one-c-showroom-api";
import type { OneCLegalListItem } from "@/lib/one-c-showroom-api";

export function buildOneCStoresKpi(items: OneCStoreListItem[], total: number) {
  return [
    { label: "Всего ТТ", value: total.toLocaleString("ru-RU") },
    {
      label: "С распределением",
      value: items.filter((item) => item.distribution_filled > 0).length.toLocaleString("ru-RU"),
    },
    {
      label: "Пустых",
      value: items
        .filter((item) => item.distribution_total > 0 && item.distribution_filled === 0)
        .length.toLocaleString("ru-RU"),
    },
  ];
}

export function buildOneCLegalsKpi(items: OneCLegalListItem[], total: number, onlyActive: boolean) {
  const activeCount = onlyActive
    ? total
    : items.filter((item) => item.responsible_manager_name || item.regional_manager_name).length;
  return [
    { label: "Всего юрлиц", value: total.toLocaleString("ru-RU") },
    { label: "Активных", value: activeCount.toLocaleString("ru-RU") },
    {
      label: "С холдингом",
      value: items.filter((item) => item.parent_name?.trim()).length.toLocaleString("ru-RU"),
    },
  ];
}
