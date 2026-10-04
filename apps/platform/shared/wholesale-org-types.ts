/**
 * Типы единого read-only слоя организационных данных 1С (wholesale migration).
 * Сотрудник 1С, назначение, аккаунт ЛК и предпросмотр — разные сущности.
 */

export type WholesaleAssignmentType =
  | "head_of_sales"
  | "responsible_manager"
  | "regional_manager"
  | "hardware_manager"
  | "store_manager";

export type WholesaleAccountLinkState = "linked" | "no_account" | "inactive_account";

export type WholesaleEmployeeRecord = {
  employeeGuid: string;
  fullName: string;
  position: string | null;
  source: "employee_roster" | "exchange_users_raw" | "assignment_derived";
  inRoster: boolean;
  accountLinkState: WholesaleAccountLinkState;
  accountUserId: string | null;
};

export type WholesaleClientAssignment = {
  guidClient: string;
  externalKey: string;
  name: string;
  city: string | null;
  region: string | null;
  holding: boolean;
  holdingLinkState: string | null;
  pendingHoldingGuid: string | null;
  managerRosterState: string | null;
  headOfSalesGuid: string | null;
  headOfSalesName: string | null;
  responsibleManagerGuid: string | null;
  responsibleManagerName: string | null;
  regionalManagerGuid: string | null;
  regionalManagerName: string | null;
  hardwareManagerGuid: string | null;
  hardwareManagerName: string | null;
  storeGuids: string[];
  openStoreGuids: string[];
  closedStoreGuids: string[];
  reviewFlags: WholesaleReviewFlag[];
};

export type WholesaleReviewFlag =
  | "missing_rop"
  | "missing_responsible"
  | "responsible_outside_roster"
  | "unresolved_holding"
  | "ambiguous_rop_for_manager";

export type WholesaleManagerNode = {
  employeeGuid: string;
  fullName: string;
  position: string | null;
  assignmentType: "responsible_manager";
  clientCount: number;
  storeCount: number;
  hasAccount: boolean;
  ambiguousRop: boolean;
  reviewReasons: string[];
};

export type WholesaleRmNode = {
  employeeGuid: string;
  fullName: string;
  position: string | null;
  assignmentType: "regional_manager";
  clientCount: number;
  storeCount: number;
  hasAccount: boolean;
};

export type WholesaleRopNode = {
  employeeGuid: string;
  fullName: string;
  position: string | null;
  teamId: string;
  teamName: string;
  rmCount: number;
  managerCount: number;
  clientCount: number;
  storeCount: number;
  ownClientCount: number;
  rms: WholesaleRmNode[];
  managers: WholesaleManagerNode[];
  isSynthetic: boolean;
};

export type WholesaleOrgTotals = {
  uniqueClients: number;
  uniqueStores: number;
  openStores: number;
  closedStores: number;
  ropCount: number;
  managerCount: number;
  regionalManagerCount: number;
  needsReviewCount: number;
  unassignedClientCount: number;
};

export type WholesaleOutletAssignment = {
  guidStore: string;
  guidClient: string;
  closed: boolean;
  storeManagerGuid: string | null;
  storeManagerName: string | null;
};

export type WholesaleOrgReadResult = {
  source: "wholesale_metadata";
  rosterAvailable: boolean;
  rosterError: string | null;
  importedAt: string | null;
  employees: WholesaleEmployeeRecord[];
  clients: WholesaleClientAssignment[];
  outlets: WholesaleOutletAssignment[];
  hierarchy: WholesaleRopNode[];
  needsReviewClients: WholesaleClientAssignment[];
  totals: WholesaleOrgTotals;
};

export type WholesaleEmployeePreviewScope = {
  employeeGuid: string;
  fullName: string;
  assignmentType: WholesaleAssignmentType;
  confirmed: boolean;
  reason: string | null;
  activeDealerExternalKeys: string[];
  activeStoreGuids: string[];
};
