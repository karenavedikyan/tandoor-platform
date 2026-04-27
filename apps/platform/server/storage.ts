import type {
  ActivityEvent,
  Claim,
  Dealer,
  DealerInteraction,
  DealerTask,
  DistributionReport,
  DistributionReportItem,
  Document,
  Order,
  OrderItem,
  Organization,
  Product,
  RegionalRoute,
  Role,
  RouteVisit,
  SalesTask,
  ShowcaseGoal,
  ShowcaseGoalItem,
  TradePoint,
  User,
  UserRole,
} from "@shared/schema";
import type {
  DealerDetail,
  DealerInteractionWithUser,
  DealerListItem,
  DealerTaskWithUsers,
} from "./dealer-crm";
import { countActiveTasks, toDealerListItem } from "./dealer-crm";

export type OrderDetails = Order & {
  items: OrderItem[];
  documents: Document[];
};

export type CreateOrderItemInput = {
  productId: number;
  quantity: number;
};

export type CreateOrderInput = {
  dealerId: number;
  createdByUserId: number;
  items: CreateOrderItemInput[];
  comment?: string;
};

export type RouteVisitDetail = RouteVisit & {
  dealer: DealerListItem;
  tradePoint: TradePoint;
};

export type RegionalRouteDetail = RegionalRoute & {
  regionalManager: User;
  visits: RouteVisitDetail[];
  summary: {
    planned: number;
    completed: number;
    inProgress: number;
    skipped: number;
  };
};

export type DistributionReportResponse = {
  report: DistributionReport;
  items: DistributionReportItem[];
  summary: {
    totalModelsChecked: number;
    presentModelsCount: number;
    missingModelsCount: number;
    showcaseModelsCount: number;
  };
};

export type VisitDetail = {
  visit: RouteVisitDetail;
  route: RegionalRoute;
  dealer: DealerListItem;
  tradePoint: TradePoint;
  salesManager: User | null;
  regionalManager: User | null;
  activeTaskCount: number;
  distributionReport: DistributionReportResponse | null;
  productChecklist: DistributionReportItem[];
};

export type DemoDistributionReportPayload = {
  hasShowcase: boolean;
  showcaseDoorsCount: number;
  displayQuality: string;
  competitorPresence: string;
  recommendation: string;
  nextAction: string;
  items: Array<{
    productId: number;
    isPresent: boolean;
    isOnShowcase: boolean;
    stockStatus: string;
    comment?: string | null;
  }>;
};

export type ShowcaseGoalReportSummary = {
  id: number;
  visitId: number;
  reportStatus: string;
  missingModelsCount: number;
  presentModelsCount: number;
  recommendation: string;
  nextAction: string;
};

export type ShowcaseGoalListItem = ShowcaseGoal & {
  dealer: DealerListItem;
  tradePoint: TradePoint;
  assignedTo: User | null;
  createdBy: User | null;
  progressPercent: number;
  isOverdue: boolean;
  distributionReportSummary: ShowcaseGoalReportSummary | null;
};

export type SalesTaskListItem = SalesTask & {
  dealer: DealerListItem;
  tradePoint: TradePoint | null;
  assignedTo: User | null;
  createdBy: User | null;
  showcaseGoal: ShowcaseGoal | null;
};

export type ShowcaseGoalDetail = {
  goal: ShowcaseGoalListItem;
  dealer: DealerListItem;
  tradePoint: TradePoint;
  assignedTo: User | null;
  createdBy: User | null;
  sourceDistributionReportSummary: ShowcaseGoalReportSummary | null;
  items: ShowcaseGoalItem[];
  relatedSalesTasks: SalesTaskListItem[];
};

export type SalesTaskDetail = {
  task: SalesTaskListItem;
  dealer: DealerListItem;
  tradePoint: TradePoint | null;
  assignedTo: User | null;
  createdBy: User | null;
  showcaseGoal: ShowcaseGoalListItem | null;
};

export type SalesLeadershipKpis = {
  dealersTotal: number;
  tradePointsTotal: number;
  visitsPlanned: number;
  visitsCompleted: number;
  distributionReportsSubmitted: number;
  showcaseGoalsTotal: number;
  showcaseGoalsCompleted: number;
  salesTasksTotal: number;
  salesTasksOverdue: number;
  atRiskDealersCount: number;
};

export type SalesLeadershipRoleSummary = {
  role: "sales_head" | "team_head" | "regional_head";
  title: string;
  ownerName: string;
  focus: string;
  mainMetrics: string[];
  actionLabel: string;
  actionHref: string;
};

export type TeamWorkloadItem = {
  userId: number;
  name: string;
  role:
    | "sales_head"
    | "team_head"
    | "regional_head"
    | "sales_manager"
    | "regional_manager"
    | "sales_assistant";
  team: string;
  activeGoalsCount: number;
  activeTasksCount: number;
  overdueTasksCount: number;
  visitsCount: number;
  reportsCount: number;
  workloadStatus: "normal" | "high" | "overloaded";
  nextFocus: string;
};

export type ShowcaseGoalPipelineItem = {
  status: "new" | "in_progress" | "agreed" | "completed" | "overdue";
  label: string;
  count: number;
  colorTone: string;
};

export type RegionalActivitySummary = {
  routesToday: number;
  visitsToday: number;
  completedVisits: number;
  inProgressVisits: number;
  reportsCreated: number;
  reportsSubmitted: number;
  nextVisitTitle: string;
  nextVisitTime: string;
  linkToRoute: string;
};

export type AtRiskDealer = {
  dealerId: number;
  dealerName: string;
  tradePointId?: number;
  tradePointName?: string;
  city: string;
  riskReason: string;
  riskLevel: "medium" | "high" | "critical";
  responsibleName: string;
  lastAction: string;
  nextAction: string;
  actionHref: string;
};

export type OverdueLeadershipItem = {
  id: string;
  type: "showcase_goal" | "sales_task" | "visit_follow_up";
  title: string;
  ownerName: string;
  dueDate: string;
  severity: "medium" | "high" | "critical";
  href: string;
};

export type LeadershipNextAction = {
  title: string;
  description: string;
  href: string;
  priority: "low" | "medium" | "high";
};

export type SalesLeadershipDashboard = {
  kpis: SalesLeadershipKpis;
  roleSummaries: SalesLeadershipRoleSummary[];
  teamWorkload: TeamWorkloadItem[];
  showcaseGoalPipeline: ShowcaseGoalPipelineItem[];
  regionalActivity: RegionalActivitySummary;
  atRiskDealers: AtRiskDealer[];
  overdueItems: OverdueLeadershipItem[];
  nextActions: LeadershipNextAction[];
};

export type RegionalManagerWorkspaceManager = {
  id: number;
  name: string;
  role: string;
  region: string;
  teamName: string;
};

export type RegionalManagerWorkspacePeriod = {
  label: string;
  dateFrom: string;
  dateTo: string;
};

export type RegionalManagerWorkspaceKpis = {
  plannedVisits: number;
  completedVisits: number;
  inProgressVisits: number;
  overdueVisits: number;
  distributionReports: number;
  missingModels: number;
  showcaseGoalsCreated: number;
  openTasks: number;
  overdueTasks: number;
  atRiskDealers: number;
};

export type RegionalTodayRoute = {
  id: number;
  title: string;
  city: string;
  date: string;
  status: RegionalRoute["status"];
  progressPercent: number;
  visitsTotal: number;
  visitsCompleted: number;
  nextVisitId: number | null;
  nextDealerName: string | null;
  nextTradePointAddress: string | null;
};

export type RegionalUpcomingVisit = {
  id: number;
  dealerId: number;
  dealerName: string;
  tradePointId: number;
  tradePointName: string;
  address: string;
  city: string;
  plannedTime: string;
  status: RouteVisit["visitStatus"];
  priority: RouteVisit["priority"];
  hasDistributionReport: boolean;
  hasOpenShowcaseGoal: boolean;
};

export type RegionalWorkspaceTask = {
  id: string;
  title: string;
  dealerName: string;
  tradePointName: string;
  dueDate: string;
  status: "new" | "in_progress" | "done" | "overdue";
  priority: "low" | "medium" | "high";
  type:
    | "visit"
    | "distribution_report"
    | "showcase_check"
    | "photo_report"
    | "dealer_feedback"
    | "pos_materials"
    | "competitor_check"
    | "contact_update";
};

export type RegionalAtRiskDealer = {
  dealerId: number;
  dealerName: string;
  city: string;
  reason: string;
  riskLevel: "medium" | "high" | "critical";
  lastVisitDate: string | null;
  nextAction: string;
};

export type RegionalShowcaseGoalSummary = {
  id: number;
  title: string;
  dealerName: string;
  tradePointName: string;
  status: ShowcaseGoal["goalStatus"];
  dueDate: string;
  progressPercent: number;
  sourceVisitId: number | null;
};

export type RegionalDistributionFocusItem = {
  category: string;
  missingModels: number;
  affectedTradePoints: number;
  priority: "low" | "medium" | "high";
  recommendation: string;
};

export type RegionalRecentActivityItem = {
  id: string;
  type:
    | "visit_completed"
    | "distribution_report_filled"
    | "showcase_goal_created"
    | "task_overdue"
    | "dealer_at_risk";
  title: string;
  description: string;
  createdAt: string;
};

export type RegionalManagerWorkspace = {
  manager: RegionalManagerWorkspaceManager;
  period: RegionalManagerWorkspacePeriod;
  kpis: RegionalManagerWorkspaceKpis;
  todayRoute: RegionalTodayRoute;
  upcomingVisits: RegionalUpcomingVisit[];
  tasks: RegionalWorkspaceTask[];
  atRiskDealers: RegionalAtRiskDealer[];
  showcaseGoals: RegionalShowcaseGoalSummary[];
  distributionFocus: RegionalDistributionFocusItem[];
  recentActivity: RegionalRecentActivityItem[];
};

export type SalesManagerProfile = {
  id: number;
  name: string;
  role: string;
  team: string;
  region: string;
  email: string;
  phone: string;
};

export type SalesManagerWorkspaceKpis = {
  assignedDealersCount: number;
  activeGoalsCount: number;
  activeTasksCount: number;
  overdueTasksCount: number;
  todayTasksCount: number;
  highPriorityItemsCount: number;
  dealersWithoutRecentActivityCount: number;
  openOrdersCount: number;
};

export type TodayFocusItem = {
  id: string;
  type:
    | "call_dealer"
    | "showcase_goal"
    | "prepare_offer"
    | "follow_up"
    | "check_order"
    | "assistant_task";
  title: string;
  dealerId: number;
  dealerName: string;
  tradePointName?: string;
  priority: "low" | "medium" | "high";
  dueTime?: string;
  dueDate: string;
  source: "showcase_goal" | "regional_report" | "manual" | "order" | "leadership";
  href: string;
  status: "new" | "in_progress" | "waiting_dealer" | "done" | "overdue";
};

export type AssignedDealerWorkspaceItem = {
  dealerId: number;
  dealerName: string;
  dealerType: string;
  city: string;
  region: string;
  segment: string;
  potentialLevel: string;
  status: string;
  tradePointCount: number;
  activeGoalsCount: number;
  activeTasksCount: number;
  overdueTasksCount: number;
  lastInteractionDate: string | null;
  nextAction: string;
  href: string;
};

export type ActiveShowcaseGoalWorkspaceItem = {
  id: number;
  title: string;
  dealerId: number;
  dealerName: string;
  tradePointName: string;
  status: ShowcaseGoal["goalStatus"];
  priority: ShowcaseGoal["priority"];
  dueDate: string;
  progressText: string;
  completedModelsCount: number;
  targetModelsCount: number;
  href: string;
};

export type SalesTaskWorkspaceItem = {
  id: number;
  title: string;
  dealerId: number;
  dealerName: string;
  tradePointName?: string;
  taskType: SalesTask["taskType"];
  status: SalesTask["taskStatus"];
  priority: SalesTask["priority"];
  dueDate: string;
  showcaseGoalId?: number;
  href: string;
};

export type ManagerOverdueItem = {
  id: string;
  type: "sales_task" | "showcase_goal" | "dealer_follow_up";
  title: string;
  dealerName: string;
  dueDate: string;
  severity: "medium" | "high" | "critical";
  href: string;
};

export type StaleDealerItem = {
  dealerId: number;
  dealerName: string;
  city: string;
  lastInteractionDate: string | null;
  daysWithoutActivity: number;
  riskReason: string;
  nextAction: string;
  href: string;
};

export type RegionalSignalItem = {
  id: string;
  sourceType: "visit" | "distribution_report" | "showcase_gap" | "comment";
  dealerId: number;
  dealerName: string;
  tradePointName: string;
  title: string;
  summary: string;
  createdAt: string;
  priority: "low" | "medium" | "high";
  href: string;
};

export type ManagerQuickAction = {
  title: string;
  description: string;
  href: string;
  actionType: string;
};

export type ClientImportSource = {
  id: string;
  source: "one_c" | "bitrix24" | "excel" | "manual";
  status: "planned_integration" | "available_mvp";
  title: string;
  description: string;
};

export type ClientImportTemplateField = {
  key: string;
  title: string;
  required: boolean;
  description: string;
  example: string;
};

export type ClientImportSummary = {
  totalRows: number;
  newDealers: number;
  updates: number;
  duplicates: number;
  errors: number;
  unassigned: number;
  active: number;
  potential: number;
};

export type ClientImportPreviewRow = {
  id: string;
  dealerName: string;
  importStatus: "new" | "update" | "duplicate" | "error" | "skipped";
  city: string;
  clientStatus: "active" | "potential" | "paused" | "lost" | "archived";
  salesManagerName: string | null;
  regionalManagerName: string | null;
  duplicateReason: string | null;
  errorReason: string | null;
  source: "one_c" | "bitrix24" | "excel" | "manual";
};

export type ClientImportIssue = {
  id: string;
  severity: "critical" | "high" | "medium";
  issueType: "validation" | "assignment" | "duplicate";
  message: string;
  count: number;
  recommendation: string;
};

export type ClientImportDuplicate = {
  id: string;
  dealerName: string;
  matchType: "inn" | "address" | "name";
  existingDealerName: string;
  reason: string;
};

export type ClientImportAssignmentGap = {
  type: "sales_manager_missing" | "regional_manager_missing" | "region_missing" | "team_unknown";
  count: number;
  description: string;
};

export type ClientImportPreview = {
  status: "draft" | "validated";
  sources: ClientImportSource[];
  summary: ClientImportSummary;
  rows: ClientImportPreviewRow[];
  issues: ClientImportIssue[];
  duplicates: ClientImportDuplicate[];
  assignmentGaps: ClientImportAssignmentGap[];
};

export type ClientImportCommitResult = {
  importedCount: number;
  updatedCount: number;
  skippedDuplicates: number;
  failedRows: number;
  createdAt: string;
  message: string;
};

export type SalesManagerWorkspace = {
  manager: SalesManagerProfile;
  kpis: SalesManagerWorkspaceKpis;
  todayFocus: TodayFocusItem[];
  assignedDealers: AssignedDealerWorkspaceItem[];
  activeShowcaseGoals: ActiveShowcaseGoalWorkspaceItem[];
  salesTasks: SalesTaskWorkspaceItem[];
  overdueItems: ManagerOverdueItem[];
  staleDealers: StaleDealerItem[];
  regionalSignals: RegionalSignalItem[];
  quickActions: ManagerQuickAction[];
};

export class StorageError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export interface IStorage {
  listOrganizations(): Promise<Organization[]>;
  listUsers(): Promise<User[]>;
  listRoles(): Promise<Role[]>;
  listUserRoles(): Promise<UserRole[]>;
  listDealers(): Promise<DealerListItem[]>;
  getDealerById(id: number): Promise<DealerDetail | undefined>;
  getTradePointsByDealerId(dealerId: number): Promise<TradePoint[]>;
  getDealerTasksByDealerId(dealerId: number): Promise<DealerTaskWithUsers[]>;
  getDealerInteractionsByDealerId(dealerId: number): Promise<DealerInteractionWithUser[]>;
  listProducts(): Promise<Product[]>;
  listOrders(): Promise<Order[]>;
  getOrderById(id: number): Promise<OrderDetails | undefined>;
  createOrder(input: CreateOrderInput): Promise<OrderDetails>;
  listClaims(): Promise<Claim[]>;
  listActivityEvents(): Promise<ActivityEvent[]>;
  listRegionalRoutes(): Promise<RegionalRoute[]>;
  getRegionalRouteById(id: number): Promise<RegionalRouteDetail | undefined>;
  getRegionalManagerVisitById(id: number): Promise<VisitDetail | undefined>;
  getDistributionReportByVisitId(visitId: number): Promise<DistributionReportResponse | undefined>;
  saveDistributionReportDraft(
    visitId: number,
    payload: DemoDistributionReportPayload,
  ): Promise<{ success: true; report: DistributionReportResponse }>;
  submitDistributionReport(
    visitId: number,
    payload: DemoDistributionReportPayload,
  ): Promise<{ success: true; message: string; report: DistributionReportResponse }>;
  listShowcaseGoals(): Promise<ShowcaseGoalListItem[]>;
  getShowcaseGoalById(id: number): Promise<ShowcaseGoalDetail | undefined>;
  listSalesTasks(): Promise<SalesTaskListItem[]>;
  getSalesTaskById(id: number): Promise<SalesTaskDetail | undefined>;
  updateShowcaseGoalStatus(
    id: number,
    status: ShowcaseGoal["goalStatus"],
  ): Promise<{ success: true; goal: ShowcaseGoalListItem }>;
  updateSalesTaskStatus(
    id: number,
    status: SalesTask["taskStatus"],
  ): Promise<{ success: true; task: SalesTaskListItem }>;
  createShowcaseGoalFromDistributionReport(
    visitId: number,
  ): Promise<{ success: true; message: string; goal: ShowcaseGoalListItem }>;
  getSalesLeadershipDashboard(): Promise<SalesLeadershipDashboard>;
  getRegionalManagerWorkspace(): Promise<RegionalManagerWorkspace>;
  getSalesManagerWorkspace(): Promise<SalesManagerWorkspace>;
  getClientImportTemplateFields(): Promise<ClientImportTemplateField[]>;
  getClientImportPreview(): Promise<ClientImportPreview>;
  validateClientImport(): Promise<ClientImportPreview & { status: "validated" }>;
  commitClientImport(): Promise<ClientImportCommitResult>;
}

