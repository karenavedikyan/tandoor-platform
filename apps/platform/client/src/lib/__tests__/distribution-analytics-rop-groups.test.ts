/**
 * Группировка дистрибуции по реальным РОПам из org-snapshot.
 */
import { describe, expect, it } from "vitest";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import {
  buildRopGroups,
  UNASSIGNED_ROP_ID,
} from "@/lib/distribution-analytics/distribution-analytics-rop-groups";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import type { OrgSnapshot } from "@/lib/use-org-snapshot";

const ROP_SKALA = "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa";
const ROP_SAP = "c36f625f-730e-4ae3-b118-bdb005d10b81";
const ROP_KUP = "ccffcf6e-2505-4eee-b257-ac65b60bb779";
const TEAM_SKALA = "team-skala-uuid";
const TEAM_SAP = "team-sap-uuid";
const TEAM_KUP = "e5387f40-c693-44e6-ab17-e61a3ed0bd95";
const MGR_DORONINA = "mgr-doronina-id";
const MGR_KUP = "mgr-kup-1";

function makeTp(id: string) {
  return {
    id,
    name: `ТТ ${id}`,
    city: "Краснодар",
    address: "",
    format: "",
    status: "",
    equipment: "",
    hardwareStockStatus: "",
    doorsStockStatus: "",
    distribution: { mk: 0, vh: 0, total: 0 },
    showcaseStatus: "",
    showcaseNeeds: "",
    lastVisitDate: "",
    nextVisitDate: "",
    responsibleRegionalManager: "",
  };
}

function makeDealer(partial: Partial<DealerRow> & { id: string }): DealerRow {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    city: partial.city ?? "Краснодар",
    region: partial.region ?? "Юг",
    releaseCode: partial.releaseCode ?? partial.id,
    releaseTeamId: partial.releaseTeamId,
    releaseManagerId: partial.releaseManagerId,
    ropId: partial.ropId,
    managerUserId: partial.managerUserId,
    manager: partial.manager ?? "",
    ropName: partial.ropName,
    contacts: { lpr: "", phone: "", email: "" },
    tradePoints: partial.tradePoints ?? [makeTp(`tp-${partial.id}`)],
  } as DealerRow;
}

function testSnap(): OrgSnapshot {
  return {
    me: { id: "director", role: "director", fullName: "Директор", teamId: null },
    visibility: { all: true, clientCodes: null, teamIds: [], visibleUserIds: [] },
    teams: [
      { id: TEAM_SKALA, name: "Скалабан", ropUserId: ROP_SKALA, ropName: "Скалабан Александр" },
      { id: TEAM_SAP, name: "Сапожков", ropUserId: ROP_SAP, ropName: "Сапожков Артем" },
      { id: TEAM_KUP, name: "Купянский", ropUserId: ROP_KUP, ropName: "Купянский Родион" },
    ],
    users: [
      { id: ROP_SKALA, fullName: "Скалабан Александр", role: "rop", teamId: TEAM_SKALA, status: "active" },
      { id: ROP_SAP, fullName: "Сапожков Артем", role: "rop", teamId: TEAM_SAP, status: "active" },
      { id: ROP_KUP, fullName: "Купянский Родион", role: "rop", teamId: TEAM_KUP, status: "active" },
      { id: MGR_DORONINA, fullName: "Доронина", role: "manager", teamId: TEAM_SKALA, status: "active" },
      { id: MGR_KUP, fullName: "Менеджер Куп", role: "manager", teamId: TEAM_KUP, status: "active" },
      { id: "marketer-kotlyarov", fullName: "Котляров Антон", role: "marketer", teamId: null, status: "active" },
    ],
  } as OrgSnapshot;
}

