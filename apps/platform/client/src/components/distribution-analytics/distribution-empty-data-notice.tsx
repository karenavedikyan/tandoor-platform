import type { ReactElement } from "react";

type Props = {
  hasAnyEligible: boolean;
  totalRowsInScope: number;
};

/**
 * Подсказка «Нет данных о ёмкости витрин», когда в выборке есть ТТ,
 * но ни одна не eligible (capacity не заполнена).
 */
export function DistributionEmptyDataNotice({ hasAnyEligible, totalRowsInScope }: Props): ReactElement | null {
  if (totalRowsInScope === 0) return null;
  if (hasAnyEligible) return null;

  return (
    <div
      className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
      data-testid="distribution-empty-data-notice"
    >
      <p className="font-semibold">Дистрибуция не рассчитана</p>
      <p className="mt-1">
        В выборке {totalRowsInScope} ТТ, но ни в одной не указано количество витрин (ВХ-порталы, МК-порталы, секции
        фурнитуры). Откройте карточку ТТ и заполните ёмкость на шаге визарда — после этого аналитика появится.
      </p>
    </div>
  );
}
