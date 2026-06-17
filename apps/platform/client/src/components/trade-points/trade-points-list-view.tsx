/**
 * Полный UI списка торговых точек для просмотра scope другого пользователя (Промт 387).
 */

import TradePointsPage from "@/pages/trade-points";

export type TradePointsListViewProps = {
  scopeUserId: string;
};

export function TradePointsListView({ scopeUserId }: TradePointsListViewProps) {
  return <TradePointsPage scopeUserId={scopeUserId} embedListOnly />;
}

export default TradePointsListView;
