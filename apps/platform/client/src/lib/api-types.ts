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

export interface Dealer {
  id: number;
  organizationId: number;
  managerUserId: number | null;
  region: string | null;
  tier: string | null;
  status: string;
  createdAt: string;
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