const organizationsSeed: Organization[] = [
  {
    id: 1,
    name: "Tandoor HQ",
    orgType: "tandoor",
    taxId: "770401001",
    city: "Moscow",
    status: "active",
    createdAt: "2026-01-10T09:00:00.000Z",
  },
  {
    id: 2,
    name: "Дверной Дом Юг",
    orgType: "dealer",
    taxId: "2312012345",
    city: "Краснодар",
    status: "active",
    createdAt: "2026-01-12T08:15:00.000Z",
  },
  {
    id: 3,
    name: "Салон дверей Северный",
    orgType: "dealer",
    taxId: "2312012346",
    city: "Краснодар",
    status: "active",
    createdAt: "2026-01-13T10:25:00.000Z",
  },
  {
    id: 4,
    name: "Дом дверей Сочи",
    orgType: "dealer",
    taxId: "2312012347",
    city: "Сочи",
    status: "active",
    createdAt: "2026-01-15T11:05:00.000Z",
  },
  {
    id: 5,
    name: "SteelCore Supplier JSC",
    orgType: "supplier",
    taxId: "7722334455",
    city: "Tula",
    status: "active",
    createdAt: "2026-01-15T12:00:00.000Z",
  },
];

const rolesSeed: Role[] = [
  { id: 1, code: "admin", name: "Administrator", description: "Full access" },
  {
    id: 2,
    code: "sales_manager",
    name: "Sales Manager",
    description: "Manages customer orders",
  },
  {
    id: 3,
    code: "regional_manager",
    name: "Regional Manager",
    description: "Supervises regional dealer network",
  },
  {
    id: 4,
    code: "dealer_buyer",
    name: "Dealer Buyer",
    description: "Creates dealer purchase orders",
  },
  {
    id: 5,
    code: "warehouse_operator",
    name: "Warehouse Operator",
    description: "Controls stock and reservations",
  },
  {
    id: 6,
    code: "logistician",
    name: "Logistician",
    description: "Coordinates delivery workflow",
  },
  {
    id: 7,
    code: "service_specialist",
    name: "Service Specialist",
    description: "Handles claims and service requests",
  },
  {
    id: 8,
    code: "marketer",
    name: "Marketer",
    description: "Runs partner promotion programs",
  },
  {
    id: 9,
    code: "executive",
    name: "Executive",
    description: "Monitors top-level KPIs",
  },
  {
    id: 10,
    code: "supplier",
    name: "Supplier",
    description: "Represents supplier organization",
  },
];

const usersSeed: User[] = [
  {
    id: 1,
    organizationId: 1,
    firstName: "Karen",
    lastName: "Avedikyan",
    email: "k.avedikyan@tandoor.ru",
    phone: "+7 900 000-10-10",
    status: "active",
    createdAt: "2026-01-10T09:30:00.000Z",
  },
  {
    id: 2,
    organizationId: 1,
    firstName: "Ольга",
    lastName: "Соколова",
    email: "o.sokolova@tandoor.ru",
    phone: "+7 900 000-10-20",
    status: "active",
    createdAt: "2026-01-10T10:00:00.000Z",
  },
  {
    id: 3,
    organizationId: 1,
    firstName: "Дмитрий",
    lastName: "Романов",
    email: "d.romanov@tandoor.ru",
    phone: "+7 900 000-10-30",
    status: "active",
    createdAt: "2026-01-10T10:10:00.000Z",
  },
  {
    id: 4,
    organizationId: 1,
    firstName: "Мария",
    lastName: "Лебедева",
    email: "m.lebedeva@tandoor.ru",
    phone: "+7 900 000-10-40",
    status: "active",
    createdAt: "2026-01-10T10:20:00.000Z",
  },
  {
    id: 5,
    organizationId: 1,
    firstName: "Анна",
    lastName: "Кравченко",
    email: "a.kravchenko@tandoor.ru",
    phone: "+7 900 000-10-50",
    status: "active",
    createdAt: "2026-01-10T10:30:00.000Z",
  },
  {
    id: 6,
    organizationId: 1,
    firstName: "Сергей",
    lastName: "Волков",
    email: "s.volkov@tandoor.ru",
    phone: "+7 900 000-10-60",
    status: "active",
    createdAt: "2026-01-10T10:40:00.000Z",
  },
  {
    id: 7,
    organizationId: 1,
    firstName: "Игорь",
    lastName: "Мельников",
    email: "i.melnikov@tandoor.ru",
    phone: "+7 900 000-10-70",
    status: "active",
    createdAt: "2026-01-10T10:50:00.000Z",
  },
  {
    id: 8,
    organizationId: 5,
    firstName: "Павел",
    lastName: "Серов",
    email: "p.serov@steelcore.ru",
    phone: "+7 487 200-44-11",
    status: "active",
    createdAt: "2026-01-15T12:05:00.000Z",
  },
];

const userRolesSeed: UserRole[] = [
  { id: 1, userId: 1, roleId: 1, assignedAt: "2026-01-10T09:31:00.000Z" },
  { id: 2, userId: 2, roleId: 2, assignedAt: "2026-01-10T10:01:00.000Z" },
  { id: 3, userId: 2, roleId: 3, assignedAt: "2026-01-10T10:02:00.000Z" },
  { id: 4, userId: 3, roleId: 2, assignedAt: "2026-01-10T10:11:00.000Z" },
  { id: 5, userId: 4, roleId: 3, assignedAt: "2026-01-10T10:21:00.000Z" },
  { id: 6, userId: 5, roleId: 2, assignedAt: "2026-01-10T10:31:00.000Z" },
  { id: 7, userId: 6, roleId: 2, assignedAt: "2026-01-10T10:41:00.000Z" },
  { id: 8, userId: 7, roleId: 3, assignedAt: "2026-01-10T10:51:00.000Z" },
  { id: 9, userId: 8, roleId: 10, assignedAt: "2026-01-15T12:06:00.000Z" },
];

const dealersSeed: Dealer[] = [
  {
    id: 1,
    organizationId: 2,
    name: "Дверной Дом Юг",
    dealerType: "network",
    segment: "сеть салонов дверей",
    region: "Краснодарский край",
    city: "Краснодар",
    salesManagerId: 5,
    regionalManagerId: 7,
    potentialLevel: "high",
    status: "active",
    managerUserId: 5,
    tier: "high",
    comment: "Ключевой сетевой партнёр на Юге, растущая выкладка и витрины.",
    createdAt: "2026-01-12T08:50:00.000Z",
  },
  {
    id: 2,
    organizationId: 3,
    name: "Салон дверей Северный",
    dealerType: "single",
    segment: "одиночный салон",
    region: "Краснодарский край",
    city: "Краснодар",
    salesManagerId: 5,
    regionalManagerId: 7,
    potentialLevel: "medium",
    status: "active",
    managerUserId: 5,
    tier: "medium",
    comment: "Точка в развитии: согласование ассортимента и обучение персонала.",
    createdAt: "2026-01-13T11:25:00.000Z",
  },
  {
    id: 3,
    organizationId: 4,
    name: "Дом дверей Сочи",
    dealerType: "single",
    segment: "региональный дилер",
    region: "Краснодарский край",
    city: "Сочи",
    salesManagerId: 5,
    regionalManagerId: 7,
    potentialLevel: "medium",
    status: "active",
    managerUserId: 5,
    tier: "medium",
    comment: "Стабильные заказы, фокус на витрине премиум-серии в сезон.",
    createdAt: "2026-01-14T09:15:00.000Z",
  },
];

const tradePointsSeed: TradePoint[] = [
  {
    id: 1,
    dealerId: 1,
    name: "Дверной Дом Юг — Краснодар",
    city: "Краснодар",
    address: "ул. Северная, 320",
    storeFormat: "showroom",
    areaSqm: 180,
    assortmentProfile: "входные и межкомнатные, премиум",
    status: "active",
    comment: null,
    createdAt: "2026-01-12T08:55:00.000Z",
  },
  {
    id: 2,
    dealerId: 1,
    name: "Дверной Дом Юг — Анапа",
    city: "Анапа",
    address: "ул. Ленина, 14",
    storeFormat: "showroom",
    areaSqm: 95,
    assortmentProfile: "входные, массив",
    status: "active",
    comment: null,
    createdAt: "2026-01-16T10:05:00.000Z",
  },
  {
    id: 3,
    dealerId: 1,
    name: "Дверной Дом Юг — Новороссийск",
    city: "Новороссийск",
    address: "пр-т Дзержинского, 211",
    storeFormat: "mixed",
    areaSqm: 120,
    assortmentProfile: "смешанный формат, усиление витрины",
    status: "active",
    comment: null,
    createdAt: "2026-01-19T11:20:00.000Z",
  },
  {
    id: 4,
    dealerId: 2,
    name: "Салон дверей Северный",
    city: "Краснодар",
    address: "ул. Российская, 74",
    storeFormat: "showroom",
    areaSqm: 65,
    assortmentProfile: "межкомнатные, средний сегмент",
    status: "active",
    comment: null,
    createdAt: "2026-01-13T11:35:00.000Z",
  },
  {
    id: 5,
    dealerId: 3,
    name: "Дом дверей Сочи",
    city: "Сочи",
    address: "ул. Пластунская, 52",
    storeFormat: "showroom",
    areaSqm: 45,
    assortmentProfile: "компактная витрина, курортный трафик",
    status: "active",
    comment: null,
    createdAt: "2026-01-14T09:25:00.000Z",
  },
];

const dealerTasksSeed: DealerTask[] = [
  {
    id: 1,
    dealerId: 1,
    tradePointId: 1,
    assignedToUserId: 5,
    createdByUserId: 7,
    type: "showcase_goal",
    title: "Цель по витрине: линия Loft в Краснодаре",
    description: "Согласовать план выкладки серии Loft в основном зале до конца квартала.",
    status: "in_progress",
    priority: "high",
    dueDate: "2026-04-15",
    source: "manual",
    createdAt: "2026-04-01T10:00:00.000Z",
    completedAt: null,
  },
  {
    id: 2,
    dealerId: 1,
    tradePointId: null,
    assignedToUserId: 5,
    createdByUserId: 5,
    type: "distribution_gap",
    title: "Звонок по отгрузке и условиям",
    description: "Уточнить сроки поставки и коммерческие условия по текущему договору.",
    status: "done",
    priority: "medium",
    dueDate: "2026-03-28",
    source: "distribution_report",
    createdAt: "2026-03-20T11:00:00.000Z",
    completedAt: "2026-03-27T16:00:00.000Z",
  },
  {
    id: 3,
    dealerId: 1,
    tradePointId: 2,
    assignedToUserId: 7,
    createdByUserId: 2,
    type: "other",
    title: "Проверить наличие POSM",
    description: "Проверить наличие и корректность размещения POSM-материалов.",
    status: "new",
    priority: "medium",
    dueDate: "2026-04-20",
    source: "visit",
    createdAt: "2026-04-10T08:00:00.000Z",
    completedAt: null,
  },
  {
    id: 4,
    dealerId: 2,
    tradePointId: 4,
    assignedToUserId: 6,
    createdByUserId: 5,
    type: "sales_follow_up",
    title: "Комплект документов к договору",
    description: "Подготовить шаблоны актов и спецификации для подписания.",
    status: "in_progress",
    priority: "low",
    dueDate: "2026-04-12",
    source: "order",
    createdAt: "2026-04-05T12:00:00.000Z",
    completedAt: null,
  },
  {
    id: 5,
    dealerId: 2,
    tradePointId: null,
    assignedToUserId: 5,
    createdByUserId: 7,
    type: "other",
    title: "Синхронизация по ТТ в развитии",
    description: "Согласовать график выездов и приоритеты витрины.",
    status: "new",
    priority: "medium",
    dueDate: "2026-04-18",
    source: "visit",
    createdAt: "2026-04-08T14:00:00.000Z",
    completedAt: null,
  },
  {
    id: 6,
    dealerId: 3,
    tradePointId: 5,
    assignedToUserId: 7,
    createdByUserId: 5,
    type: "visit_follow_up",
    title: "Обновить витрину входных дверей",
    description: "Обновить выкладку входных дверей по результатам визита РМ.",
    status: "new",
    priority: "high",
    dueDate: "2026-04-11",
    source: "visit",
    createdAt: "2026-04-09T09:30:00.000Z",
    completedAt: null,
  },
  {
    id: 7,
    dealerId: 3,
    tradePointId: null,
    assignedToUserId: 4,
    createdByUserId: 3,
    type: "document",
    title: "Подготовить пакет документов по дилеру",
    description: "Проверить и подготовить документы для обновления условий сотрудничества.",
    status: "new",
    priority: "low",
    dueDate: "2026-04-22",
    source: "manual",
    createdAt: "2026-04-12T10:00:00.000Z",
    completedAt: null,
  },
];

const dealerInteractionsSeed: DealerInteraction[] = [
  {
    id: 1,
    dealerId: 1,
    tradePointId: 1,
    userId: 5,
    roleContext: "sales_manager",
    type: "call",
    summary: "Короткий звонок: подтверждение поставки и согласование встречи по витрине.",
    createdAt: "2026-04-02T09:00:00.000Z",
  },
  {
    id: 2,
    dealerId: 1,
    tradePointId: 1,
    userId: 7,
    roleContext: "regional_manager",
    type: "visit",
    summary: "Полевой визит в Краснодар, осмотр основной витрины, отметка по дистрибуции.",
    createdAt: "2026-04-03T11:30:00.000Z",
  },
  {
    id: 3,
    dealerId: 1,
    tradePointId: 2,
    userId: 7,
    roleContext: "regional_manager",
    type: "task_created",
    summary: "Создана задача по расширению матрицы в Анапе.",
    createdAt: "2026-04-04T08:15:00.000Z",
  },
  {
    id: 4,
    dealerId: 2,
    tradePointId: 4,
    userId: 5,
    roleContext: "sales_manager",
    type: "meeting",
    summary: "Онлайн-встреча с владельцем: дорожная карта развития точки.",
    createdAt: "2026-04-05T10:00:00.000Z",
  },
  {
    id: 5,
    dealerId: 2,
    tradePointId: null,
    userId: 1,
    roleContext: "system",
    type: "task_created",
    summary: "Создана операционная задача ассистенту по подготовке документов к договору.",
    createdAt: "2026-04-05T12:00:00.000Z",
  },
  {
    id: 6,
    dealerId: 2,
    tradePointId: null,
    userId: 5,
    roleContext: "sales_manager",
    type: "order",
    summary: "Оформлен заказ по обновленной матрице дилера.",
    createdAt: "2026-04-05T15:00:00.000Z",
  },
  {
    id: 7,
    dealerId: 3,
    tradePointId: 5,
    userId: 7,
    roleContext: "regional_manager",
    type: "visit",
    summary: "Плановый визит в Сочи, согласование площади под новую витрину.",
    createdAt: "2026-04-07T13:00:00.000Z",
  },
  {
    id: 8,
    dealerId: 3,
    tradePointId: 5,
    userId: 5,
    roleContext: "sales_manager",
    type: "claim",
    summary: "Зафиксирована рекламация по повреждению упаковки, согласованы корректирующие действия.",
    createdAt: "2026-04-09T09:00:00.000Z",
  },
];

const productsSeed: Product[] = [
  {
    id: 1,
    sku: "TD-ENTRY-860-BLK",
    name: "Tandoor Entry 860",
    category: "entry_door",
    finishColor: "Graphite Black",
    priceCents: 6890000,
    currency: "RUB",
    availabilityStatus: "in_stock",
    stockQty: 24,
    createdAt: "2026-01-16T08:00:00.000Z",
  },
  {
    id: 2,
    sku: "TD-ENTRY-960-OAK",
    name: "Tandoor Entry 960",
    category: "entry_door",
    finishColor: "Natural Oak",
    priceCents: 7450000,
    currency: "RUB",
    availabilityStatus: "in_stock",
    stockQty: 17,
    createdAt: "2026-01-16T08:02:00.000Z",
  },
  {
    id: 3,
    sku: "TD-LINE-GLASS-WHT",
    name: "Tandoor Line Glass",
    category: "interior_door",
    finishColor: "Polar White",
    priceCents: 3820000,
    currency: "RUB",
    availabilityStatus: "limited",
    stockQty: 8,
    createdAt: "2026-01-16T08:04:00.000Z",
  },
  {
    id: 4,
    sku: "TD-FIRE-900-MTL",
    name: "Tandoor FireSafe 900",
    category: "fire_door",
    finishColor: "Metal Gray",
    priceCents: 9120000,
    currency: "RUB",
    availabilityStatus: "in_stock",
    stockQty: 11,
    createdAt: "2026-01-16T08:06:00.000Z",
  },
  {
    id: 5,
    sku: "TD-LOFT-880-GRN",
    name: "Tandoor Loft 880",
    category: "entry_door",
    finishColor: "Olive Green",
    priceCents: 6990000,
    currency: "RUB",
    availabilityStatus: "backorder",
    stockQty: 0,
    createdAt: "2026-01-16T08:08:00.000Z",
  },
];

