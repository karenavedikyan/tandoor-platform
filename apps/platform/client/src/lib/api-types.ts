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
