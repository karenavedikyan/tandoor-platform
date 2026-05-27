/**
 * Запуск: `npm run test:real-client-base` из каталога apps/platform.
 *
 * Промт 53: проверяем, что getVisibleReleaseClients возвращает клиентов
 * с каталожными `mgr-*`/`team-*` идентификаторами, без подмены UUID-ами
 * из `client_assignments`. Подмена ломала roleScopedDealerRows /
 * applyDealerBasePickerFilters — у Кулаковой выпадало 0/3 клиентов
 * вместо 244, у Скалабана пустой список команды.
 */
import assert from "node:assert/strict";
import { buildAssignmentsMap, getVisibleReleaseClients } from "../real-client-base";
import { getReleaseClients } from "../release-client-data";
import type { OrgSnapshot } from "../use-org-snapshot";

const snap = {
  me: { id: "uuid-me", role: "sales_manager", fullName: "Test", teamId: "uuid-team" },
  visibility: { all: false, clientCodes: [], teamIds: [], visibleUserIds: [] },
  teams: [],
  users: [],
} as unknown as OrgSnapshot;

// 1. all=true возвращает все строки сида с оригинальными managerId/teamId.
{
  const rows = getVisibleReleaseClients(snap, true, null, null);
  assert.ok(rows.length > 0, "должны вернуть непустой список клиентов");
  // Берём первого клиента Кулаковой и проверяем формат id.
  const kulakova = rows.find((c) => c.managerId === "mgr-kulakova-os");
  assert.ok(kulakova, "должен найтись хотя бы один клиент с managerId='mgr-kulakova-os'");
  assert.equal(kulakova!.teamId, "team-skalaban", "teamId остаётся каталожным ключом");
}

// 2. codes-фильтр работает корректно.
{
  const allRows = getReleaseClients();
  const sample = allRows.slice(0, 5).map((c) => c.code);
  const rows = getVisibleReleaseClients(snap, false, sample, null);
  assert.equal(rows.length, sample.length, "codes фильтр сужает список до указанных кодов");
  for (const r of rows) {
    assert.ok(sample.includes(r.code), `вернувшийся клиент имеет код из sample: ${r.code}`);
  }
}

// 3. assignments с UUID НЕ должен перетирать managerId/teamId.
{
  const allRows = getReleaseClients();
  const kulakovaClient = allRows.find((c) => c.managerId === "mgr-kulakova-os");
  assert.ok(kulakovaClient, "фикстура: в сиде должен быть хотя бы один клиент Кулаковой");
  const fakeAssignments = buildAssignmentsMap([
    {
      code: kulakovaClient!.code,
      responsibleUserId: "6f1ed04c-18a8-412d-a4db-efa8ed2258d6", // UUID Кулаковой из БД
      teamId: "uuid-team-skalaban",
    },
  ]);
  const rows = getVisibleReleaseClients(snap, true, null, fakeAssignments);
  const after = rows.find((c) => c.code === kulakovaClient!.code)!;
  assert.equal(after.managerId, "mgr-kulakova-os", "managerId НЕ перетёрт UUID-ом");
  assert.equal(after.teamId, "team-skalaban", "teamId НЕ перетёрт UUID-ом");
}

console.log("real-client-base: ok (3 cases)");