const ordersSeed: Order[] = [
  {
    id: 1,
    orderNumber: "ORD-2026-0001",
    organizationId: 1,
    dealerId: 1,
    createdByUserId: 5,
    status: "submitted",
    totalCents: 20670000,
    currency: "RUB",
    requestedDeliveryDate: "2026-02-05",
    createdAt: "2026-01-20T10:15:00.000Z",
    updatedAt: "2026-01-20T10:15:00.000Z",
  },
  {
    id: 2,
    orderNumber: "ORD-2026-0002",
    organizationId: 1,
    dealerId: 2,
    createdByUserId: 5,
    status: "assembling",
    totalCents: 14900000,
    currency: "RUB",
    requestedDeliveryDate: "2026-02-08",
    createdAt: "2026-01-21T09:40:00.000Z",
    updatedAt: "2026-01-23T12:00:00.000Z",
  },
  {
    id: 3,
    orderNumber: "ORD-2026-0003",
    organizationId: 1,
    dealerId: 1,
    createdByUserId: 5,
    status: "shipped",
    totalCents: 9120000,
    currency: "RUB",
    requestedDeliveryDate: "2026-01-30",
    createdAt: "2026-01-18T14:10:00.000Z",
    updatedAt: "2026-01-24T07:30:00.000Z",
  },
];

const orderItemsSeed: OrderItem[] = [
  {
    id: 1,
    orderId: 1,
    productId: 1,
    quantity: 2,
    unitPriceCents: 6890000,
    totalPriceCents: 13780000,
  },
  {
    id: 2,
    orderId: 1,
    productId: 3,
    quantity: 1,
    unitPriceCents: 3820000,
    totalPriceCents: 3820000,
  },
  {
    id: 3,
    orderId: 1,
    productId: 2,
    quantity: 1,
    unitPriceCents: 7450000,
    totalPriceCents: 7450000,
  },
  {
    id: 4,
    orderId: 2,
    productId: 2,
    quantity: 2,
    unitPriceCents: 7450000,
    totalPriceCents: 14900000,
  },
  {
    id: 5,
    orderId: 3,
    productId: 4,
    quantity: 1,
    unitPriceCents: 9120000,
    totalPriceCents: 9120000,
  },
];

const documentsSeed: Document[] = [
  {
    id: 1,
    organizationId: 1,
    orderId: 1,
    type: "invoice",
    title: "Invoice INV-0001",
    fileUrl: "/docs/invoice-inv-0001.pdf",
    status: "published",
    createdAt: "2026-01-20T10:20:00.000Z",
  },
  {
    id: 2,
    organizationId: 1,
    orderId: 2,
    type: "contract",
    title: "Supply Contract SC-2026-02",
    fileUrl: "/docs/contract-sc-2026-02.pdf",
    status: "published",
    createdAt: "2026-01-21T10:00:00.000Z",
  },
  {
    id: 3,
    organizationId: 1,
    orderId: 3,
    type: "shipment_document",
    title: "Shipment Waybill SHP-143",
    fileUrl: "/docs/waybill-shp-143.pdf",
    status: "published",
    createdAt: "2026-01-24T07:35:00.000Z",
  },
];

const claimsSeed: Claim[] = [
  {
    id: 1,
    claimNumber: "CLM-2026-001",
    organizationId: 1,
    dealerId: 1,
    orderId: 3,
    status: "in_review",
    reason: "Packaging damage",
    description: "Minor panel scratches found on delivery.",
    resolutionNote: null,
    createdAt: "2026-01-25T11:10:00.000Z",
    updatedAt: "2026-01-25T11:30:00.000Z",
  },
  {
    id: 2,
    claimNumber: "CLM-2026-002",
    organizationId: 1,
    dealerId: 2,
    orderId: null,
    status: "new",
    reason: "Wrong finish color",
    description: "Requested oak finish, delivered white finish.",
    resolutionNote: null,
    createdAt: "2026-01-26T09:25:00.000Z",
    updatedAt: "2026-01-26T09:25:00.000Z",
  },
];

const activityEventsSeed: ActivityEvent[] = [
  {
    id: 1,
    eventType: "order_created",
    entityType: "order",
    entityId: 1,
    organizationId: 1,
    userId: 5,
    orderId: 1,
    claimId: null,
    message: "Создан заказ ORD-2026-0001 менеджером продаж.",
    createdAt: "2026-01-20T10:15:00.000Z",
  },
  {
    id: 2,
    eventType: "document_added",
    entityType: "document",
    entityId: 1,
    organizationId: 1,
    userId: 5,
    orderId: 1,
    claimId: null,
    message: "К заказу ORD-2026-0001 добавлен счёт INV-0001.",
    createdAt: "2026-01-20T10:20:00.000Z",
  },
  {
    id: 3,
    eventType: "order_status_changed",
    entityType: "order",
    entityId: 2,
    organizationId: 1,
    userId: 5,
    orderId: 2,
    claimId: null,
    message: "Заказ ORD-2026-0002 переведён в комплектацию.",
    createdAt: "2026-01-23T12:00:00.000Z",
  },
  {
    id: 4,
    eventType: "order_status_changed",
    entityType: "order",
    entityId: 3,
    organizationId: 1,
    userId: 5,
    orderId: 3,
    claimId: null,
    message: "Заказ ORD-2026-0003 отгружен со склада.",
    createdAt: "2026-01-24T07:30:00.000Z",
  },
  {
    id: 5,
    eventType: "claim_created",
    entityType: "claim",
    entityId: 1,
    organizationId: 1,
    userId: 5,
    orderId: 3,
    claimId: 1,
    message: "Создана рекламация CLM-2026-001 по заказу ORD-2026-0003.",
    createdAt: "2026-01-25T11:10:00.000Z",
  },
  {
    id: 6,
    eventType: "claim_created",
    entityType: "claim",
    entityId: 2,
    organizationId: 1,
    userId: 5,
    orderId: null,
    claimId: 2,
    message: "Создана рекламация CLM-2026-002 без привязки к заказу.",
    createdAt: "2026-01-26T09:25:00.000Z",
  },
];

const regionalRoutesSeed: RegionalRoute[] = [
  {
    id: 1,
    regionalManagerId: 7,
    routeDate: "2026-04-27",
    title: "Маршрут Юг / Краснодар",
    region: "Краснодарский край",
    status: "in_progress",
    plannedVisitsCount: 5,
    completedVisitsCount: 2,
    createdAt: "2026-04-27T07:00:00.000Z",
  },
];

const routeVisitsSeed: RouteVisit[] = [
  {
    id: 1,
    routeId: 1,
    dealerId: 1,
    tradePointId: 1,
    plannedTime: "09:30",
    visitStatus: "completed",
    visitPurpose: "distribution_check",
    priority: "high",
    comment: "Витрина в хорошем состоянии, есть пробелы по премиум-моделям.",
    startedAt: "2026-04-27T09:35:00.000Z",
    completedAt: "2026-04-27T10:20:00.000Z",
  },
  {
    id: 2,
    routeId: 1,
    dealerId: 2,
    tradePointId: 4,
    plannedTime: "11:30",
    visitStatus: "in_progress",
    visitPurpose: "showcase_check",
    priority: "high",
    comment: "Идет фотофиксация выкладки и проверка POSM.",
    startedAt: "2026-04-27T11:42:00.000Z",
    completedAt: null,
  },
  {
    id: 3,
    routeId: 1,
    dealerId: 1,
    tradePointId: 2,
    plannedTime: "14:30",
    visitStatus: "planned",
    visitPurpose: "distribution_check",
    priority: "medium",
    comment: "Проверка представленности ключевых моделей.",
    startedAt: null,
    completedAt: null,
  },
  {
    id: 4,
    routeId: 1,
    dealerId: 1,
    tradePointId: 3,
    plannedTime: "16:30",
    visitStatus: "planned",
    visitPurpose: "training",
    priority: "medium",
    comment: "Короткое обучение консультантов по новой линейке.",
    startedAt: null,
    completedAt: null,
  },
  {
    id: 5,
    routeId: 1,
    dealerId: 3,
    tradePointId: 5,
    plannedTime: "18:00",
    visitStatus: "planned",
    visitPurpose: "order_follow_up",
    priority: "low",
    comment: "Проверка статуса заказов и обновление приоритетов.",
    startedAt: null,
    completedAt: null,
  },
];

const distributionReportsSeed: DistributionReport[] = [
  {
    id: 1,
    visitId: 1,
    dealerId: 1,
    tradePointId: 1,
    regionalManagerId: 7,
    reportStatus: "draft",
    hasShowcase: 1,
    showcaseDoorsCount: 12,
    totalModelsChecked: 8,
    presentModelsCount: 5,
    missingModelsCount: 3,
    displayQuality: "good",
    competitorPresence: "medium",
    recommendation: "Усилить премиум-серию и обновить POSM.",
    nextAction:
      "Поставить цель менеджеру продаж: согласовать выставление 3 недостающих моделей.",
    createdAt: "2026-04-27T10:25:00.000Z",
    submittedAt: null,
  },
];

const distributionReportItemsSeed: DistributionReportItem[] = [
  {
    id: 1,
    reportId: 1,
    productId: 1,
    modelName: "Tandoor Classic 80",
    sku: "TD-ENTRY-860-BLK",
    category: "entry_door",
    isPresent: 1,
    isOnShowcase: 1,
    stockStatus: "in_stock",
    comment: "Стабильный спрос, модель стоит на центральной витрине.",
  },
  {
    id: 2,
    reportId: 1,
    productId: 2,
    modelName: "Tandoor Line 90",
    sku: "TD-ENTRY-960-OAK",
    category: "entry_door",
    isPresent: 1,
    isOnShowcase: 0,
    stockStatus: "low_stock",
    comment: "Есть в остатках, но не выставлена фронтально.",
  },
  {
    id: 3,
    reportId: 1,
    productId: 3,
    modelName: "Tandoor Premium 100",
    sku: "TD-LINE-GLASS-WHT",
    category: "interior_door",
    isPresent: 0,
    isOnShowcase: 0,
    stockStatus: "out_of_stock",
    comment: "Не представлена в торговом зале.",
  },
  {
    id: 4,
    reportId: 1,
    productId: 5,
    modelName: "Tandoor Loft Graphite",
    sku: "TD-LOFT-880-GRN",
    category: "entry_door",
    isPresent: 1,
    isOnShowcase: 1,
    stockStatus: "low_stock",
    comment: "Хорошая выкладка, нужна дозаявка.",
  },
  {
    id: 5,
    reportId: 1,
    productId: 4,
    modelName: "Tandoor Urban White",
    sku: "TD-FIRE-900-MTL",
    category: "fire_door",
    isPresent: 0,
    isOnShowcase: 0,
    stockStatus: "unknown",
    comment: "Данные по доступности уточняются с менеджером салона.",
  },
];

const clientImportTemplateFieldsSeed: ClientImportTemplateField[] = [
  {
    key: "dealer_name",
    title: "Название дилера",
    required: true,
    description: "Юридическое или коммерческое название дилера",
    example: "Двери Кубани",
  },
  {
    key: "dealer_tax_id_or_code",
    title: "ИНН или внутренний код",
    required: true,
    description: "ИНН контрагента или внутренний идентификатор из текущей системы",
    example: "2312012999",
  },
  {
    key: "city",
    title: "Город",
    required: true,
    description: "Город основной торговой точки",
    example: "Краснодар",
  },
  {
    key: "trade_point_address",
    title: "Адрес торговой точки",
    required: true,
    description: "Фактический адрес точки продаж",
    example: "ул. Ставропольская, 100",
  },
  {
    key: "dealer_type",
    title: "Тип дилера",
    required: true,
    description: "Тип дилера: сетевой или одиночный",
    example: "network",
  },
  {
    key: "client_lifecycle_status",
    title: "Статус клиента",
    required: true,
    description: "Жизненный цикл клиента: активный/потенциальный/приостановлен/потерян",
    example: "potential",
  },
  {
    key: "sales_manager_name",
    title: "Ответственный менеджер продаж",
    required: true,
    description: "ФИО менеджера продаж",
    example: "Анна Кравченко",
  },
  {
    key: "regional_manager_name",
    title: "Ответственный региональный менеджер",
    required: true,
    description: "ФИО регионального менеджера",
    example: "Игорь Мельников",
  },
  {
    key: "phone",
    title: "Телефон",
    required: false,
    description: "Контактный номер дилера",
    example: "+7 900 123-45-67",
  },
  {
    key: "email",
    title: "Email",
    required: false,
    description: "Контактный email дилера",
    example: "info@doors-kuban.ru",
  },
  {
    key: "trade_point_format",
    title: "Формат торговой точки",
    required: false,
    description: "Формат точки: шоурум/магазин/смешанный",
    example: "showroom",
  },
  {
    key: "store_area",
    title: "Площадь магазина",
    required: false,
    description: "Площадь торговой точки в м2",
    example: "120",
  },
  {
    key: "assortment",
    title: "Ассортимент",
    required: false,
    description: "Профиль ассортимента дилера",
    example: "входные и межкомнатные двери",
  },
  {
    key: "comment",
    title: "Комментарий",
    required: false,
    description: "Свободный комментарий менеджера",
    example: "Точка в развитии, нужен follow-up",
  },
  {
    key: "source",
    title: "Источник",
    required: false,
    description: "Система-источник записи",
    example: "excel",
  },
  {
    key: "last_contact_date",
    title: "Дата последнего контакта",
    required: false,
    description: "Дата последнего контакта с дилером",
    example: "2026-04-20",
  },
];

const clientImportPreviewSeed: ClientImportPreview = {
  status: "draft",
  sources: [
    {
      id: "source-1c",
      source: "one_c",
      title: "1С",
      status: "planned_integration",
      description:
        "Контрагенты, ИНН, договоры, заказы, отгрузки и оплаты будут синхронизированы в единую CRM-структуру.",
    },
    {
      id: "source-bitrix24",
      source: "bitrix24",
      title: "Битрикс24",
      status: "planned_integration",
      description:
        "Лиды, сделки, звонки, задачи и история коммуникаций будут сопоставлены с дилерской карточкой.",
    },
    {
      id: "source-excel",
      source: "excel",
      title: "Excel / CSV",
      status: "available_mvp",
      description:
        "Первичная массовая загрузка и рабочие таблицы менеджеров доступны в демо-режиме MVP.",
    },
  ],
  summary: {
    totalRows: 1240,
    newDealers: 890,
    updates: 260,
    duplicates: 47,
    errors: 43,
    unassigned: 180,
    active: 620,
    potential: 390,
  },
  rows: [
    {
      id: "row-1",
      dealerName: "Двери Кубани",
      importStatus: "new",
      city: "Краснодар",
      clientStatus: "potential",
      salesManagerName: null,
      regionalManagerName: null,
      duplicateReason: null,
      errorReason: null,
      source: "excel",
    },
    {
      id: "row-2",
      dealerName: "Дверной Дом Юг",
      importStatus: "update",
      city: "Краснодар",
      clientStatus: "active",
      salesManagerName: "Анна Кравченко",
      regionalManagerName: "Игорь Мельников",
      duplicateReason: null,
      errorReason: null,
      source: "one_c",
    },
    {
      id: "row-3",
      dealerName: "Салон Северный",
      importStatus: "duplicate",
      city: "Ростов-на-Дону",
      clientStatus: "potential",
      salesManagerName: "Анна Кравченко",
      regionalManagerName: "Игорь Мельников",
      duplicateReason: "Совпадение по ИНН и адресу с существующим дилером.",
      errorReason: null,
      source: "bitrix24",
    },
    {
      id: "row-4",
      dealerName: "Мир Дверей Анапа",
      importStatus: "error",
      city: "Анапа",
      clientStatus: "potential",
      salesManagerName: null,
      regionalManagerName: null,
      duplicateReason: null,
      errorReason: "Не заполнен ИНН или код клиента.",
      source: "excel",
    },
  ],
  issues: [
    {
      id: "issue-1",
      severity: "critical",
      issueType: "validation",
      message: "Не заполнен город",
      count: 14,
      recommendation: "Заполнить город в исходном файле и повторить проверку.",
    },
    {
      id: "issue-2",
      severity: "high",
      issueType: "assignment",
      message: "Не найден ответственный менеджер",
      count: 180,
      recommendation: "Назначить менеджера продаж перед загрузкой в CRM.",
    },
    {
      id: "issue-3",
      severity: "medium",
      issueType: "validation",
      message: "Некорректный телефон",
      count: 29,
      recommendation: "Проверить формат номера телефона и повторно провалидировать файл.",
    },
  ],
  duplicates: [
    {
      id: "duplicate-1",
      dealerName: "Салон Северный",
      matchType: "inn",
      existingDealerName: "Салон дверей Северный",
      reason: "Совпадение по ИНН с существующим дилером",
    },
    {
      id: "duplicate-2",
      dealerName: "Салон Северный",
      matchType: "address",
      existingDealerName: "Салон дверей Северный",
      reason: "Совпадение адреса торговой точки",
    },
  ],
  assignmentGaps: [
    {
      type: "sales_manager_missing",
      count: 180,
      description: "Клиентов без менеджера продаж",
    },
    {
      type: "regional_manager_missing",
      count: 95,
      description: "Клиентов без регионального менеджера",
    },
    {
      type: "region_missing",
      count: 37,
      description: "Клиентов без региона",
    },
    {
      type: "team_unknown",
      count: 22,
      description: "Клиентов с неизвестной командой",
    },
  ],
};

