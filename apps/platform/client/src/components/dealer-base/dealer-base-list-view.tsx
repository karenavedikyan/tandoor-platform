/**
 * Полный UI списка клиентов для просмотра scope другого пользователя (Промт 387).
 */

import DealerBase from "@/pages/dealer-base";

export type DealerBaseListViewProps = {
  scopeUserId: string;
};

export function DealerBaseListView({ scopeUserId }: DealerBaseListViewProps) {
  return <DealerBase scopeUserId={scopeUserId} embedListOnly />;
}

export default DealerBaseListView;
