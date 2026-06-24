/**
 * Запуск: npm run test:trade-point-display-labels
 */
import assert from "node:assert/strict";
import {
  fullscreenCounterpartyLine,
  meaningfulTradePointName,
  tradePointDisplayLabel,
} from "../trade-point-display-labels.js";

assert.equal(meaningfulTradePointName("."), null);
assert.equal(meaningfulTradePointName("  Салон  "), "Салон");

assert.equal(
  tradePointDisplayLabel({ name: ".", releaseCode: "TND-TP-000003", id: "tp-1" }),
  "TND-TP-000003",
);
assert.equal(
  tradePointDisplayLabel({ name: "Октябрьское", releaseCode: "TND-TP-000003", id: "tp-1" }),
  "Октябрьское",
);

assert.equal(
  fullscreenCounterpartyLine(
    { name: "Гервасий Алена Валерьевна ИП" },
    { name: "TND-TP-000003 · Октябрьское", releaseCode: "TND-TP-000003", id: "tp-1", city: "Москва" },
  ),
  "Гервасий Алена Валерьевна ИП · ТТ: TND-TP-000003 · Октябрьское · Москва",
);

console.log("trade-point-display-labels: ok");
