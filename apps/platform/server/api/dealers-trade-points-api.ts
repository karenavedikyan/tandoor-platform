/**
 * Server API layer for dealers & trade points (Промт 348, 374).
 */

export {
  handleDealersTradePointsGet,
  handleDealersTradePointsList,
  handleDealersTradePointsSummary,
  countDealersAndTradePoints,
  type DealersTradePointsSearchFilters,
  type DealersTradePointsSummary,
} from "../../shared/dealers-trade-points-handlers.js";

export {
  resolveDealersTradePointsGet,
  resolveDealersTradePointsList,
  resolveDealersTradePointsSummary,
  type DealersSourceMeta,
} from "../dealers/dealers-trade-points-source.js";

export { runDealersShadowAudit } from "./dealers-shadow-audit-api.js";

export { useDbDealers, shadowDiffEnabled } from "../dealers/dealers-source-config.js";
