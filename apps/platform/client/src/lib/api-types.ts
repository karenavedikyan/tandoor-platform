export interface Organization {
  id: number;
  name: string;
  orgType: string;
  taxId: string | null;
  city: string | null;
  status: string;
  createdAt: string;
}

export interface User {
  id: number;
  organizationId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

export interface UserPublic {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

export interface Dealer {
  id: number;
  organizationId: number;
  name: string;
  dealerType: string;
  segment: string | null;
  region: string | null;
  city: string | null;
  salesManagerId: number | null;
  regionalManagerId: number | null;
  potentialLevel: string | null;
  status: string;
  /** @deprecated use salesManagerId */
  managerUserId: number | null;
  tier: string | null;
  comment: string | null;
  createdAt: string;
}

export interface DealerListItem {
  id: number;
  organizationId: number;
  organizationName: string;
  name: string;
  dealerType: string;
  segment: string | null;
  status: string;
  salesManagerId: number | null;
  regionalManagerId: number | null;
  region: string | null;
  city: string | null;
  potentialLevel: string | null;
  tradePointCount: number;
  activeTaskCount: number;
  lastInteractionDate: string | null;
  comment: string | null;
  createdAt: string;
  salesManager: UserPublic | null;
  regionalManager: UserPublic | null;
  salesManagerName: string;
  regionalManagerName: string;
}

export interface DealerDetail {
  dealer: DealerListItem;
  tradePoints: TradePoint[];
  tasks: DealerTaskWithUsers[];
  interactions: DealerInteractionWithUser[];
  recentOrders: Order[];
  recentClaims: Claim[];
  distributionSummary: {
    tradePointsCovered: number;
    totalTradePoints: number;
    activeShowcaseGoals: number;
    activeDistributionTasks: number;
    placeholder: string;
  };
}

export interface TradePoint {
  id: number;
  dealerId: number;
  name: string;
  city: string;
  address: string;
  storeFormat: string;
  areaSqm: number | null;
  assortmentProfile: string;
  status: string;
  comment: string | null;
  createdAt: string;
}

export interface DealerTask {
  id: number;
  dealerId: number;
  tradePointId: number | null;
  assignedToUserId: number;
  createdByUserId: number;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  source: string;
  createdAt: string;
  completedAt: string | null;
}

export interface DealerTaskWithUsers extends DealerTask {
  assignedToUserName: string;
  createdByUserName: string;
}

export interface DealerInteraction {
  id: number;
  dealerId: number;
  tradePointId: number | null;
  userId: number;
  roleContext: string;
  type: string;
  summary: string;
  createdAt: string;
}

export interface DealerInteractionWithUser extends DealerInteraction {
  userName: string;
}

export interface RegionalRoute {
  id: number;
  regionalManagerId: number;
  routeDate: string;
  title: string;
  region: string;
  status: "planned" | "in_progress" | "completed";
  plannedVisitsCount: number;
  completedVisitsCount: number;
  createdAt: string;
}

export interface RouteVisit {
  id: number;
  routeId: number;
  dealerId: number;
  tradePointId: number;
  plannedTime: string;
  visitStatus: "planned" | "in_progress" | "completed" | "skipped";
  visitPurpose: "distribution_check" | "showcase_check" | "training" | "order_follow_up" | "claim_follow_up";
  priority: "low" | "medium" | "high";
  comment: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface RouteVisitDetail extends RouteVisit {
  dealer: DealerListItem;
  tradePoint: TradePoint;
}

export interface RegionalRouteDetail extends RegionalRoute {
  regionalManager: User;
  visits: RouteVisitDetail[];
  summary: {
    planned: number;
    completed: number;
    inProgress: number;
    skipped: number;
  };
}

export interface DistributionReport {
  id: number;
  visitId: number;
  dealerId: number;
  tradePointId: number;
  regionalManagerId: number;
  reportStatus: "draft" | "submitted" | "reviewed";
  hasShowcase: 0 | 1;
  showcaseDoorsCount: number;
  totalModelsChecked: number;
  presentModelsCount: number;
  missingModelsCount: number;
  displayQuality: "excellent" | "good" | "average" | "poor";
  competitorPresence: "none" | "low" | "medium" | "high";
  recommendation: string;
  nextAction: string;
  createdAt: string;
  submittedAt: string | null;
}

export interface DistributionReportItem {
  id: number;
  reportId: number;
  productId: number;
  modelName: string;
  sku: string;
  category: string;
  isPresent: 0 | 1;
  isOnShowcase: 0 | 1;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  comment: string | null;
}

export interface ShowcaseGoal {
  id: number;
  dealerId: number;
  tradePointId: number;
  distributionReportId: number | null;
  createdByUserId: number;
  assignedToUserId: number;
  title: string;
  description: string;
  goalStatus: "new" | "in_progress" | "agreed" | "completed" | "rejected" | "overdue";
  priority: "low" | "medium" | "high";
  dueDate: string;
  source: "distribution_report" | "sales_head" | "regional_manager" | "manual";
  targetModelsCount: number;
  completedModelsCount: number;
  createdAt: string;
  completedAt: string | null;
}

export interface ShowcaseGoalReportSummary {
  id: number;
  visitId: number;
  reportStatus: string;
  missingModelsCount: number;
  presentModelsCount: number;
  recommendation: string;
  nextAction: string;
}

export interface ShowcaseGoalListItem extends ShowcaseGoal {
  dealer: DealerListItem;
  tradePoint: TradePoint;
  assignedTo: User | null;
  createdBy: User | null;
  progressPercent: number;
  isOverdue: boolean;
  distributionReportSummary: ShowcaseGoalReportSummary | null;
}

export interface ShowcaseGoalItem {
  id: number;
  goalId: number;
  productId: number | null;
  modelName: string;
  sku: string;
  category: string;
  currentState: "missing" | "in_stock_not_showcase" | "on_showcase" | "unknown";
  targetState: "on_showcase" | "in_stock" | "ordered";
  itemStatus: "new" | "agreed" | "ordered" | "completed" | "rejected";
  comment: string | null;
}

export interface SalesTask {
  id: number;
  dealerId: number;
  tradePointId: number | null;
  showcaseGoalId: number | null;
  assignedToUserId: number;
  createdByUserId: number;
  taskType:
    | "showcase_goal"
    | "call_dealer"
    | "prepare_offer"
    | "coordinate_delivery"
    | "update_documents"
    | "follow_up"
    | "other";
  title: string;
  description: string;
  taskStatus: "new" | "in_progress" | "waiting_dealer" | "done" | "overdue" | "cancelled";
  priority: "low" | "medium" | "high";
  dueDate: string;
  createdAt: string;
  completedAt: string | null;
}

export interface SalesTaskListItem extends SalesTask {
  dealer: DealerListItem;
  tradePoint: TradePoint | null;
  assignedTo: User | null;
  createdBy: User | null;
  showcaseGoal: ShowcaseGoal | null;
}

export interface ShowcaseGoalDetail {
  goal: ShowcaseGoalListItem;
  dealer: DealerListItem;
  tradePoint: TradePoint;
  assignedTo: User | null;
  createdBy: User | null;
  sourceDistributionReportSummary: ShowcaseGoalReportSummary | null;
  items: ShowcaseGoalItem[];
  relatedSalesTasks: SalesTaskListItem[];
}

export interface SalesTaskDetail {
  task: SalesTaskListItem;
  dealer: DealerListItem;
  tradePoint: TradePoint | null;
  assignedTo: User | null;
  createdBy: User | null;
  showcaseGoal: ShowcaseGoalListItem | null;
}

export interface SalesLeadershipKpis {
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
}

export interface SalesLeadershipRoleSummary {
  role: "sales_head" | "team_head" | "regional_head";
  title: string;
  ownerName: string;
  focus: string;
  mainMetrics: string[];
  actionLabel: string;
  actionHref: string;
}

export interface TeamWorkloadItem {
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
}

export interface ShowcaseGoalPipelineItem {
  status: "new" | "in_progress" | "agreed" | "completed" | "overdue";
  label: string;
  count: number;
  colorTone: string;
}

export interface RegionalActivitySummary {
  routesToday: number;
  visitsToday: number;
  completedVisits: number;
  inProgressVisits: number;
  reportsCreated: number;
  reportsSubmitted: number;
  nextVisitTitle: string;
  nextVisitTime: string;
  linkToRoute: string;
}

export interface AtRiskDealer {
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
}

export interface OverdueLeadershipItem {
  id: string;
  type: "showcase_goal" | "sales_task" | "visit_follow_up";
  title: string;
  ownerName: string;
  dueDate: string;
  severity: "medium" | "high" | "critical";
  href: string;
}

export interface LeadershipNextAction {
  title: string;
  description: string;
  href: string;
  priority: "low" | "medium" | "high";
}

export interface SalesLeadershipDashboard {
  kpis: SalesLeadershipKpis;
  roleSummaries: SalesLeadershipRoleSummary[];
  teamWorkload: TeamWorkloadItem[];
  showcaseGoalPipeline: ShowcaseGoalPipelineItem[];
  regionalActivity: RegionalActivitySummary;
  atRiskDealers: AtRiskDealer[];
  overdueItems: OverdueLeadershipItem[];
  nextActions: LeadershipNextAction[];
}

export interface ShowcaseGoalStatusUpdateResponse {
  success: true;
  goal: ShowcaseGoalListItem;
}

export interface SalesTaskStatusUpdateResponse {
  success: true;
  task: SalesTaskListItem;
}

export interface CreateShowcaseGoalFromVisitResponse {
  success: true;
  message: string;
  goal: ShowcaseGoalListItem;
}

export interface DistributionReportResponse {
  report: DistributionReport;
  items: DistributionReportItem[];
  summary: {
    totalModelsChecked: number;
    presentModelsCount: number;
    missingModelsCount: number;
    showcaseModelsCount: number;
  };
}

export interface DistributionReportPayload {
  hasShowcase: boolean;
  showcaseDoorsCount: number;
  displayQuality: "excellent" | "good" | "average" | "poor";
  competitorPresence: "none" | "low" | "medium" | "high";
  recommendation: string;
  nextAction: string;
  items: Array<{
    productId: number;
    isPresent: boolean;
    isOnShowcase: boolean;
    stockStatus: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
    comment?: string | null;
  }>;
}

export interface VisitDetail {
  visit: RouteVisitDetail;
  route: RegionalRoute;
  dealer: DealerListItem;
  tradePoint: TradePoint;
  salesManager: User | null;
  regionalManager: User | null;
  activeTaskCount: number;
  distributionReport: DistributionReportResponse | null;
  productChecklist: DistributionReportItem[];
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  finishColor: string;
  priceCents: number;
  currency: string;
  availabilityStatus: string;
  stockQty: number;
  createdAt: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  organizationId: number;
  dealerId: number;
  createdByUserId: number;
  status: string;
  totalCents: number;
  currency: string;
  requestedDeliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface CreateOrderItemPayload {
  productId: number;
  quantity: number;
}

export interface CreateOrderPayload {
  dealerId: number;
  createdByUserId: number;
  items: CreateOrderItemPayload[];
  comment?: string;
}

export interface Document {
  id: number;
  organizationId: number;
  orderId: number | null;
  type: string;
  title: string;
  fileUrl: string | null;
  status: string;
  createdAt: string;
}

export interface Claim {
  id: number;
  claimNumber: string;
  organizationId: number;
  dealerId: number;
  orderId: number | null;
  status: string;
  reason: string;
  description: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: number;
  eventType: string;
  entityType: string;
  entityId: number;
  organizationId: number;
  userId: number;
  orderId: number | null;
  claimId: number | null;
  message: string;
  createdAt: string;
}

export interface OrderDetail extends Order {
  items: OrderItem[];
  documents: Document[];
}

export type OrderDetails = OrderDetail;