describe("buildRopGroups", () => {
  const act = createEmptyActualizationState();

  it("группирует только по реальным РОПам из snapshot, без дублей и фантомов", () => {
    const scopedDealers = [
      makeDealer({
        id: "d-skala-1",
        releaseTeamId: "team-skalaban",
        manager: "Доронина",
        ropName: "Скалабан Александр Александрович",
      }),
      makeDealer({
        id: "d-skala-2",
        releaseTeamId: "team-skalaban",
        ropName: "3f67f770-f5cd-4257-a4b2-1cefa65fbfaa",
      }),
      makeDealer({
        id: "d-skala-phantom-name",
        releaseTeamId: "team-skalaban",
        ropName: "Никонов Игорь",
      }),
      makeDealer({
        id: "d-sap-1",
        releaseTeamId: "team-sapozhkov",
        ropName: "Сапожков Артем",
      }),
      makeDealer({
        id: "d-kup-1",
        releaseTeamId: "team-kupiansky",
        ropName: "Купянский Родион",
      }),
      makeDealer({
        id: "d-garbage",
        ropName: "Котляров",
        manager: "Котляров Антон",
      }),
    ];

    const groups = buildRopGroups(scopedDealers, testSnap(), act);
    const realGroups = groups.filter((g) => !g.isUnassigned);

    expect(realGroups).toHaveLength(3);
    expect(realGroups.map((g) => g.ropId).sort()).toEqual([ROP_KUP, ROP_SAP, ROP_SKALA].sort());
    expect(realGroups.every((g) => g.ropId !== "marketer-kotlyarov")).toBe(true);
    expect(realGroups.some((g) => g.ropName.includes("Никонов"))).toBe(false);
    expect(realGroups.some((g) => g.ropName.includes("Котляров"))).toBe(false);

    const skala = realGroups.find((g) => g.ropId === ROP_SKALA);
    expect(skala?.tradePointIds).toHaveLength(3);
    expect(skala?.managers.some((m) => m.managerId === MGR_DORONINA)).toBe(true);

    const unassigned = groups.find((g) => g.ropId === UNASSIGNED_ROP_ID);
    expect(unassigned).toBeDefined();
    expect(unassigned?.tradePointIds).toHaveLength(1);
  });

  it("возвращает пустой список без snapshot", () => {
    expect(buildRopGroups([], null, act)).toEqual([]);
  });

  it("1С-source: группирует по dealer.ropId, «Без РОПа» пустая", () => {
    const scopedDealers = [
      makeDealer({ id: "d-kup-1", ropId: ROP_KUP, tradePoints: [makeTp("tp-kup-1")] }),
      makeDealer({ id: "d-kup-2", ropId: ROP_KUP, tradePoints: [makeTp("tp-kup-2")] }),
      makeDealer({ id: "d-sap-1", ropId: ROP_SAP, tradePoints: [makeTp("tp-sap-1")] }),
      makeDealer({ id: "d-skala-1", ropId: ROP_SKALA, tradePoints: [makeTp("tp-skala-1")] }),
    ];

    const groups = buildRopGroups(scopedDealers, testSnap(), act);
    const realGroups = groups.filter((g) => !g.isUnassigned);
    const unassigned = groups.find((g) => g.ropId === UNASSIGNED_ROP_ID);

    expect(realGroups).toHaveLength(3);
    expect(unassigned).toBeUndefined();
    expect(realGroups.find((g) => g.ropId === ROP_KUP)?.tradePointIds).toHaveLength(2);
    expect(realGroups.find((g) => g.ropId === ROP_SAP)?.tradePointIds).toHaveLength(1);
    expect(realGroups.find((g) => g.ropId === ROP_SKALA)?.tradePointIds).toHaveLength(1);
  });

  it("1С-source: ТТ без ropId попадает в «Без РОПа»", () => {
    const scopedDealers = [
      makeDealer({ id: "d-kup-1", ropId: ROP_KUP }),
      makeDealer({ id: "d-orphan", ropId: null }),
    ];

    const groups = buildRopGroups(scopedDealers, testSnap(), act);
    const unassigned = groups.find((g) => g.ropId === UNASSIGNED_ROP_ID);
    const kup = groups.find((g) => g.ropId === ROP_KUP);

    expect(kup?.tradePointIds).toHaveLength(1);
    expect(unassigned?.tradePointIds).toHaveLength(1);
    expect(unassigned?.tradePointIds[0]).toBe("tp-d-orphan");
  });

  it("смешанный source: 1С ropId и legacy releaseTeamId без дублей", () => {
    const scopedDealers = [
      makeDealer({ id: "d-kup-1c", ropId: ROP_KUP }),
      makeDealer({
        id: "d-skala-legacy",
        releaseTeamId: "team-skalaban",
        ropName: "Скалабан Александр Александрович",
      }),
    ];

    const groups = buildRopGroups(scopedDealers, testSnap(), act);
    const kup = groups.find((g) => g.ropId === ROP_KUP);
    const skala = groups.find((g) => g.ropId === ROP_SKALA);
    const unassigned = groups.find((g) => g.ropId === UNASSIGNED_ROP_ID);

    expect(kup?.tradePointIds).toHaveLength(1);
    expect(skala?.tradePointIds).toHaveLength(1);
    expect(unassigned).toBeUndefined();
  });

  it("1С-source: менеджеры внутри РОПа матчатся по dealer.managerUserId", () => {
    const scopedDealers = [
      makeDealer({
        id: "d-kup-mgr",
        ropId: ROP_KUP,
        managerUserId: MGR_KUP,
        tradePoints: [makeTp("tp-kup-mgr")],
      }),
      makeDealer({
        id: "d-kup-other",
        ropId: ROP_KUP,
        managerUserId: "other-mgr",
        tradePoints: [makeTp("tp-kup-other")],
      }),
    ];

    const groups = buildRopGroups(scopedDealers, testSnap(), act);
    const kup = groups.find((g) => g.ropId === ROP_KUP);
    const mgrGroup = kup?.managers.find((m) => m.managerId === MGR_KUP);

    expect(mgrGroup?.tradePointIds).toEqual(["tp-kup-mgr"]);
  });
});