const clientImportCommitResultSeed: ClientImportCommitResult = {
  importedCount: 890,
  updatedCount: 260,
  skippedDuplicates: 47,
  failedRows: 43,
  createdAt: "2026-04-27T16:20:00.000Z",
  message:
    "Импорт выполнен в демо-режиме: новые дилеры добавлены, существующие обновлены, дубли и ошибки вынесены на ручную проверку.",
};

const showcaseGoalsSeed: ShowcaseGoal[] = [
  {
    id: 1,
    dealerId: 1,
    tradePointId: 1,
    distributionReportId: 1,
    createdByUserId: 7,
    assignedToUserId: 5,
    title: "Выставить недостающие модели премиум-серии",
    description:
      "На основании отчета дистрибуции визита №1 согласовать и довести до витрины недостающие модели премиум-серии.",
    goalStatus: "in_progress",
    priority: "high",
    dueDate: "2026-05-05",
    source: "distribution_report",
    targetModelsCount: 3,
    completedModelsCount: 1,
    createdAt: "2026-04-27T10:45:00.000Z",
    completedAt: null,
  },
  {
    id: 2,
    dealerId: 2,
    tradePointId: 4,
    distributionReportId: null,
    createdByUserId: 4,
    assignedToUserId: 5,
    title: "Согласовать базовую витрину Tandoor",
    description:
      "Сформировать и утвердить базовую матрицу витрины по 4 моделям для точки в Краснодаре.",
    goalStatus: "new",
    priority: "high",
    dueDate: "2026-05-10",
    source: "regional_manager",
    targetModelsCount: 4,
    completedModelsCount: 0,
    createdAt: "2026-04-27T11:40:00.000Z",
    completedAt: null,
  },
  {
    id: 3,
    dealerId: 3,
    tradePointId: 5,
    distributionReportId: null,
    createdByUserId: 2,
    assignedToUserId: 5,
    title: "Обновить POSM и добавить сезонные модели",
    description:
      "Подготовить обновление витрины в Сочи: POSM-материалы и 2 сезонные модели для курортного трафика.",
    goalStatus: "agreed",
    priority: "medium",
    dueDate: "2026-05-15",
    source: "sales_head",
    targetModelsCount: 2,
    completedModelsCount: 1,
    createdAt: "2026-04-27T12:20:00.000Z",
    completedAt: null,
  },
];

const showcaseGoalItemsSeed: ShowcaseGoalItem[] = [
  {
    id: 1,
    goalId: 1,
    productId: 3,
    modelName: "Tandoor Premium 100",
    sku: "TD-LINE-GLASS-WHT",
    category: "interior_door",
    currentState: "missing",
    targetState: "on_showcase",
    itemStatus: "new",
    comment: "Отсутствует в ТТ, требуется выставление на центральной витрине.",
  },
  {
    id: 2,
    goalId: 1,
    productId: 4,
    modelName: "Tandoor Urban White",
    sku: "TD-FIRE-900-MTL",
    category: "fire_door",
    currentState: "missing",
    targetState: "on_showcase",
    itemStatus: "agreed",
    comment: "Согласовать с дилером место в витринной матрице.",
  },
  {
    id: 3,
    goalId: 1,
    productId: 5,
    modelName: "Tandoor Loft Graphite",
    sku: "TD-LOFT-880-GRN",
    category: "entry_door",
    currentState: "in_stock_not_showcase",
    targetState: "on_showcase",
    itemStatus: "completed",
    comment: "Модель выставлена по согласованию с дилером.",
  },
  {
    id: 4,
    goalId: 2,
    productId: 1,
    modelName: "Tandoor Entry 860",
    sku: "TD-ENTRY-860-BLK",
    category: "entry_door",
    currentState: "unknown",
    targetState: "on_showcase",
    itemStatus: "new",
    comment: "Требуется согласование базовой позиции.",
  },
  {
    id: 5,
    goalId: 2,
    productId: 2,
    modelName: "Tandoor Entry 960",
    sku: "TD-ENTRY-960-OAK",
    category: "entry_door",
    currentState: "unknown",
    targetState: "on_showcase",
    itemStatus: "new",
    comment: "Проверить позиционирование на витрине.",
  },
  {
    id: 6,
    goalId: 2,
    productId: 3,
    modelName: "Tandoor Premium 100",
    sku: "TD-LINE-GLASS-WHT",
    category: "interior_door",
    currentState: "missing",
    targetState: "on_showcase",
    itemStatus: "new",
    comment: "Добавить в обязательную витринную матрицу.",
  },
  {
    id: 7,
    goalId: 2,
    productId: 4,
    modelName: "Tandoor Urban White",
    sku: "TD-FIRE-900-MTL",
    category: "fire_door",
    currentState: "missing",
    targetState: "on_showcase",
    itemStatus: "new",
    comment: "Согласовать поставку образца.",
  },
  {
    id: 8,
    goalId: 3,
    productId: 1,
    modelName: "Tandoor Entry 860",
    sku: "TD-ENTRY-860-BLK",
    category: "entry_door",
    currentState: "in_stock_not_showcase",
    targetState: "on_showcase",
    itemStatus: "completed",
    comment: "Модель уже выставлена после согласования.",
  },
  {
    id: 9,
    goalId: 3,
    productId: null,
    modelName: "Сезонная модель Summer Line",
    sku: "TD-SUMMER-LINE",
    category: "interior_door",
    currentState: "missing",
    targetState: "ordered",
    itemStatus: "ordered",
    comment: "Ожидается поставка образца к майской кампании.",
  },
];

const salesTasksSeed: SalesTask[] = [
  {
    id: 1,
    dealerId: 1,
    tradePointId: 1,
    showcaseGoalId: 1,
    assignedToUserId: 5,
    createdByUserId: 7,
    taskType: "call_dealer",
    title: "Позвонить дилеру и согласовать выставление Premium 100",
    description:
      "Связаться с управляющим ТТ и согласовать финальный слот на витрине для Premium 100.",
    taskStatus: "in_progress",
    priority: "high",
    dueDate: "2026-05-01",
    createdAt: "2026-04-27T10:50:00.000Z",
    completedAt: null,
  },
  {
    id: 2,
    dealerId: 1,
    tradePointId: 1,
    showcaseGoalId: 1,
    assignedToUserId: 5,
    createdByUserId: 4,
    taskType: "prepare_offer",
    title: "Подготовить коммерческое предложение по витринным образцам",
    description: "Сформировать КП на образцы и условия доставки для точки в Краснодаре.",
    taskStatus: "new",
    priority: "high",
    dueDate: "2026-05-02",
    createdAt: "2026-04-27T10:55:00.000Z",
    completedAt: null,
  },
  {
    id: 3,
    dealerId: 1,
    tradePointId: 1,
    showcaseGoalId: 1,
    assignedToUserId: 6,
    createdByUserId: 5,
    taskType: "follow_up",
    title: "Проверить наличие Urban White на складе",
    description: "Уточнить остатки и подтвердить возможность быстрой отгрузки.",
    taskStatus: "waiting_dealer",
    priority: "medium",
    dueDate: "2026-05-03",
    createdAt: "2026-04-27T11:00:00.000Z",
    completedAt: null,
  },
  {
    id: 4,
    dealerId: 3,
    tradePointId: 5,
    showcaseGoalId: 3,
    assignedToUserId: 6,
    createdByUserId: 2,
    taskType: "update_documents",
    title: "Передать ассистенту задачу подготовить POSM",
    description: "Подготовить документы и макеты POSM для обновления витрины в Сочи.",
    taskStatus: "in_progress",
    priority: "medium",
    dueDate: "2026-05-07",
    createdAt: "2026-04-27T12:25:00.000Z",
    completedAt: null,
  },
  {
    id: 5,
    dealerId: 2,
    tradePointId: 4,
    showcaseGoalId: 2,
    assignedToUserId: 4,
    createdByUserId: 5,
    taskType: "follow_up",
    title: "Запланировать повторную проверку РМ",
    description: "Согласовать дату повторного визита РМ после выставления базовой витрины.",
    taskStatus: "new",
    priority: "high",
    dueDate: "2026-05-10",
    createdAt: "2026-04-27T11:45:00.000Z",
    completedAt: null,
  },
];

function getNextId<T extends { id: number }>(entries: T[]): number {
  return entries.reduce((maxId, entry) => Math.max(maxId, entry.id), 0) + 1;
}

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const maxSequence = ordersSeed.reduce((maxValue, order) => {
    const matched = /^ORD-(\d{4})-(\d+)$/.exec(order.orderNumber);
    if (!matched) {
      return maxValue;
    }

    const matchedYear = Number.parseInt(matched[1], 10);
    const matchedSequence = Number.parseInt(matched[2], 10);
    if (matchedYear !== year || Number.isNaN(matchedSequence)) {
      return maxValue;
    }

    return Math.max(maxValue, matchedSequence);
  }, 0);

  return `ORD-${year}-${String(maxSequence + 1).padStart(4, "0")}`;
}

function getUserById(id: number | null | undefined): User | undefined {
  if (id == null) {
    return undefined;
  }
  return usersSeed.find((user) => user.id === id);
}

function userNameById(id: number | null | undefined): string {
  const user = getUserById(id);
  if (!user) {
    return "Не назначен";
  }
  return `${user.firstName} ${user.lastName}`.trim();
}

function dealerListItemById(id: number): DealerListItem | undefined {
  const dealer = dealersSeed.find((entry) => entry.id === id);
  if (!dealer) return undefined;
  return toDealerListItem(
    dealer,
    usersSeed,
    tradePointsSeed,
    dealerTasksSeed,
    dealerInteractionsSeed,
    organizationsSeed,
  );
}

function routeVisitDetail(visit: RouteVisit): RouteVisitDetail | undefined {
  const dealer = dealerListItemById(visit.dealerId);
  const tradePoint = tradePointsSeed.find((point) => point.id === visit.tradePointId);
  if (!dealer || !tradePoint) {
    return undefined;
  }
  return {
    ...visit,
    dealer,
    tradePoint,
  };
}

function reportResponseForVisit(visitId: number): DistributionReportResponse | undefined {
  const report = distributionReportsSeed.find((entry) => entry.visitId === visitId);
  if (!report) {
    return undefined;
  }
  const items = distributionReportItemsSeed
    .filter((entry) => entry.reportId === report.id)
    .sort((a, b) => a.id - b.id);
  return {
    report,
    items,
    summary: {
      totalModelsChecked: report.totalModelsChecked,
      presentModelsCount: report.presentModelsCount,
      missingModelsCount: report.missingModelsCount,
      showcaseModelsCount: items.filter((item) => item.isOnShowcase === 1).length,
    },
  };
}

function rebuildReportFromPayload(
  existing: DistributionReport,
  payload: DemoDistributionReportPayload,
  status: "draft" | "submitted",
): DistributionReport {
  const totalModelsChecked = payload.items.length;
  const presentModelsCount = payload.items.filter((item) => item.isPresent).length;
  const missingModelsCount = totalModelsChecked - presentModelsCount;
  return {
    ...existing,
    reportStatus: status,
    hasShowcase: payload.hasShowcase ? 1 : 0,
    showcaseDoorsCount: payload.showcaseDoorsCount,
    totalModelsChecked,
    presentModelsCount,
    missingModelsCount,
    displayQuality: payload.displayQuality,
    competitorPresence: payload.competitorPresence,
    recommendation: payload.recommendation,
    nextAction: payload.nextAction,
    submittedAt: status === "submitted" ? new Date().toISOString() : null,
  };
}

function applyReportItems(
  reportId: number,
  payloadItems: DemoDistributionReportPayload["items"],
): void {
  for (let index = distributionReportItemsSeed.length - 1; index >= 0; index -= 1) {
    if (distributionReportItemsSeed[index].reportId === reportId) {
      distributionReportItemsSeed.splice(index, 1);
    }
  }

  const nextIdStart = getNextId(distributionReportItemsSeed);
  const normalizedItems: DistributionReportItem[] = payloadItems.map((item, idx) => {
    const product = productsSeed.find((entry) => entry.id === item.productId);
    return {
      id: nextIdStart + idx,
      reportId,
      productId: item.productId,
      modelName: product?.name ?? `Модель #${item.productId}`,
      sku: product?.sku ?? "N/A",
      category: product?.category ?? "unknown",
      isPresent: item.isPresent ? 1 : 0,
      isOnShowcase: item.isOnShowcase ? 1 : 0,
      stockStatus: item.stockStatus,
      comment: item.comment ?? null,
    };
  });
  distributionReportItemsSeed.push(...normalizedItems);
}

function defaultChecklistItems(): DistributionReportItem[] {
  return productsSeed.slice(0, 5).map((product, index) => ({
    id: 10_000 + index + 1,
    reportId: 0,
    productId: product.id,
    modelName: product.name,
    sku: product.sku,
    category: product.category,
    isPresent: 0,
    isOnShowcase: 0,
    stockStatus: "unknown",
    comment: null,
  }));
}

function goalReportSummaryById(reportId: number | null): ShowcaseGoalReportSummary | null {
  if (reportId == null) {
    return null;
  }
  const report = distributionReportsSeed.find((entry) => entry.id === reportId);
  if (!report) {
    return null;
  }
  return {
    id: report.id,
    visitId: report.visitId,
    reportStatus: report.reportStatus,
    missingModelsCount: report.missingModelsCount,
    presentModelsCount: report.presentModelsCount,
    recommendation: report.recommendation,
    nextAction: report.nextAction,
  };
}

function normalizeGoalStatus(goal: ShowcaseGoal): ShowcaseGoal["goalStatus"] {
  if (goal.goalStatus === "completed" || goal.goalStatus === "rejected") {
    return goal.goalStatus;
  }
  const dueDate = Date.parse(goal.dueDate);
  if (!Number.isNaN(dueDate) && dueDate < Date.now()) {
    return "overdue";
  }
  return goal.goalStatus;
}

function isGoalOverdue(goal: ShowcaseGoal): boolean {
  return normalizeGoalStatus(goal) === "overdue";
}

function toShowcaseGoalListItem(goal: ShowcaseGoal): ShowcaseGoalListItem {
  const dealer = dealerListItemById(goal.dealerId);
  const tradePoint = tradePointsSeed.find((entry) => entry.id === goal.tradePointId);
  if (!dealer || !tradePoint) {
    throw new StorageError(500, `Не удалось собрать контекст цели #${goal.id}`);
  }
  const normalizedStatus = normalizeGoalStatus(goal);
  const effectiveCompletedCount =
    normalizedStatus === "completed"
      ? Math.max(goal.targetModelsCount, goal.completedModelsCount)
      : goal.completedModelsCount;
  const progressPercent =
    goal.targetModelsCount > 0
      ? Math.min(100, Math.round((effectiveCompletedCount / goal.targetModelsCount) * 100))
      : 0;
  return {
    ...goal,
    goalStatus: normalizedStatus,
    completedModelsCount: effectiveCompletedCount,
    dealer,
    tradePoint,
    assignedTo: getUserById(goal.assignedToUserId) ?? null,
    createdBy: getUserById(goal.createdByUserId) ?? null,
    progressPercent,
    isOverdue: isGoalOverdue(goal),
    distributionReportSummary: goalReportSummaryById(goal.distributionReportId),
  };
}

function toSalesTaskListItem(task: SalesTask): SalesTaskListItem {
  const dealer = dealerListItemById(task.dealerId);
  if (!dealer) {
    throw new StorageError(500, `Не удалось собрать контекст задачи #${task.id}`);
  }
  return {
    ...task,
    dealer,
    tradePoint:
      task.tradePointId != null
        ? tradePointsSeed.find((entry) => entry.id === task.tradePointId) ?? null
        : null,
    assignedTo: getUserById(task.assignedToUserId) ?? null,
    createdBy: getUserById(task.createdByUserId) ?? null,
    showcaseGoal:
      task.showcaseGoalId != null
        ? showcaseGoalsSeed.find((entry) => entry.id === task.showcaseGoalId) ?? null
        : null,
  };
}

function recalculateGoalCompletion(goalId: number): void {
  const goal = showcaseGoalsSeed.find((entry) => entry.id === goalId);
  if (!goal) {
    return;
  }
  const items = showcaseGoalItemsSeed.filter((entry) => entry.goalId === goalId);
  goal.targetModelsCount = items.length;
  goal.completedModelsCount = items.filter((entry) => entry.itemStatus === "completed").length;
  if (goal.completedModelsCount >= goal.targetModelsCount && goal.targetModelsCount > 0) {
    goal.goalStatus = "completed";
    goal.completedAt = goal.completedAt ?? new Date().toISOString();
  }
}

export class DatabaseStorage implements IStorage {
  async listOrganizations(): Promise<Organization[]> {
    return organizationsSeed;
  }

  async listUsers(): Promise<User[]> {
    return usersSeed;
  }

  async listRoles(): Promise<Role[]> {
    return rolesSeed;
  }

  async listUserRoles(): Promise<UserRole[]> {
    return userRolesSeed;
  }

