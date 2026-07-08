export type OneCOverviewVisibility = {
  showRops: boolean;
  showRms: boolean;
  showManagers: boolean;
  showTeamLink: boolean;
};

export function computeOneCOverviewVisibility(role: string): OneCOverviewVisibility {
  if (role === "admin" || role === "director") {
    return { showRops: true, showRms: true, showManagers: true, showTeamLink: true };
  }
  if (role === "rop") {
    return { showRops: false, showRms: true, showManagers: true, showTeamLink: true };
  }
  if (role === "rm" || role === "regional_manager") {
    return { showRops: false, showRms: false, showManagers: true, showTeamLink: true };
  }
  if (role === "manager") {
    return { showRops: false, showRms: false, showManagers: false, showTeamLink: false };
  }
  return { showRops: false, showRms: false, showManagers: false, showTeamLink: false };
}
