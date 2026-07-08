import { describe, expect, it } from "vitest";
import { computeOneCOverviewVisibility } from "../one-c-overview-visibility.js";

describe("computeOneCOverviewVisibility", () => {
  it("admin and director see all KPIs and team link", () => {
    const all = {
      showRops: true,
      showRms: true,
      showManagers: true,
      showTeamLink: true,
    };
    expect(computeOneCOverviewVisibility("admin")).toEqual(all);
    expect(computeOneCOverviewVisibility("director")).toEqual(all);
  });

  it("rop hides ROPs tile but keeps team link", () => {
    expect(computeOneCOverviewVisibility("rop")).toEqual({
      showRops: false,
      showRms: true,
      showManagers: true,
      showTeamLink: true,
    });
  });

  it("rm hides ROPs and RMs tiles", () => {
    expect(computeOneCOverviewVisibility("regional_manager")).toEqual({
      showRops: false,
      showRms: false,
      showManagers: true,
      showTeamLink: true,
    });
    expect(computeOneCOverviewVisibility("rm")).toEqual({
      showRops: false,
      showRms: false,
      showManagers: true,
      showTeamLink: true,
    });
  });

  it("manager sees only stores/orders KPIs", () => {
    expect(computeOneCOverviewVisibility("manager")).toEqual({
      showRops: false,
      showRms: false,
      showManagers: false,
      showTeamLink: false,
    });
  });

  it("unknown role gets nothing", () => {
    expect(computeOneCOverviewVisibility("viewer")).toEqual({
      showRops: false,
      showRms: false,
      showManagers: false,
      showTeamLink: false,
    });
  });
});