  async listDealers(): Promise<DealerListItem[]> {
    return dealersSeed.map((dealer) =>
      toDealerListItem(
        dealer,
        usersSeed,
        tradePointsSeed,
        dealerTasksSeed,
        dealerInteractionsSeed,
        organizationsSeed,
      ),
    );
  }

  async getDealerById(id: number): Promise<DealerDetail | undefined> {
    const dealer = dealersSeed.find((entry) => entry.id === id);
    if (!dealer) {
      return undefined;
    }

    const listItem = toDealerListItem(
      dealer,
      usersSeed,
      tradePointsSeed,
      dealerTasksSeed,
      dealerInteractionsSeed,
      organizationsSeed,
    );
    const tradePoints = await this.getTradePointsByDealerId(id);
    const tasks = await this.getDealerTasksByDealerId(id);
    const interactions = await this.getDealerInteractionsByDealerId(id);
    const recentOrders = ordersSeed
      .filter((order) => order.dealerId === id)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
    const recentClaims = claimsSeed
      .filter((claim) => claim.dealerId === id)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
    const activeShowcaseGoals = dealerTasksSeed.filter(
      (task) =>
        task.dealerId === id &&
        task.type === "showcase_goal" &&
        task.status !== "done" &&
        task.status !== "rejected",
    ).length;
    const activeDistributionTasks = dealerTasksSeed.filter(
      (task) =>
        task.dealerId === id &&
        task.type === "distribution_gap" &&
        task.status !== "done" &&
        task.status !== "rejected",
    ).length;
    return {
      dealer: {
        ...listItem,
        organizationName: organizationsSeed.find((organization) => organization.id === dealer.organizationId)?.name ?? listItem.name,
      },
      salesManager: listItem.salesManager,
      regionalManager: listItem.regionalManager,
      tradePoints,
      tasks,
      interactions,
      recentOrders,
      recentClaims,
      distributionSummary: {
        tradePointsCovered: tradePoints.filter((point) => point.status === "active").length,
        totalTradePoints: tradePoints.length,
        activeShowcaseGoals,
        activeDistributionTasks,
        placeholder:
          "Здесь будет отображаться покрытие моделей Tandoor по торговым точкам дилера после запуска отчетов дистрибуции.",
      },
    };
  }

  async getTradePointsByDealerId(dealerId: number): Promise<TradePoint[]> {
    return tradePointsSeed
      .filter((point) => point.dealerId === dealerId)
      .sort((a, b) => a.id - b.id);
  }

