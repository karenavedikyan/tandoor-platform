import type { Dealer, DealerInteraction, DealerTask, TradePoint, User } from "@shared/schema";

export type UserPublic = Pick<User, "id" | "firstName" | "lastName" | "email" | "phone">;

export type DealerListItem = {
  id: number;
  organizationId: number;
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
  comment: string | null;
  createdAt: string;
  salesManager: UserPublic | null;
  regionalManager: UserPublic | null;
};

export type DealerDetail = {
  dealer: Dealer;
  salesManager: UserPublic | null;
  regionalManager: UserPublic | null;
  tradePointCount: number;
  activeTaskCount: number;
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
  return tasks.filter((t) => t.status === "new" || t.status === "in_progress" || t.status === "overdue").length;
}
