import type {
  Claim,
  Dealer,
  DealerInteraction,
  DealerTask,
  Organization,
  Order,
  TradePoint,
  User,
} from "@shared/schema";

export type UserPublic = Pick<User, "id" | "firstName" | "lastName" | "email" | "phone">;

export type DealerListItem = {
  id: number;
  organizationId: number;
  organizationName: string;
  name: string;
  dealerType: "network" | "single";
  segment: string | null;
  status: string;
  salesManagerId: number | null;
  regionalManagerId: number | null;
  region: string | null;
  city: string | null;
  potentialLevel: "high" | "medium" | "low" | null;
  tradePointCount: number;
  activeTaskCount: number;
  lastInteractionDate: string | null;
  comment: string | null;
  createdAt: string;
  salesManager: UserPublic | null;
  regionalManager: UserPublic | null;
  salesManagerName: string;
  regionalManagerName: string;
  clientLifecycleStatus: "active" | "potential" | "paused" | "lost" | "archived";
  source: "one_c" | "bitrix24" | "excel" | "manual";
};

export type DealerTaskView = DealerTask & {
  assignedToUserName: string;
  createdByUserName: string;
};
export type DealerTaskWithUsers = DealerTaskView;

export type DealerInteractionView = DealerInteraction & {
  userName: string;
};
export type DealerInteractionWithUser = DealerInteractionView;

export type DistributionSummary = {
  tradePointsCovered: number;
  totalTradePoints: number;
  activeShowcaseGoals: number;
  activeDistributionTasks: number;
  placeholder: string;
};

export type DealerDetail = {
  dealer: DealerListItem;
  salesManager: UserPublic | null;
  regionalManager: UserPublic | null;
  tradePoints: TradePoint[];
  tasks: DealerTaskView[];
  interactions: DealerInteractionView[];
  recentOrders: Order[];
  recentClaims: Claim[];
  distributionSummary: DistributionSummary;
};

export function userToPublic(user: User | undefined): UserPublic | null {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
  };
}

export function countActiveTasks(tasks: DealerTask[]): number {
  return tasks.filter((t) => t.status === "new" || t.status === "in_progress").length;
}

function personName(user: User | undefined): string {
  if (!user) {
    return "Не назначен";
  }
  return `${user.firstName} ${user.lastName}`.trim();
}

export function toDealerListItem(
  dealer: Dealer,
  users: User[],
  tradePoints: TradePoint[],
  tasks: DealerTask[],
  interactions: DealerInteraction[],
  organizations: Organization[] = [],
): DealerListItem {
  const dealerImportMetaById: Record<
    number,
    { clientLifecycleStatus: DealerListItem["clientLifecycleStatus"]; source: DealerListItem["source"] }
  > = {
    1: { clientLifecycleStatus: "active", source: "one_c" },
    2: { clientLifecycleStatus: "potential", source: "excel" },
    3: { clientLifecycleStatus: "active", source: "bitrix24" },
  };
  const lifecycleByDealerStatus: Record<string, DealerListItem["clientLifecycleStatus"]> = {
    active: "active",
    development: "potential",
    paused: "paused",
    archived: "archived",
  };
  const importMeta = dealerImportMetaById[dealer.id];
  const salesManagerId = dealer.salesManagerId ?? dealer.managerUserId ?? null;
  const regionalManagerId = dealer.regionalManagerId ?? null;
  const salesManager = users.find((user) => user.id === salesManagerId);
  const regionalManager = users.find((user) => user.id === regionalManagerId);
  const organizationName =
    organizations.find((organization) => organization.id === dealer.organizationId)?.name ?? dealer.name;
  const dealerTradePoints = tradePoints.filter((point) => point.dealerId === dealer.id);
  const dealerTasks = tasks.filter((task) => task.dealerId === dealer.id);
  const latestInteraction =
    interactions
      .filter((entry) => entry.dealerId === dealer.id)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

  return {
    id: dealer.id,
    organizationId: dealer.organizationId,
    organizationName,
    name: dealer.name,
    dealerType: dealer.dealerType as "network" | "single",
    segment: dealer.segment,
    status: dealer.status,
    salesManagerId,
    regionalManagerId,
    region: dealer.region,
    city: dealer.city,
    potentialLevel: (dealer.potentialLevel as "high" | "medium" | "low" | null) ?? null,
    tradePointCount: dealerTradePoints.length,
    activeTaskCount: countActiveTasks(dealerTasks),
    lastInteractionDate: latestInteraction?.createdAt ?? null,
    comment: dealer.comment,
    createdAt: dealer.createdAt,
    salesManager: userToPublic(salesManager),
    regionalManager: userToPublic(regionalManager),
    salesManagerName: personName(salesManager),
    regionalManagerName: personName(regionalManager),
    clientLifecycleStatus:
      importMeta?.clientLifecycleStatus ?? lifecycleByDealerStatus[dealer.status] ?? "potential",
    source: importMeta?.source ?? "manual",
  };
}