  async getDealerTasksByDealerId(dealerId: number): Promise<DealerTaskWithUsers[]> {
    return dealerTasksSeed
      .filter((task) => task.dealerId === dealerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((task) => ({
        ...task,
        assignedToUserName: userNameById(task.assignedToUserId),
        createdByUserName: userNameById(task.createdByUserId),
      }));
  }

  async getDealerInteractionsByDealerId(dealerId: number): Promise<DealerInteractionWithUser[]> {
    return dealerInteractionsSeed
      .filter((entry) => entry.dealerId === dealerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((interaction) => ({
        ...interaction,
        userName: userNameById(interaction.userId),
      }));
  }

  async listRegionalRoutes(): Promise<RegionalRoute[]> {
    return regionalRoutesSeed
      .slice()
      .sort((a, b) => a.routeDate.localeCompare(b.routeDate));
  }

  async getRegionalRouteById(id: number): Promise<RegionalRouteDetail | undefined> {
    const route = regionalRoutesSeed.find((entry) => entry.id === id);
    if (!route) {
      return undefined;
    }
    const regionalManager = getUserById(route.regionalManagerId);
    if (!regionalManager) {
      return undefined;
    }
    const visits = routeVisitsSeed
      .filter((visit) => visit.routeId === id)
      .map(routeVisitDetail)
      .filter((entry): entry is RouteVisitDetail => Boolean(entry))
      .sort((a, b) => a.plannedTime.localeCompare(b.plannedTime));
    return {
      ...route,
      regionalManager,
      visits,
      summary: {
        planned: visits.filter((visit) => visit.visitStatus === "planned").length,
        completed: visits.filter((visit) => visit.visitStatus === "completed").length,
        inProgress: visits.filter((visit) => visit.visitStatus === "in_progress").length,
        skipped: visits.filter((visit) => visit.visitStatus === "skipped").length,
      },
    };
  }

  async getRegionalManagerVisitById(id: number): Promise<VisitDetail | undefined> {
    const visit = routeVisitsSeed.find((entry) => entry.id === id);
    if (!visit) {
      return undefined;
    }
    const detailedVisit = routeVisitDetail(visit);
    if (!detailedVisit) {
      return undefined;
    }
    const route = regionalRoutesSeed.find((entry) => entry.id === visit.routeId);
    if (!route) {
      return undefined;
    }
    const dealer = detailedVisit.dealer;
    const salesManager = getUserById(dealer.salesManagerId);
    const regionalManager = getUserById(dealer.regionalManagerId);
    const distributionReport = reportResponseForVisit(id) ?? null;
    return {
      visit: detailedVisit,
      route,
      dealer,
      tradePoint: detailedVisit.tradePoint,
      salesManager: salesManager ?? null,
      regionalManager: regionalManager ?? null,
      activeTaskCount: dealer.activeTaskCount,
      distributionReport,
      productChecklist: distributionReport?.items ?? defaultChecklistItems(),
    };
  }

  async getDistributionReportByVisitId(
    visitId: number,
  ): Promise<DistributionReportResponse | undefined> {
    const visit = routeVisitsSeed.find((entry) => entry.id === visitId);
    if (!visit) {
      return undefined;
    }
    const existing = reportResponseForVisit(visitId);
    if (existing) {
      return existing;
    }
    return {
      report: {
        id: 0,
        visitId,
        dealerId: visit.dealerId,
        tradePointId: visit.tradePointId,
        regionalManagerId:
          regionalRoutesSeed.find((entry) => entry.id === visit.routeId)?.regionalManagerId ?? 7,
        reportStatus: "draft",
        hasShowcase: 0,
        showcaseDoorsCount: 0,
        totalModelsChecked: 0,
        presentModelsCount: 0,
        missingModelsCount: 0,
        displayQuality: "average",
        competitorPresence: "none",
        recommendation: "",
        nextAction: "",
        createdAt: new Date().toISOString(),
        submittedAt: null,
      },
      items: defaultChecklistItems(),
      summary: {
        totalModelsChecked: 0,
        presentModelsCount: 0,
        missingModelsCount: 0,
        showcaseModelsCount: 0,
      },
    };
  }

  async saveDistributionReportDraft(
    visitId: number,
    payload: DemoDistributionReportPayload,
  ): Promise<{ success: true; report: DistributionReportResponse }> {
    const visit = routeVisitsSeed.find((entry) => entry.id === visitId);
    if (!visit) {
      throw new StorageError(404, "Визит не найден");
    }
    if (payload.items.length === 0) {
      throw new StorageError(422, "Список моделей для отчета пуст");
    }
    const route = regionalRoutesSeed.find((entry) => entry.id === visit.routeId);
    if (!route) {
      throw new StorageError(404, "Маршрут не найден");
    }
    const existing = distributionReportsSeed.find((entry) => entry.visitId === visitId);
    const now = new Date().toISOString();
    const baseReport: DistributionReport =
      existing ??
      {
        id: getNextId(distributionReportsSeed),
        visitId,
        dealerId: visit.dealerId,
        tradePointId: visit.tradePointId,
        regionalManagerId: route.regionalManagerId,
        reportStatus: "draft",
        hasShowcase: 0,
        showcaseDoorsCount: 0,
        totalModelsChecked: 0,
        presentModelsCount: 0,
        missingModelsCount: 0,
        displayQuality: "average",
        competitorPresence: "none",
        recommendation: "",
        nextAction: "",
        createdAt: now,
        submittedAt: null,
      };
    const rebuilt = rebuildReportFromPayload(baseReport, payload, "draft");
    if (existing) {
      const index = distributionReportsSeed.findIndex((entry) => entry.id === existing.id);
      distributionReportsSeed[index] = rebuilt;
    } else {
      distributionReportsSeed.push(rebuilt);
    }
    applyReportItems(rebuilt.id, payload.items);
    const report = reportResponseForVisit(visitId);
    if (!report) {
      throw new StorageError(500, "Не удалось подготовить ответ по отчету");
    }
    return { success: true, report };
  }

  async submitDistributionReport(
    visitId: number,
    payload: DemoDistributionReportPayload,
  ): Promise<{ success: true; message: string; report: DistributionReportResponse }> {
    const draft = await this.saveDistributionReportDraft(visitId, payload);
    const report = distributionReportsSeed.find((entry) => entry.visitId === visitId);
    if (!report) {
      throw new StorageError(500, "Отчет не найден");
    }
    const submitted = rebuildReportFromPayload(report, payload, "submitted");
    const reportIndex = distributionReportsSeed.findIndex((entry) => entry.id === report.id);
    distributionReportsSeed[reportIndex] = submitted;

    const visit = routeVisitsSeed.find((entry) => entry.id === visitId);
    if (visit) {
      visit.visitStatus = "completed";
      visit.completedAt = new Date().toISOString();
    }
    const route = visit ? regionalRoutesSeed.find((entry) => entry.id === visit.routeId) : undefined;
    if (route) {
      route.completedVisitsCount = routeVisitsSeed.filter(
        (entry) => entry.routeId === route.id && entry.visitStatus === "completed",
      ).length;
      if (route.completedVisitsCount >= route.plannedVisitsCount) {
        route.status = "completed";
      }
    }

    const response = reportResponseForVisit(visitId) ?? draft.report;
    return {
      success: true,
      message:
        "Отчет дистрибуции отправлен. На его основании будут сформированы цели по витрине.",
      report: response,
    };
  }

  async listShowcaseGoals(): Promise<ShowcaseGoalListItem[]> {
    return showcaseGoalsSeed
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((goal) => toShowcaseGoalListItem(goal));
  }

  async getShowcaseGoalById(id: number): Promise<ShowcaseGoalDetail | undefined> {
    const goal = showcaseGoalsSeed.find((entry) => entry.id === id);
    if (!goal) {
      return undefined;
    }
    const goalView = toShowcaseGoalListItem(goal);
    const relatedSalesTasks = salesTasksSeed
      .filter((task) => task.showcaseGoalId === goal.id)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((task) => toSalesTaskListItem(task));
    return {
      goal: goalView,
      dealer: goalView.dealer,
      tradePoint: goalView.tradePoint,
      assignedTo: goalView.assignedTo,
      createdBy: goalView.createdBy,
      sourceDistributionReportSummary: goalView.distributionReportSummary,
      items: showcaseGoalItemsSeed
        .filter((item) => item.goalId === goal.id)
        .sort((a, b) => a.id - b.id),
      relatedSalesTasks,
    };
  }

  async listSalesTasks(): Promise<SalesTaskListItem[]> {
    return salesTasksSeed
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((task) => toSalesTaskListItem(task));
  }

  async getSalesTaskById(id: number): Promise<SalesTaskDetail | undefined> {
    const task = salesTasksSeed.find((entry) => entry.id === id);
    if (!task) {
      return undefined;
    }
    const taskView = toSalesTaskListItem(task);
    return {
      task: taskView,
      dealer: taskView.dealer,
      tradePoint: taskView.tradePoint,
      assignedTo: taskView.assignedTo,
      createdBy: taskView.createdBy,
      showcaseGoal:
        taskView.showcaseGoalId != null
          ? toShowcaseGoalListItem(
              showcaseGoalsSeed.find((entry) => entry.id === taskView.showcaseGoalId)!,
            )
          : null,
    };
  }

  async updateShowcaseGoalStatus(
    id: number,
    status: ShowcaseGoal["goalStatus"],
  ): Promise<{ success: true; goal: ShowcaseGoalListItem }> {
    const goal = showcaseGoalsSeed.find((entry) => entry.id === id);
    if (!goal) {
      throw new StorageError(404, "Цель по витрине не найдена");
    }
    goal.goalStatus = status;
    if (status === "completed") {
      goal.completedAt = goal.completedAt ?? new Date().toISOString();
      goal.completedModelsCount = Math.max(goal.completedModelsCount, goal.targetModelsCount);
      for (const item of showcaseGoalItemsSeed) {
        if (item.goalId === goal.id && item.itemStatus !== "rejected") {
          item.itemStatus = "completed";
          item.currentState = "on_showcase";
        }
      }
      recalculateGoalCompletion(goal.id);
    } else {
      goal.completedAt = null;
    }
    return { success: true, goal: toShowcaseGoalListItem(goal) };
  }

  async updateSalesTaskStatus(
    id: number,
    status: SalesTask["taskStatus"],
  ): Promise<{ success: true; task: SalesTaskListItem }> {
    const task = salesTasksSeed.find((entry) => entry.id === id);
    if (!task) {
      throw new StorageError(404, "Задача продаж не найдена");
    }
    task.taskStatus = status;
    if (status === "done") {
      task.completedAt = task.completedAt ?? new Date().toISOString();
    } else {
      task.completedAt = null;
    }
    return { success: true, task: toSalesTaskListItem(task) };
  }

  async createShowcaseGoalFromDistributionReport(
    visitId: number,
  ): Promise<{ success: true; message: string; goal: ShowcaseGoalListItem }> {
    const visit = routeVisitsSeed.find((entry) => entry.id === visitId);
    if (!visit) {
      throw new StorageError(404, "Визит не найден");
    }
    const report = distributionReportsSeed.find((entry) => entry.visitId === visitId);
    if (!report) {
      throw new StorageError(404, "Отчет дистрибуции по визиту не найден");
    }
    const existing = showcaseGoalsSeed.find((entry) => entry.distributionReportId === report.id);
    if (existing) {
      return {
        success: true,
        message: "Цель по витрине уже сформирована и передана менеджеру продаж.",
        goal: toShowcaseGoalListItem(existing),
      };
    }

    const reportItems = distributionReportItemsSeed
      .filter((item) => item.reportId === report.id)
      .filter((item) => item.isPresent === 0 || item.isOnShowcase === 0)
      .slice(0, 6);
    const targetCount = Math.max(
      reportItems.length,
      Math.max(1, report.missingModelsCount),
    );
    const newGoal: ShowcaseGoal = {
      id: getNextId(showcaseGoalsSeed),
      dealerId: visit.dealerId,
      tradePointId: visit.tradePointId,
      distributionReportId: report.id,
      createdByUserId: report.regionalManagerId,
      assignedToUserId: dealerListItemById(visit.dealerId)?.salesManagerId ?? 5,
      title: "Цель по витрине из отчета дистрибуции",
      description:
        "Сформирована автоматически по результатам визита РМ: отсутствующие или невыставленные модели.",
      goalStatus: "new",
      priority: "high",
      dueDate: "2026-05-12",
      source: "distribution_report",
      targetModelsCount: targetCount,
      completedModelsCount: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    showcaseGoalsSeed.push(newGoal);

    const newItemsStart = getNextId(showcaseGoalItemsSeed);
    const createdItems: ShowcaseGoalItem[] = reportItems.map((item, index) => ({
      id: newItemsStart + index,
      goalId: newGoal.id,
      productId: item.productId,
      modelName: item.modelName,
      sku: item.sku,
      category: item.category,
      currentState:
        item.isPresent === 0
          ? "missing"
          : item.isOnShowcase === 0
            ? "in_stock_not_showcase"
            : "on_showcase",
      targetState: item.isPresent === 0 ? "ordered" : "on_showcase",
      itemStatus: "new",
      comment: item.comment,
    }));
    if (createdItems.length > 0) {
      showcaseGoalItemsSeed.push(...createdItems);
    }

    const followUpTask: SalesTask = {
      id: getNextId(salesTasksSeed),
      dealerId: newGoal.dealerId,
      tradePointId: newGoal.tradePointId,
      showcaseGoalId: newGoal.id,
      assignedToUserId: newGoal.assignedToUserId,
      createdByUserId: newGoal.createdByUserId,
      taskType: "showcase_goal",
      title: "Согласовать цель по витрине с дилером",
      description:
        "Подтвердить план выставления моделей, сроки и ответственных по итогам визита РМ.",
      taskStatus: "new",
      priority: newGoal.priority,
      dueDate: newGoal.dueDate,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    salesTasksSeed.push(followUpTask);

    return {
      success: true,
      message: "Цель по витрине сформирована и передана менеджеру продаж.",
      goal: toShowcaseGoalListItem(newGoal),
    };
  }

  async getSalesLeadershipDashboard(): Promise<SalesLeadershipDashboard> {
    const now = Date.now();
    const goals = showcaseGoalsSeed.map((goal) => toShowcaseGoalListItem(goal));
    const salesTasks = salesTasksSeed.map((task) => toSalesTaskListItem(task));
    const todayIso = new Date().toISOString().slice(0, 10);

    const mapPriorityToSeverity = (priority: string): OverdueLeadershipItem["severity"] => {
      if (priority === "high") {
        return "critical";
      }
      if (priority === "medium") {
        return "high";
      }
      return "medium";
    };

    const isSalesTaskOverdue = (task: SalesTask): boolean => {
      if (task.taskStatus === "done" || task.taskStatus === "cancelled") {
        return false;
      }
      if (task.taskStatus === "overdue") {
        return true;
      }
      const dueDate = Date.parse(task.dueDate);
      return !Number.isNaN(dueDate) && dueDate < now;
    };

    const isDealerTaskOverdue = (task: DealerTask): boolean => {
      if (task.status === "done" || task.status === "rejected") {
        return false;
      }
      if (task.status === "overdue") {
        return true;
      }
      const dueDate = Date.parse(task.dueDate);
      return !Number.isNaN(dueDate) && dueDate < now;
    };

    const todayRoutes = regionalRoutesSeed.filter((route) => route.routeDate === todayIso);
    const todayRouteIds = new Set(todayRoutes.map((route) => route.id));
    const todayVisits = routeVisitsSeed.filter((visit) => todayRouteIds.has(visit.routeId));
    const reportsCreatedToday = distributionReportsSeed.filter((report) => {
      const visit = routeVisitsSeed.find((entry) => entry.id === report.visitId);
      if (!visit) {
        return false;
      }
      return todayRouteIds.has(visit.routeId);
    });

    const nextVisit =
      todayVisits
        .filter((visit) => visit.visitStatus === "planned")
        .sort((a, b) => a.plannedTime.localeCompare(b.plannedTime))[0] ??
      routeVisitsSeed
        .filter((visit) => visit.visitStatus === "planned")
        .sort((a, b) => a.plannedTime.localeCompare(b.plannedTime))[0];
    const nextVisitDealer = nextVisit
      ? dealersSeed.find((dealer) => dealer.id === nextVisit.dealerId)
      : null;
    const nextVisitTradePoint = nextVisit
      ? tradePointsSeed.find((tradePoint) => tradePoint.id === nextVisit.tradePointId)
      : null;

    const teamProfiles: Array<{
      userId: number;
      role: TeamWorkloadItem["role"];
      team: string;
      nextFocus: string;
    }> = [
      {
        userId: 5,
        role: "sales_manager",
        team: "Команда Юг / продажи",
        nextFocus: "Закрыть согласования по целям витрин и снять блокеры дилеров.",
      },
      {
        userId: 7,
        role: "regional_manager",
        team: "Команда Юг / региональные менеджеры",
        nextFocus: "Дозакрыть визиты маршрута и передать отчеты в отдел продаж.",
      },
      {
        userId: 6,
        role: "sales_assistant",
        team: "Команда Юг / поддержка продаж",
        nextFocus: "Подготовить POSM и документы по витринным задачам.",
      },
      {
        userId: 3,
        role: "team_head",
        team: "Команда Юг / управление",
        nextFocus: "Перераспределить просроченные задачи после визитов между менеджерами.",
      },
      {
        userId: 4,
        role: "regional_head",
        team: "Руководство РМ / Юг",
        nextFocus: "Проверить качество отчетов РМ и назначить повторные проверки.",
      },
    ];

    const teamWorkload: TeamWorkloadItem[] = teamProfiles.map((profile) => {
      const user = getUserById(profile.userId);
      const activeGoalsCount = goals.filter(
        (goal) =>
          goal.assignedToUserId === profile.userId &&
          goal.goalStatus !== "completed" &&
          goal.goalStatus !== "rejected",
      ).length;
      const activeSalesTasks = salesTasksSeed.filter(
        (task) =>
          task.assignedToUserId === profile.userId &&
          task.taskStatus !== "done" &&
          task.taskStatus !== "cancelled",
      );
      const activeDealerTasks = dealerTasksSeed.filter(
        (task) =>
          task.assignedToUserId === profile.userId &&
          task.status !== "done" &&
          task.status !== "rejected",
      );
      const overdueTasksCount =
        activeSalesTasks.filter((task) => isSalesTaskOverdue(task)).length +
        activeDealerTasks.filter((task) => isDealerTaskOverdue(task)).length;
      const visitsCount = routeVisitsSeed.filter((visit) => {
        const route = regionalRoutesSeed.find((entry) => entry.id === visit.routeId);
        return route?.regionalManagerId === profile.userId;
      }).length;
      const reportsCount = distributionReportsSeed.filter(
        (report) => report.regionalManagerId === profile.userId,
      ).length;
      const loadScore =
        activeGoalsCount +
        activeSalesTasks.length +
        activeDealerTasks.length +
        overdueTasksCount * 2 +
        (profile.role === "regional_manager" ? visitsCount : 0);
      const workloadStatus: TeamWorkloadItem["workloadStatus"] =
        loadScore >= 10 ? "overloaded" : loadScore >= 6 ? "high" : "normal";
      return {
        userId: profile.userId,
        name: user ? `${user.firstName} ${user.lastName}` : `Сотрудник #${profile.userId}`,
        role: profile.role,
        team: profile.team,
        activeGoalsCount,
        activeTasksCount: activeSalesTasks.length + activeDealerTasks.length,
        overdueTasksCount,
        visitsCount,
        reportsCount,
        workloadStatus,
        nextFocus: profile.nextFocus,
      };
    });

    const atRiskDealers: AtRiskDealer[] = [
      {
        dealerId: 2,
        dealerName: "Салон дверей Северный",
        tradePointId: 4,
        tradePointName: "Салон дверей Северный",
        city: "Краснодар",
        riskReason:
          "Нет базовой витрины Tandoor: цель новая, требуется согласование и фиксация ответственных.",
        riskLevel: "critical",
        responsibleName: "Анна Кравченко",
        lastAction:
          dealerInteractionsSeed
            .filter((interaction) => interaction.dealerId === 2)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.summary ??
          "Последнее действие не зафиксировано.",
        nextAction: "Провести звонок с дилером и зафиксировать сроки по базовой матрице.",
        actionHref: "/dealers/2",
      },
      {
        dealerId: 1,
        dealerName: "Дверной Дом Юг",
        tradePointId: 2,
        tradePointName: "Дверной Дом Юг — Анапа",
        city: "Анапа",
        riskReason:
          "Отчет дистрибуции получен, но POSM-материалы и часть витрины в Анапе не обновлены.",
        riskLevel: "high",
        responsibleName: "Сергей Волков",
        lastAction:
          dealerInteractionsSeed
            .filter((interaction) => interaction.dealerId === 1)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.summary ??
          "Последнее действие не зафиксировано.",
        nextAction: "Подтвердить поставку POSM и назначить повторную проверку РМ.",
        actionHref: "/dealers/1",
      },
      {
        dealerId: 3,
        dealerName: "Дом дверей Сочи",
        tradePointId: 5,
        tradePointName: "Дом дверей Сочи",
        city: "Сочи",
        riskReason: "Сезонные модели выставлены частично, есть риск потери сезонного спроса.",
        riskLevel: "medium",
        responsibleName: "Анна Кравченко",
        lastAction:
          dealerInteractionsSeed
            .filter((interaction) => interaction.dealerId === 3)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.summary ??
          "Последнее действие не зафиксировано.",
        nextAction: "Ускорить согласование поставки сезонных моделей и обновить витрину.",
        actionHref: "/dealers/3",
      },
    ];

    const overdueGoalItems: OverdueLeadershipItem[] = goals
      .filter((goal) => goal.goalStatus === "overdue")
      .map((goal) => ({
        id: `showcase-goal-${goal.id}`,
        type: "showcase_goal" as const,
        title: goal.title,
        ownerName: goal.assignedTo
          ? `${goal.assignedTo.firstName} ${goal.assignedTo.lastName}`
          : "Не назначен",
        dueDate: goal.dueDate,
        severity: mapPriorityToSeverity(goal.priority),
        href: `/sales/showcase-goals/${goal.id}`,
      }));

    const overdueSalesTaskItems: OverdueLeadershipItem[] = salesTasks
      .filter((task) => isSalesTaskOverdue(task))
      .map((task) => ({
        id: `sales-task-${task.id}`,
        type: "sales_task" as const,
        title: task.title,
        ownerName: task.assignedTo
          ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
          : "Не назначен",
        dueDate: task.dueDate,
        severity: mapPriorityToSeverity(task.priority),
        href: "/sales/tasks",
      }));

    const overdueFollowUps: OverdueLeadershipItem[] = dealerTasksSeed
      .filter((task) => isDealerTaskOverdue(task))
      .map((task) => ({
        id: `dealer-task-${task.id}`,
        type: task.type === "showcase_goal" ? "showcase_goal" : ("visit_follow_up" as const),
        title: task.title,
        ownerName: userNameById(task.assignedToUserId),
        dueDate: task.dueDate,
        severity: mapPriorityToSeverity(task.priority),
        href: task.type === "showcase_goal" ? "/sales/showcase-goals" : `/dealers/${task.dealerId}`,
      }));

    const overdueItems = [...overdueGoalItems, ...overdueSalesTaskItems, ...overdueFollowUps].sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate),
    );

    const showcaseGoalPipelineTemplate: Array<
      Pick<ShowcaseGoalPipelineItem, "status" | "label" | "colorTone">
    > = [
      { status: "new", label: "Новые", colorTone: "lime" },
      { status: "in_progress", label: "В работе", colorTone: "amber" },
      { status: "agreed", label: "Согласованы", colorTone: "sky" },
      { status: "completed", label: "Выполнены", colorTone: "emerald" },
      { status: "overdue", label: "Просрочены", colorTone: "rose" },
    ];
    const showcaseGoalPipeline: ShowcaseGoalPipelineItem[] = showcaseGoalPipelineTemplate.map((item) => ({
      ...item,
      count: goals.filter((goal) => goal.goalStatus === item.status).length,
    }));

    const regionalActivity: RegionalActivitySummary = {
      routesToday: todayRoutes.length,
      visitsToday: todayVisits.length,
      completedVisits: todayVisits.filter((visit) => visit.visitStatus === "completed").length,
      inProgressVisits: todayVisits.filter((visit) => visit.visitStatus === "in_progress").length,
      reportsCreated: reportsCreatedToday.length,
      reportsSubmitted: reportsCreatedToday.filter(
        (report) => report.reportStatus === "submitted" || report.reportStatus === "reviewed",
      ).length,
      nextVisitTitle: nextVisit
        ? `${nextVisitDealer?.name ?? "Дилер"} — ${nextVisitTradePoint?.name ?? "Торговая точка"}`
        : "Нет запланированных визитов",
      nextVisitTime: nextVisit?.plannedTime ?? "—",
      linkToRoute: "/regional-manager/route",
    };

    const activeGoalsCount = goals.filter(
      (goal) =>
        goal.goalStatus === "new" ||
        goal.goalStatus === "in_progress" ||
        goal.goalStatus === "agreed" ||
        goal.goalStatus === "overdue",
    ).length;
    const salesTasksOverdue = salesTasks.filter((task) => isSalesTaskOverdue(task)).length;

    return {
      kpis: {
        dealersTotal: dealersSeed.length,
        tradePointsTotal: tradePointsSeed.length,
        visitsPlanned: routeVisitsSeed.length,
        visitsCompleted: routeVisitsSeed.filter((visit) => visit.visitStatus === "completed").length,
        distributionReportsSubmitted: distributionReportsSeed.filter(
          (report) => report.reportStatus === "submitted" || report.reportStatus === "reviewed",
        ).length,
        showcaseGoalsTotal: goals.length,
        showcaseGoalsCompleted: goals.filter((goal) => goal.goalStatus === "completed").length,
        salesTasksTotal: salesTasks.length,
        salesTasksOverdue,
        atRiskDealersCount: atRiskDealers.length,
      },
      roleSummaries: [
        {
          role: "sales_head",
          title: "Руководитель отдела продаж",
          ownerName: "Ольга Соколова",
          focus: "Выполнение целей по витринам, просрочки, дилеры в зоне риска.",
          mainMetrics: [
            `Цели в работе: ${activeGoalsCount}`,
            `Просроченные задачи продаж: ${salesTasksOverdue}`,
            `Дилеры с высоким потенциалом: ${dealersSeed.filter((dealer) => dealer.potentialLevel === "high").length}`,
          ],
          actionLabel: "Открыть контроль просрочек",
          actionHref: "/sales/tasks",
        },
        {
          role: "team_head",
          title: "Руководитель команды",
          ownerName: "Дмитрий Романов",
          focus: "Баланс нагрузки сотрудников, снятие блокеров и контроль задач после визитов.",
          mainMetrics: [
            `Сотрудников в фокусе: ${teamWorkload.length}`,
            `Задач в работе: ${salesTasks.filter((task) => task.taskStatus !== "done" && task.taskStatus !== "cancelled").length}`,
            `Просрочки после визитов: ${overdueItems.filter((item) => item.type === "visit_follow_up").length}`,
          ],
          actionLabel: "Перейти к задачам команды",
          actionHref: "/sales/tasks",
        },
        {
          role: "regional_head",
          title: "Руководитель региональных менеджеров",
          ownerName: "Мария Лебедева",
          focus: "Маршруты РМ, закрытие визитов и своевременная отправка отчетов дистрибуции.",
          mainMetrics: [
            `Маршрутов сегодня: ${regionalActivity.routesToday}`,
            `Визитов закрыто: ${regionalActivity.completedVisits}/${regionalActivity.visitsToday}`,
            `Отчеты отправлены: ${regionalActivity.reportsSubmitted}`,
          ],
          actionLabel: "Открыть маршрут РМ",
          actionHref: "/regional-manager/route",
        },
      ],
      teamWorkload,
      showcaseGoalPipeline,
      regionalActivity,
      atRiskDealers,
      overdueItems,
      nextActions: [
        {
          title: "Проверить просроченные задачи продаж",
          description: `В контроле ${salesTasksOverdue} просроченных задач продаж, требуется перераспределение.`,
          href: "/sales/tasks",
          priority: "high",
        },
        {
          title: "Открыть цели по витринам",
          description: `Активных целей по витринам: ${activeGoalsCount}.`,
          href: "/sales/showcase-goals",
          priority: "high",
        },
        {
          title: "Посмотреть маршрут регионального менеджера",
          description: `Сегодня ${regionalActivity.visitsToday} визитов, следующий в ${regionalActivity.nextVisitTime}.`,
          href: "/regional-manager/route",
          priority: "medium",
        },
        {
          title: "Связаться с ответственным менеджером по рисковым дилерам",
          description: `Дилеров в зоне внимания: ${atRiskDealers.length}.`,
          href: "/sales/leadership",
          priority: "medium",
        },
      ],
    };
  }

  async getRegionalManagerWorkspace(): Promise<RegionalManagerWorkspace> {
    const managerId = 7;
    const manager = getUserById(managerId);
    if (!manager) {
      throw new StorageError(404, "Региональный менеджер не найден");
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const managerRoutes = regionalRoutesSeed
      .filter((route) => route.regionalManagerId === managerId)
      .slice()
      .sort((a, b) => b.routeDate.localeCompare(a.routeDate));
    const currentRoute = managerRoutes[0];
    if (!currentRoute) {
      throw new StorageError(404, "Маршруты регионального менеджера не найдены");
    }

    const routeVisits = routeVisitsSeed
      .filter((visit) => visit.routeId === currentRoute.id)
      .slice()
      .sort((a, b) => a.plannedTime.localeCompare(b.plannedTime));
    const routeVisitIds = new Set(routeVisits.map((visit) => visit.id));
    const routeDealerIds = new Set(routeVisits.map((visit) => visit.dealerId));

    const allOpenTasks = salesTasksSeed.filter(
      (task) => task.taskStatus !== "done" && task.taskStatus !== "cancelled",
    );
    const allOverdueTasks = allOpenTasks.filter(
      (task) =>
        task.taskStatus === "overdue" || Date.parse(task.dueDate) < Date.parse(`${todayIso}T00:00:00.000Z`),
    );

    const reportForVisit = (visitId: number) =>
      distributionReportsSeed.find((report) => report.visitId === visitId);

    const openGoalForVisit = (visitId: number) =>
      showcaseGoalsSeed.find(
        (goal) =>
          goal.distributionReportId != null &&
          distributionReportsSeed.some(
            (report) => report.id === goal.distributionReportId && report.visitId === visitId,
          ) &&
          goal.goalStatus !== "completed" &&
          goal.goalStatus !== "rejected",
      );

    const upcomingVisits: RegionalUpcomingVisit[] = routeVisits.map((visit) => {
      const dealer = dealerListItemById(visit.dealerId);
      const tradePoint = tradePointsSeed.find((entry) => entry.id === visit.tradePointId);
      const report = reportForVisit(visit.id);
      const hasOpenShowcaseGoal = Boolean(openGoalForVisit(visit.id));
      return {
        id: visit.id,
        dealerId: visit.dealerId,
        dealerName: dealer?.name ?? `Дилер #${visit.dealerId}`,
        tradePointId: visit.tradePointId,
        tradePointName: tradePoint?.name ?? "Торговая точка",
        address: tradePoint?.address ?? "Адрес не указан",
        city: tradePoint?.city ?? dealer?.city ?? "Не указан",
        plannedTime: visit.plannedTime,
        status: visit.visitStatus,
        priority: visit.priority,
        hasDistributionReport: Boolean(report),
        hasOpenShowcaseGoal,
      };
    });

    const nextVisit = routeVisits.find((visit) => visit.visitStatus === "planned") ?? null;
    const nextVisitDealer = nextVisit ? dealerListItemById(nextVisit.dealerId) : null;
    const nextVisitTradePoint = nextVisit
      ? tradePointsSeed.find((entry) => entry.id === nextVisit.tradePointId)
      : null;

    const visitsCompleted = routeVisits.filter((visit) => visit.visitStatus === "completed").length;
    const progressPercent =
      routeVisits.length > 0 ? Math.round((visitsCompleted / routeVisits.length) * 100) : 0;

    const managerShowcaseGoals = showcaseGoalsSeed
      .filter((goal) => goal.createdByUserId === managerId || routeDealerIds.has(goal.dealerId))
      .map((goal) => toShowcaseGoalListItem(goal))
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const managerTasks: RegionalWorkspaceTask[] = [
      ...routeVisits.map((visit): RegionalWorkspaceTask => {
        const dealer = dealerListItemById(visit.dealerId);
        const tradePoint = tradePointsSeed.find((entry) => entry.id === visit.tradePointId);
        return {
          id: `visit-${visit.id}`,
          title: `Визит: ${dealer?.name ?? `Дилер #${visit.dealerId}`}`,
          dealerName: dealer?.name ?? `Дилер #${visit.dealerId}`,
          tradePointName: tradePoint?.name ?? "Торговая точка",
          dueDate: currentRoute.routeDate,
          status:
            visit.visitStatus === "completed"
              ? ("done" as const)
              : visit.visitStatus === "in_progress"
                ? ("in_progress" as const)
                : ("new" as const),
          priority: visit.priority as RegionalWorkspaceTask["priority"],
          type: "visit" as const,
        };
      }),
      ...distributionReportsSeed
        .filter((report) => routeVisitIds.has(report.visitId))
        .map((report): RegionalWorkspaceTask => {
          const dealer = dealerListItemById(report.dealerId);
          const tradePoint = tradePointsSeed.find((entry) => entry.id === report.tradePointId);
          return {
            id: `distribution-report-${report.id}`,
            title: `Отчет дистрибуции: ${dealer?.name ?? `Дилер #${report.dealerId}`}`,
            dealerName: dealer?.name ?? `Дилер #${report.dealerId}`,
            tradePointName: tradePoint?.name ?? "Торговая точка",
            dueDate: currentRoute.routeDate,
            status:
              report.reportStatus === "submitted" || report.reportStatus === "reviewed"
                ? ("done" as const)
                : ("in_progress" as const),
            priority: (report.missingModelsCount > 0 ? "high" : "medium") as RegionalWorkspaceTask["priority"],
            type: "distribution_report" as const,
          };
        }),
      ...allOpenTasks
        .filter((task) => routeDealerIds.has(task.dealerId))
        .slice(0, 8)
        .map((task): RegionalWorkspaceTask => {
          const tradePoint = task.tradePointId
            ? tradePointsSeed.find((entry) => entry.id === task.tradePointId)
            : null;
          const titleByType: Record<RegionalWorkspaceTask["type"], string> = {
            visit: task.title,
            distribution_report: task.title,
            showcase_check: task.title,
            photo_report: task.title,
            dealer_feedback: task.title,
            pos_materials: task.title,
            competitor_check: task.title,
            contact_update: task.title,
          };
          const typeByTaskType: Record<SalesTask["taskType"], RegionalWorkspaceTask["type"]> = {
            showcase_goal: "showcase_check",
            call_dealer: "dealer_feedback",
            prepare_offer: "contact_update",
            coordinate_delivery: "pos_materials",
            update_documents: "photo_report",
            follow_up: "competitor_check",
            other: "contact_update",
          };
          const mappedType = typeByTaskType[task.taskType];
          const isOverdue =
            task.taskStatus === "overdue" ||
            Date.parse(task.dueDate) < Date.parse(`${todayIso}T00:00:00.000Z`);
          const normalizedPriority: RegionalWorkspaceTask["priority"] =
            task.priority === "high" || task.priority === "medium" || task.priority === "low"
              ? task.priority
              : "medium";

          return {
            id: `sales-task-${task.id}`,
            title: titleByType[mappedType],
            dealerName: dealerListItemById(task.dealerId)?.name ?? `Дилер #${task.dealerId}`,
            tradePointName: tradePoint?.name ?? "Торговая точка",
            dueDate: task.dueDate,
            status: isOverdue
              ? ("overdue" as const)
              : task.taskStatus === "in_progress"
                ? ("in_progress" as const)
                : ("new" as const),
            priority: normalizedPriority,
            type: mappedType,
          };
        }),
    ]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 12);

    const atRiskDealers: RegionalAtRiskDealer[] = Array.from(routeDealerIds)
      .map((dealerId) => {
        const dealer = dealerListItemById(dealerId);
        const dealerVisits = routeVisits
          .filter((visit) => visit.dealerId === dealerId)
          .slice()
          .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
        const dealerReports = distributionReportsSeed.filter((report) => report.dealerId === dealerId);
        const missingModels = dealerReports.reduce((sum, report) => sum + report.missingModelsCount, 0);
        const openGoals = managerShowcaseGoals.filter(
          (goal) =>
            goal.dealerId === dealerId &&
            goal.goalStatus !== "completed" &&
            goal.goalStatus !== "rejected",
        ).length;
        const riskLevel: RegionalAtRiskDealer["riskLevel"] =
          missingModels >= 3 || openGoals >= 2 ? "critical" : missingModels >= 1 ? "high" : "medium";
        const reason =
          riskLevel === "critical"
            ? "Высокий риск: отсутствуют ключевые модели и несколько незакрытых целей."
            : riskLevel === "high"
              ? "Есть пробелы дистрибуции, нужна приоритизация действий."
              : "Нужен регулярный контроль после визитов.";
        return {
          dealerId,
          dealerName: dealer?.name ?? `Дилер #${dealerId}`,
          city: dealer?.city ?? "Не указан",
          reason,
          riskLevel,
          lastVisitDate: dealerVisits[0]?.completedAt ?? dealerVisits[0]?.startedAt ?? null,
          nextAction:
            riskLevel === "critical"
              ? "Назначить follow-up с менеджером продаж и зафиксировать план закрытия пробелов."
              : riskLevel === "high"
                ? "Проверить статус целей по витрине и подтвердить следующую поставку."
                : "Продолжить плановый контроль по маршруту.",
        };
      })
      .sort((a, b) => {
        const score = (value: RegionalAtRiskDealer["riskLevel"]) =>
          value === "critical" ? 3 : value === "high" ? 2 : 1;
        return score(b.riskLevel) - score(a.riskLevel);
      })
      .slice(0, 6);

    const showcaseGoals: RegionalShowcaseGoalSummary[] = managerShowcaseGoals.map((goal) => {
      const sourceReport = goal.distributionReportId
        ? distributionReportsSeed.find((report) => report.id === goal.distributionReportId)
        : null;
      return {
        id: goal.id,
        title: goal.title,
        dealerName: goal.dealer.name,
        tradePointName: goal.tradePoint.name,
        status: goal.goalStatus,
        dueDate: goal.dueDate,
        progressPercent: goal.progressPercent,
        sourceVisitId: sourceReport?.visitId ?? null,
      };
    });

    const distributionFocus: RegionalDistributionFocusItem[] = (() => {
      const grouped = new Map<
        string,
        { missingModels: number; tradePoints: Set<number>; priority: "low" | "medium" | "high" }
      >();
      for (const item of distributionReportItemsSeed) {
        if (item.isPresent === 1 && item.isOnShowcase === 1) {
          continue;
        }
        const report = distributionReportsSeed.find((entry) => entry.id === item.reportId);
        if (!report || !routeVisitIds.has(report.visitId)) {
          continue;
        }
        const current = grouped.get(item.category) ?? {
          missingModels: 0,
          tradePoints: new Set<number>(),
          priority: "low" as const,
        };
        current.missingModels += 1;
        current.tradePoints.add(report.tradePointId);
        current.priority =
          current.missingModels >= 3 ? "high" : current.missingModels >= 2 ? "medium" : "low";
        grouped.set(item.category, current);
      }
      const categoryLabel: Record<string, string> = {
        entry_door: "Входные двери",
        interior_door: "Межкомнатные двери",
        fire_door: "Противопожарные двери",
      };
      return Array.from(grouped.entries())
        .map(([category, value]) => ({
          category: categoryLabel[category] ?? category,
          missingModels: value.missingModels,
          affectedTradePoints: value.tradePoints.size,
          priority: value.priority,
          recommendation:
            value.priority === "high"
              ? "Сформировать цели на расширение витрины и ускорить поставку."
              : value.priority === "medium"
                ? "Провести проверку выкладки и синхронизировать план с продажами."
                : "Поддерживать регулярный контроль в рамках маршрута.",
        }))
        .sort((a, b) => b.missingModels - a.missingModels)
        .slice(0, 6);
    })();

    const recentActivity: RegionalRecentActivityItem[] = [
      ...routeVisits
        .filter((visit) => visit.visitStatus === "completed")
        .map((visit) => {
          const dealer = dealerListItemById(visit.dealerId);
          const tradePoint = tradePointsSeed.find((entry) => entry.id === visit.tradePointId);
          return {
            id: `visit-completed-${visit.id}`,
            type: "visit_completed" as const,
            title: "Визит завершен",
            description: `${dealer?.name ?? "Дилер"} · ${tradePoint?.name ?? "ТТ"} (${visit.plannedTime})`,
            createdAt: visit.completedAt ?? `${currentRoute.routeDate}T${visit.plannedTime}:00.000Z`,
          };
        }),
      ...distributionReportsSeed
        .filter((report) => routeVisitIds.has(report.visitId))
        .map((report) => ({
          id: `distribution-report-${report.id}`,
          type: "distribution_report_filled" as const,
          title: "Отчет дистрибуции заполнен",
          description: report.recommendation,
          createdAt: report.submittedAt ?? report.createdAt,
        })),
      ...showcaseGoals
        .filter((goal) => goal.sourceVisitId != null)
        .map((goal) => ({
          id: `showcase-goal-${goal.id}`,
          type: "showcase_goal_created" as const,
          title: "Создана цель по витрине",
          description: `${goal.title} · ${goal.dealerName}`,
          createdAt:
            showcaseGoalsSeed.find((entry) => entry.id === goal.id)?.createdAt ?? `${todayIso}T00:00:00.000Z`,
        })),
      ...allOverdueTasks
        .filter((task) => routeDealerIds.has(task.dealerId))
        .map((task) => ({
          id: `task-overdue-${task.id}`,
          type: "task_overdue" as const,
          title: "Задача просрочена",
          description: task.title,
          createdAt: `${task.dueDate}T00:00:00.000Z`,
        })),
      ...atRiskDealers.map((dealer) => ({
        id: `dealer-risk-${dealer.dealerId}`,
        type: "dealer_at_risk" as const,
        title: "Дилер отмечен в зоне риска",
        description: `${dealer.dealerName}: ${dealer.reason}`,
        createdAt: todayIso + "T12:00:00.000Z",
      })),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12);

    const distributionReports = distributionReportsSeed.filter((report) =>
      routeVisitIds.has(report.visitId),
    );
    const missingModels = distributionReports.reduce((sum, report) => sum + report.missingModelsCount, 0);
    const showcaseGoalsCreated = showcaseGoals.filter((goal) => goal.sourceVisitId != null).length;

    return {
      manager: {
        id: manager.id,
        name: `${manager.firstName} ${manager.lastName}`,
        role: "Региональный менеджер",
        region: currentRoute.region,
        teamName: "Команда Юг",
      },
      period: {
        label: "Текущая неделя",
        dateFrom: currentRoute.routeDate,
        dateTo: currentRoute.routeDate,
      },
      kpis: {
        plannedVisits: routeVisits.length,
        completedVisits: routeVisits.filter((visit) => visit.visitStatus === "completed").length,
        inProgressVisits: routeVisits.filter((visit) => visit.visitStatus === "in_progress").length,
        overdueVisits: routeVisits.filter((visit) => visit.visitStatus === "skipped").length,
        distributionReports: distributionReports.length,
        missingModels,
        showcaseGoalsCreated,
        openTasks: allOpenTasks.filter((task) => routeDealerIds.has(task.dealerId)).length,
        overdueTasks: allOverdueTasks.filter((task) => routeDealerIds.has(task.dealerId)).length,
        atRiskDealers: atRiskDealers.length,
      },
      todayRoute: {
        id: currentRoute.id,
        title: currentRoute.title,
        city: upcomingVisits[0]?.city ?? "Не указан",
        date: currentRoute.routeDate,
        status: currentRoute.status,
        progressPercent,
        visitsTotal: routeVisits.length,
        visitsCompleted,
        nextVisitId: nextVisit?.id ?? null,
        nextDealerName: nextVisitDealer?.name ?? null,
        nextTradePointAddress: nextVisitTradePoint?.address ?? null,
      },
      upcomingVisits,
      tasks: managerTasks,
      atRiskDealers,
      showcaseGoals,
      distributionFocus,
      recentActivity,
    };
  }

  async getSalesManagerWorkspace(): Promise<SalesManagerWorkspace> {
    const managerId = 5;
    const manager = getUserById(managerId);
    if (!manager) {
      throw new StorageError(404, "Менеджер продаж не найден");
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const todayIso = new Date().toISOString().slice(0, 10);

    const isSalesTaskOpen = (task: SalesTask): boolean =>
      task.taskStatus !== "done" && task.taskStatus !== "cancelled";

    const isSalesTaskOverdue = (task: SalesTask): boolean => {
      if (!isSalesTaskOpen(task)) {
        return false;
      }
      if (task.taskStatus === "overdue") {
        return true;
      }
      const dueDate = Date.parse(task.dueDate);
      return !Number.isNaN(dueDate) && dueDate < now;
    };

    const isDealerTaskOpen = (task: DealerTask): boolean =>
      task.status !== "done" && task.status !== "rejected";

    const isDealerTaskOverdue = (task: DealerTask): boolean => {
      if (!isDealerTaskOpen(task)) {
        return false;
      }
      if (task.status === "overdue") {
        return true;
      }
      const dueDate = Date.parse(task.dueDate);
      return !Number.isNaN(dueDate) && dueDate < now;
    };

    const normalizePriority = (priority: string): "low" | "medium" | "high" => {
      if (priority === "low" || priority === "medium" || priority === "high") {
        return priority;
      }
      return "medium";
    };

    const severityByPriority = (priority: string): ManagerOverdueItem["severity"] => {
      const normalized = normalizePriority(priority);
      if (normalized === "high") {
        return "critical";
      }
      if (normalized === "medium") {
        return "high";
      }
      return "medium";
    };

    const todayFocusStatusFromTask = (
      status: string,
      isOverdue: boolean,
    ): TodayFocusItem["status"] => {
      if (isOverdue) {
        return "overdue";
      }
      if (status === "done" || status === "cancelled") {
        return "done";
      }
      if (status === "waiting_dealer") {
        return "waiting_dealer";
      }
      if (status === "in_progress") {
        return "in_progress";
      }
      return "new";
    };

    const managerDealers = dealersSeed.filter(
      (dealer) => (dealer.salesManagerId ?? dealer.managerUserId) === managerId,
    );
    const managerDealerIds = new Set(managerDealers.map((dealer) => dealer.id));

    const managerGoals = showcaseGoalsSeed
      .filter((goal) => goal.assignedToUserId === managerId)
      .map((goal) => toShowcaseGoalListItem(goal));
    const activeGoals = managerGoals.filter(
      (goal) => goal.goalStatus !== "completed" && goal.goalStatus !== "rejected",
    );

    const managerSalesTasks = salesTasksSeed
      .filter((task) => task.assignedToUserId === managerId)
      .map((task) => toSalesTaskListItem(task));
    const delegatedTasks = salesTasksSeed
      .filter((task) => task.createdByUserId === managerId && task.assignedToUserId !== managerId)
      .map((task) => toSalesTaskListItem(task));
    const managerDealerTasks = dealerTasksSeed.filter((task) => task.assignedToUserId === managerId);

    const todayFocus: TodayFocusItem[] = [
      ...managerSalesTasks.filter((task) => isSalesTaskOpen(task)).map((task) => {
        let type: TodayFocusItem["type"] = "follow_up";
        if (task.taskType === "call_dealer") {
          type = "call_dealer";
        } else if (task.taskType === "prepare_offer") {
          type = "prepare_offer";
        } else if (task.taskType === "showcase_goal") {
          type = "showcase_goal";
        } else if (task.taskType === "coordinate_delivery") {
          type = "check_order";
        }
        return {
          id: `task-${task.id}`,
          type,
          title: task.title,
          dealerId: task.dealerId,
          dealerName: task.dealer.name,
          tradePointName: task.tradePoint?.name ?? undefined,
          priority: normalizePriority(task.priority),
          dueDate: task.dueDate,
          source: (task.showcaseGoalId != null ? "showcase_goal" : "manual") as TodayFocusItem["source"],
          href: task.showcaseGoalId != null ? `/sales/showcase-goals/${task.showcaseGoalId}` : "/sales/tasks",
          status: todayFocusStatusFromTask(task.taskStatus, isSalesTaskOverdue(task)),
        };
      }),
      ...delegatedTasks.filter((task) => isSalesTaskOpen(task)).map((task) => ({
        id: `delegated-${task.id}`,
        type: "assistant_task" as const,
        title: `Контроль делегирования: ${task.title}`,
        dealerId: task.dealerId,
        dealerName: task.dealer.name,
        tradePointName: task.tradePoint?.name ?? undefined,
        priority: normalizePriority(task.priority),
        dueDate: task.dueDate,
        source: "manual" as const,
        href: "/sales/tasks",
        status: todayFocusStatusFromTask(task.taskStatus, isSalesTaskOverdue(task)),
      })),
      ...activeGoals.map((goal) => ({
        id: `goal-${goal.id}`,
        type: "showcase_goal" as const,
        title: goal.title,
        dealerId: goal.dealerId,
        dealerName: goal.dealer.name,
        tradePointName: goal.tradePoint.name,
        priority: normalizePriority(goal.priority),
        dueDate: goal.dueDate,
        source:
          goal.source === "distribution_report" || goal.source === "regional_manager"
            ? ("regional_report" as const)
            : ("showcase_goal" as const),
        href: `/sales/showcase-goals/${goal.id}`,
        status:
          goal.goalStatus === "new"
            ? ("new" as const)
            : goal.goalStatus === "overdue"
              ? ("overdue" as const)
              : ("in_progress" as const),
      })),
    ]
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 10);

    const openOrdersCount = ordersSeed.filter(
      (order) =>
        managerDealerIds.has(order.dealerId) &&
        order.status !== "delivered" &&
        order.status !== "cancelled",
    ).length;

    const assignedDealers: AssignedDealerWorkspaceItem[] = managerDealers.map((dealer) => {
      const dealerList = toDealerListItem(
        dealer,
        usersSeed,
        tradePointsSeed,
        dealerTasksSeed,
        dealerInteractionsSeed,
        organizationsSeed,
      );
      const activeGoalsCount = activeGoals.filter((goal) => goal.dealerId === dealer.id).length;
      const activeTasksCount =
        managerSalesTasks.filter((task) => task.dealerId === dealer.id && isSalesTaskOpen(task)).length +
        managerDealerTasks.filter((task) => task.dealerId === dealer.id && isDealerTaskOpen(task)).length;
      const overdueTasksCount =
        managerSalesTasks.filter((task) => task.dealerId === dealer.id && isSalesTaskOverdue(task)).length +
        managerDealerTasks.filter((task) => task.dealerId === dealer.id && isDealerTaskOverdue(task)).length;
      return {
        dealerId: dealer.id,
        dealerName: dealer.name,
        dealerType: dealer.dealerType,
        city: dealer.city ?? "Не указан",
        region: dealer.region ?? "Не указан",
        segment: dealer.segment ?? "Без сегмента",
        potentialLevel: dealer.potentialLevel ?? "medium",
        status: dealer.status,
        tradePointCount: dealerList.tradePointCount,
        activeGoalsCount,
        activeTasksCount,
        overdueTasksCount,
        lastInteractionDate: dealerList.lastInteractionDate,
        nextAction:
          overdueTasksCount > 0
            ? "Закрыть просроченные задачи и обновить статус дилера."
            : activeGoalsCount > 0
              ? "Согласовать сроки выполнения цели по витрине."
              : "Связаться с дилером и уточнить текущие потребности.",
        href: `/dealers/${dealer.id}`,
      };
    });

    const activeShowcaseGoals: ActiveShowcaseGoalWorkspaceItem[] = activeGoals
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((goal) => ({
        id: goal.id,
        title: goal.title,
        dealerId: goal.dealerId,
        dealerName: goal.dealer.name,
        tradePointName: goal.tradePoint.name,
        status: goal.goalStatus,
        priority: normalizePriority(goal.priority),
        dueDate: goal.dueDate,
        progressText: `${goal.completedModelsCount}/${goal.targetModelsCount}`,
        completedModelsCount: goal.completedModelsCount,
        targetModelsCount: goal.targetModelsCount,
        href: `/sales/showcase-goals/${goal.id}`,
      }));

    const salesTasks: SalesTaskWorkspaceItem[] = managerSalesTasks
      .slice()
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((task) => ({
        id: task.id,
        title: task.title,
        dealerId: task.dealerId,
        dealerName: task.dealer.name,
        tradePointName: task.tradePoint?.name ?? undefined,
        taskType: task.taskType,
        status: isSalesTaskOverdue(task) ? "overdue" : task.taskStatus,
        priority: normalizePriority(task.priority),
        dueDate: task.dueDate,
        showcaseGoalId: task.showcaseGoalId ?? undefined,
        href: task.showcaseGoalId ? `/sales/showcase-goals/${task.showcaseGoalId}` : "/sales/tasks",
      }));

    const overdueItems: ManagerOverdueItem[] = [
      ...managerSalesTasks.filter((task) => isSalesTaskOverdue(task)).map((task) => ({
        id: `sales-task-${task.id}`,
        type: "sales_task" as const,
        title: task.title,
        dealerName: task.dealer.name,
        dueDate: task.dueDate,
        severity: severityByPriority(task.priority),
        href: task.showcaseGoalId ? `/sales/showcase-goals/${task.showcaseGoalId}` : "/sales/tasks",
      })),
      ...activeGoals
        .filter((goal) => goal.goalStatus === "overdue")
        .map((goal) => ({
          id: `showcase-goal-${goal.id}`,
          type: "showcase_goal" as const,
          title: goal.title,
          dealerName: goal.dealer.name,
          dueDate: goal.dueDate,
          severity: severityByPriority(goal.priority),
          href: `/sales/showcase-goals/${goal.id}`,
        })),
      ...managerDealerTasks.filter((task) => isDealerTaskOverdue(task)).map((task) => ({
        id: `dealer-follow-up-${task.id}`,
        type: "dealer_follow_up" as const,
        title: task.title,
        dealerName: dealerListItemById(task.dealerId)?.name ?? `Дилер #${task.dealerId}`,
        dueDate: task.dueDate,
        severity: severityByPriority(task.priority),
        href: `/dealers/${task.dealerId}`,
      })),
    ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const staleDealers: StaleDealerItem[] = assignedDealers
      .map((dealer) => {
        const interactionDate = dealer.lastInteractionDate ? Date.parse(dealer.lastInteractionDate) : NaN;
        const daysWithoutActivity = Number.isNaN(interactionDate)
          ? 999
          : Math.max(0, Math.floor((now - interactionDate) / dayMs));
        return {
          dealerId: dealer.dealerId,
          dealerName: dealer.dealerName,
          city: dealer.city,
          lastInteractionDate: dealer.lastInteractionDate,
          daysWithoutActivity,
          riskReason:
            daysWithoutActivity >= 14
              ? "Длительное отсутствие контакта с дилером."
              : "Нужна регулярная фиксация активности по дилеру.",
          nextAction:
            daysWithoutActivity >= 14
              ? "Назначить звонок и обновить план действий по дилеру."
              : "Провести короткий follow-up и зафиксировать результат.",
          href: dealer.href,
        };
      })
      .filter((dealer) => dealer.daysWithoutActivity >= 7)
      .sort((a, b) => b.daysWithoutActivity - a.daysWithoutActivity);

    const regionalSignals: RegionalSignalItem[] = [
      ...routeVisitsSeed
        .filter((visit) => managerDealerIds.has(visit.dealerId))
        .map((visit) => {
          const dealer = dealersSeed.find((entry) => entry.id === visit.dealerId);
          const tradePoint = tradePointsSeed.find((entry) => entry.id === visit.tradePointId);
          const route = regionalRoutesSeed.find((entry) => entry.id === visit.routeId);
          return {
            id: `visit-${visit.id}`,
            sourceType: "visit" as const,
            dealerId: visit.dealerId,
            dealerName: dealer?.name ?? `Дилер #${visit.dealerId}`,
            tradePointName: tradePoint?.name ?? "Торговая точка",
            title: `Визит РМ: ${visit.plannedTime}`,
            summary: visit.comment ?? "РМ оставил сигнал после визита.",
            createdAt:
              visit.completedAt ??
              visit.startedAt ??
              `${route?.routeDate ?? todayIso}T${visit.plannedTime}:00.000Z`,
            priority: normalizePriority(visit.priority),
            href: `/regional-manager/visits/${visit.id}`,
          };
        }),
      ...distributionReportsSeed
        .filter((report) => managerDealerIds.has(report.dealerId))
        .map((report) => {
          const dealer = dealersSeed.find((entry) => entry.id === report.dealerId);
          const tradePoint = tradePointsSeed.find((entry) => entry.id === report.tradePointId);
          return {
            id: `distribution-report-${report.id}`,
            sourceType: "distribution_report" as const,
            dealerId: report.dealerId,
            dealerName: dealer?.name ?? `Дилер #${report.dealerId}`,
            tradePointName: tradePoint?.name ?? "Торговая точка",
            title: "Отчет дистрибуции требует действий",
            summary: report.recommendation,
            createdAt: report.submittedAt ?? report.createdAt,
            priority: (report.missingModelsCount > 0 ? "high" : "medium") as RegionalSignalItem["priority"],
            href: `/regional-manager/visits/${report.visitId}`,
          };
        }),
      ...distributionReportItemsSeed
        .filter((item) => item.isOnShowcase === 0)
        .slice(0, 4)
        .map((item) => {
          const report = distributionReportsSeed.find((entry) => entry.id === item.reportId);
          const dealer = report ? dealersSeed.find((entry) => entry.id === report.dealerId) : undefined;
          const tradePoint = report
            ? tradePointsSeed.find((entry) => entry.id === report.tradePointId)
            : undefined;
          return {
            id: `showcase-gap-${item.id}`,
            sourceType: "showcase_gap" as const,
            dealerId: report?.dealerId ?? 0,
            dealerName: dealer?.name ?? "Дилер",
            tradePointName: tradePoint?.name ?? "Торговая точка",
            title: "Пробел в витрине по модели",
            summary: `${item.modelName} не выставлена на витрине (${item.sku}).`,
            createdAt: report?.createdAt ?? todayIso,
            priority: "high" as const,
            href: report ? `/regional-manager/visits/${report.visitId}` : "/sales/showcase-goals",
          };
        })
        .filter((signal) => signal.dealerId !== 0 && managerDealerIds.has(signal.dealerId)),
      ...dealerInteractionsSeed
        .filter(
          (interaction) =>
            managerDealerIds.has(interaction.dealerId) && interaction.roleContext === "regional_manager",
        )
        .map((interaction) => {
          const dealer = dealersSeed.find((entry) => entry.id === interaction.dealerId);
          const tradePoint = interaction.tradePointId
            ? tradePointsSeed.find((entry) => entry.id === interaction.tradePointId)
            : undefined;
          return {
            id: `interaction-${interaction.id}`,
            sourceType: "comment" as const,
            dealerId: interaction.dealerId,
            dealerName: dealer?.name ?? `Дилер #${interaction.dealerId}`,
            tradePointName: tradePoint?.name ?? "Торговая точка",
            title: "Комментарий регионального менеджера",
            summary: interaction.summary,
            createdAt: interaction.createdAt,
            priority: "medium" as const,
            href: `/dealers/${interaction.dealerId}`,
          };
        }),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);

    const highPriorityItemsCount =
      activeGoals.filter((goal) => goal.priority === "high").length +
      managerSalesTasks.filter((task) => isSalesTaskOpen(task) && task.priority === "high").length +
      managerDealerTasks.filter((task) => isDealerTaskOpen(task) && task.priority === "high").length;

    return {
      manager: {
        id: manager.id,
        name: `${manager.firstName} ${manager.lastName}`,
        role: "Менеджер продаж",
        team: "Команда Юг",
        region: managerDealers[0]?.region ?? "Краснодарский край",
        email: manager.email,
        phone: manager.phone ?? "Не указан",
      },
      kpis: {
        assignedDealersCount: managerDealers.length,
        activeGoalsCount: activeGoals.length,
        activeTasksCount:
          managerSalesTasks.filter((task) => isSalesTaskOpen(task)).length +
          managerDealerTasks.filter((task) => isDealerTaskOpen(task)).length,
        overdueTasksCount: overdueItems.length,
        todayTasksCount: todayFocus.length,
        highPriorityItemsCount,
        dealersWithoutRecentActivityCount: staleDealers.length,
        openOrdersCount,
      },
      todayFocus,
      assignedDealers,
      activeShowcaseGoals,
      salesTasks,
      overdueItems,
      staleDealers,
      regionalSignals,
      quickActions: [
        {
          title: "Открыть цели по витринам",
          description: "Перейти к активным целям по дилерам и торговым точкам.",
          href: "/sales/showcase-goals",
          actionType: "open_showcase_goals",
        },
        {
          title: "Открыть задачи продаж",
          description: "Контроль статусов задач и быстрый переход к просрочкам.",
          href: "/sales/tasks",
          actionType: "open_sales_tasks",
        },
        {
          title: "Открыть клиентскую базу",
          description: "Проверить карточки закрепленных дилеров и их активность.",
          href: "/dealers",
          actionType: "open_dealers",
        },
        {
          title: "Открыть панель руководителя",
          description: "Сверить фокус менеджера с управленческим контуром.",
          href: "/sales/leadership",
          actionType: "open_leadership",
        },
        {
          title: "Открыть маршрут РМ",
          description: "Посмотреть сигналы от регионального менеджера по визитам.",
          href: "/regional-manager/route",
          actionType: "open_regional_route",
        },
      ],
    };
  }

  async getClientImportTemplateFields(): Promise<ClientImportTemplateField[]> {
    return clientImportTemplateFieldsSeed;
  }

  async getClientImportPreview(): Promise<ClientImportPreview> {
    return clientImportPreviewSeed;
  }

  async validateClientImport(): Promise<ClientImportPreview & { status: "validated" }> {
    return {
      ...clientImportPreviewSeed,
      status: "validated",
    };
  }

  async commitClientImport(): Promise<ClientImportCommitResult> {
    return {
      ...clientImportCommitResultSeed,
      createdAt: new Date().toISOString(),
    };
  }

  async listProducts(): Promise<Product[]> {
    return productsSeed;
  }

  async listOrders(): Promise<Order[]> {
    return [...ordersSeed].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getOrderById(id: number): Promise<OrderDetails | undefined> {
    const order = ordersSeed.find((entry) => entry.id === id);
    if (!order) {
      return undefined;
    }

    return {
      ...order,
      items: orderItemsSeed.filter((item) => item.orderId === order.id),
      documents: documentsSeed.filter((document) => document.orderId === order.id),
    };
  }

  async createOrder(input: CreateOrderInput): Promise<OrderDetails> {
    const dealer = dealersSeed.find((entry) => entry.id === input.dealerId);
    if (!dealer) {
      throw new StorageError(404, "Dealer not found");
    }

    const createdByUser = usersSeed.find((entry) => entry.id === input.createdByUserId);
    if (!createdByUser) {
      throw new StorageError(404, "User not found");
    }

    const mergedItems = new Map<number, number>();
    for (const item of input.items) {
      const quantity = mergedItems.get(item.productId) ?? 0;
      mergedItems.set(item.productId, quantity + item.quantity);
    }

    let totalCents = 0;
    let nextOrderItemId = getNextId(orderItemsSeed);
    const newOrderId = getNextId(ordersSeed);
    const newOrderItems: OrderItem[] = [];

    for (const [productId, quantity] of Array.from(mergedItems.entries())) {
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new StorageError(422, "Each order item quantity must be at least 1");
      }

      const product = productsSeed.find((entry) => entry.id === productId);
      if (!product) {
        throw new StorageError(404, `Product ${productId} not found`);
      }

      const totalPriceCents = product.priceCents * quantity;
      totalCents += totalPriceCents;

      newOrderItems.push({
        id: nextOrderItemId,
        orderId: newOrderId,
        productId,
        quantity,
        unitPriceCents: product.priceCents,
        totalPriceCents,
      });
      nextOrderItemId += 1;
    }

    const nowIso = new Date().toISOString();
    const order: Order = {
      id: newOrderId,
      orderNumber: generateOrderNumber(),
      organizationId: createdByUser.organizationId,
      dealerId: dealer.id,
      createdByUserId: createdByUser.id,
      status: "submitted",
      totalCents,
      currency: "RUB",
      requestedDeliveryDate: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    ordersSeed.push(order);
    orderItemsSeed.push(...newOrderItems);

    const dealerOrganization = organizationsSeed.find((entry) => entry.id === dealer.organizationId);
    const commentSuffix = input.comment?.trim() ? ` Комментарий: ${input.comment.trim()}` : "";
    activityEventsSeed.push({
      id: getNextId(activityEventsSeed),
      eventType: "order_created",
      entityType: "order",
      entityId: order.id,
      organizationId: order.organizationId,
      userId: order.createdByUserId,
      orderId: order.id,
      claimId: null,
      message: `Создан заказ ${order.orderNumber} для дилера ${dealerOrganization?.name ?? `№${dealer.id}`}.${commentSuffix}`,
      createdAt: nowIso,
    });
    dealerInteractionsSeed.push({
      id: getNextId(dealerInteractionsSeed),
      dealerId: dealer.id,
      tradePointId: null,
      userId: createdByUser.id,
      roleContext: "sales_manager",
      type: "order",
      summary: `Оформлен заказ ${order.orderNumber}.`,
      createdAt: nowIso,
    });

    const createdOrder = await this.getOrderById(order.id);
    if (!createdOrder) {
      throw new StorageError(500, "Failed to build created order response");
    }

    return createdOrder;
  }

  async listClaims(): Promise<Claim[]> {
    return claimsSeed;
  }

  async listActivityEvents(): Promise<ActivityEvent[]> {
    return [...activityEventsSeed].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export const storage = new DatabaseStorage();

export {
  organizationsSeed,
  rolesSeed,
  usersSeed,
  userRolesSeed,
  dealersSeed,
  tradePointsSeed,
  dealerTasksSeed,
  dealerInteractionsSeed,
  regionalRoutesSeed,
  routeVisitsSeed,
  distributionReportsSeed,
  distributionReportItemsSeed,
  showcaseGoalsSeed,
  showcaseGoalItemsSeed,
  salesTasksSeed,
  productsSeed,
  ordersSeed,
  orderItemsSeed,
  documentsSeed,
  claimsSeed,
  activityEventsSeed,
};
