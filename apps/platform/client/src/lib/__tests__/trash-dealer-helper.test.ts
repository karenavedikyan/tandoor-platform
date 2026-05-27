/**
 * Запуск: `npm run test:trash-helper` из каталога apps/platform.
 *
 * Промт 46 G1: helper-функции для отправки клиентов / ТТ в корзину.
 */
import assert from "node:assert/strict";
import {
  makeTrashedDealerInfo,
  makeTrashedTradePointInfo,
  snapshotDealerFromRow,
  snapshotTradePointFromRow,
} from "../trash-dealer-helper";

const TRASH_RETENTION_DAYS = 14;
const RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const actor = { userId: "u1", userName: "Бойко Е." };

// H1.1 makeTrashedDealerInfo: trashedAt = now (детерм. через nowIso), expiresAt = +14d, snapshot копируется.
{
  const nowIso = "2026-05-27T12:00:00.000Z";
  const info = makeTrashedDealerInfo({
    dealerId: "D1",
    by: actor,
    snapshot: snapshotDealerFromRow({
      fullName: "Михеенко А.В.",
      city: "Луганск",
      inn: "1234567890",
      dealerCode: "TND-CL-001",
      legalEntityName: "ООО Михеенко",
    }),
    source: "client_card_delete",
    nowIso,
  });
  assert.equal(info.dealerId, "D1");
  assert.equal(info.trashedBy, "u1");
  assert.equal(info.trashedByName, "Бойко Е.");
  assert.equal(info.trashedAt, nowIso);
  const expMs = Date.parse(info.expiresAt);
  const trashedMs = Date.parse(info.trashedAt);
  assert.equal(expMs - trashedMs, RETENTION_MS, "expiresAt = trashedAt + 14d");
  assert.equal(info.source, "client_card_delete");
  assert.deepEqual(info.snapshot, {
    fullName: "Михеенко А.В.",
    city: "Луганск",
    inn: "1234567890",
    dealerCode: "TND-CL-001",
    legalEntityName: "ООО Михеенко",
  });
}

// H1.2 snapshotDealerFromRow normalizes undefined to null.
{
  const snap = snapshotDealerFromRow({});
  assert.deepEqual(snap, {
    fullName: null,
    city: null,
    inn: null,
    dealerCode: null,
    legalEntityName: null,
  });
}

// H1.3 makeTrashedTradePointInfo: trashedAt now, expiresAt +14d, dealerFullName в snapshot.
{
  const nowIso = "2026-05-27T15:30:00.000Z";
  const info = makeTrashedTradePointInfo({
    tradePointId: "T1",
    dealerId: "D1",
    by: actor,
    snapshot: snapshotTradePointFromRow({
      name: "Магазин Центр",
      address: "ул. Ленина, 1",
      city: "Луганск",
      tradePointCode: "TND-TP-001",
      dealerFullName: "Михеенко А.В.",
    }),
    source: "client_bulk_delete",
    nowIso,
  });
  assert.equal(info.tradePointId, "T1");
  assert.equal(info.dealerId, "D1");
  assert.equal(info.trashedAt, nowIso);
  assert.equal(Date.parse(info.expiresAt) - Date.parse(info.trashedAt), RETENTION_MS);
  assert.equal(info.source, "client_bulk_delete");
  assert.equal(info.snapshot.dealerFullName, "Михеенко А.В.");
  assert.equal(info.snapshot.name, "Магазин Центр");
}

// H1.4 Без nowIso — используется реальный момент (фактический tolerance до 5 секунд).
{
  const before = Date.now();
  const info = makeTrashedDealerInfo({
    dealerId: "D2",
    by: actor,
    snapshot: snapshotDealerFromRow({ fullName: "X" }),
    source: "manual_actualization",
  });
  const after = Date.now();
  const ms = Date.parse(info.trashedAt);
  assert.ok(ms >= before - 1000 && ms <= after + 1000, "trashedAt близко к now");
  assert.equal(Date.parse(info.expiresAt) - ms, RETENTION_MS);
}

console.log("trash-dealer-helper: ok (4 cases)");
