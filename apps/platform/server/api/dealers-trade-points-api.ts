/**
 * Server API layer for dealers & trade points (Промт 348).
 * Vercel router: `api/dealers-trade-points/[action].ts`
 * Handlers: `shared/dealers-trade-points-handlers.ts`
 */

export {
  handleDealersTradePointsGet,
  handleDealersTradePointsList,
  handleDealersTradePointsSummary,
  countDealersAndTradePoints,
  type DealersTradePointsSearchFilters,
  type DealersTradePointsSummary,
} from "../../shared/dealers-trade-points-handlers.js";
