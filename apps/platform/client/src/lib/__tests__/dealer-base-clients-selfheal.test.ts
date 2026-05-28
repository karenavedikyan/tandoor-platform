/**
 * Запуск: `npm run test:dealer-base-clients-selfheal` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { shouldSelfHealZeroResult, type SelfHealZeroResultArgs } from "../dealer-base-clients-selfheal";
import type { OrgSnapshot } from "../use-org-snapshot";

const snap = { me: { id: "u1" } } as unknown as OrgSnapshot;

const base: SelfHealZeroResultArgs = {
  useReal: true,
  snap,
  access: "sales_manager",
  scopedRowsLength: 3,
  pickerFilteredLength: 0,
  ropTeam: "team-X",
  manager: "mgr-Y",
  defaultRopManager: { ropTeam: "all", manager: "all" },
  search: "",
  quick: "all",
  cities: [],
  categories: [],
  geoRegion: "",
  geoDistrict: "",
  geoLocality: "",
  programFiltersLength: 0,
  urlFocusId: null,
  urlCharacteristicId: null,
  stockListFilter: "all",
  segmentListLength: 0,
  workPlanFilter: "active",
  defaultWorkPlanFilterValue: "active",
  selfHealAlreadyApplied: false,
};

{
  assert.equal(shouldSelfHealZeroResult(base), true, "positive: scoped>0, picker=0, non-default rop/manager");
}

{
  assert.equal(
    shouldSelfHealZeroResult({ ...base, scopedRowsLength: 0 }),
    false,
    "scoped=0: no heal",
  );
}

{
  assert.equal(
    shouldSelfHealZeroResult({ ...base, pickerFilteredLength: 5 }),
    false,
    "picker>0: no heal",
  );
}

{
  assert.equal(
    shouldSelfHealZeroResult({
      ...base,
      ropTeam: "all",
      manager: "all",
    }),
    false,
    "already at default: no heal",
  );
}

{
  assert.equal(
    shouldSelfHealZeroResult({ ...base, selfHealAlreadyApplied: true }),
    false,
    "guard already applied: no heal",
  );
}

{
  assert.equal(
    shouldSelfHealZeroResult({ ...base, useReal: false }),
    false,
    "catalog mode: no heal",
  );
}

{
  assert.equal(
    shouldSelfHealZeroResult({ ...base, access: "team_lead" }),
    false,
    "team_lead: no heal",
  );
}

{
  assert.equal(
    shouldSelfHealZeroResult({ ...base, search: "foo" }),
    false,
    "other filter active: no heal",
  );
}
