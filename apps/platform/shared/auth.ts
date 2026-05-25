/**
 * Целевая модель пользователя и ролей платформы (Postgres / серверная auth).
 * Пилотные `SalesRole` в клиенте остаются отдельно до PR `auth-client-switch-cd7c`.
 */

export type UserRole =
  | "director"
  | "rop"
  | "regional_manager"
  | "manager"
  | "marketer"
  | "analyst"
  | "admin";

export type UserStatus = "invited" | "active" | "disabled";

export type UserScope = {
  teamIds: string[];
  regionIds: string[];
  cityIds?: string[];
};

export type AuthUser = {
  id: string;
  email: string;
  phone?: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  scope: UserScope;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt?: string;
};

/** Карта обязательных полей профиля по роли (ключи полей, не подписи UI). */
export type ProfileRequirement = Record<UserRole, readonly string[]>;

/** Роли бизнес-пользователей (без `admin`) — UI приглашений, смена роли, фильтры `/users`. */
export const BUSINESS_ROLES: UserRole[] = [
  "director",
  "rop",
  "regional_manager",
  "manager",
  "marketer",
  "analyst",
];

/**
 * Какие роли может пригласить данный пользователь.
 * `admin` в системе только через seed; приглашать некого.
 */
export const INVITABLE_BY: Record<UserRole, UserRole[]> = {
  director: ["admin"],
  rop: ["director"],
  regional_manager: ["director", "rop"],
  manager: ["director", "rop"],
  marketer: ["director"],
  analyst: ["director"],
  admin: [],
};

/**
 * Обязательные поля профиля по роли (ключи полей, а не подписи UI).
 * Для marketer / analyst на текущем handoff — минимум: ФИО, email, телефон, роль, статус.
 */
export const PROFILE_REQUIREMENTS: ProfileRequirement = {
  director: [
    "fullName",
    "email",
    "phone",
    "role",
    "status",
    "teamIds",
    "regionIds",
    "territoryAssignment",
    "workPhone",
  ],
  rop: [
    "fullName",
    "email",
    "phone",
    "role",
    "status",
    "teamIds",
    "regionIds",
    "managedTeamName",
  ],
  regional_manager: [
    "fullName",
    "email",
    "phone",
    "role",
    "status",
    "teamIds",
    "regionIds",
    "assignedRegions",
  ],
  manager: [
    "fullName",
    "email",
    "phone",
    "role",
    "status",
    "teamIds",
    "regionIds",
    "primaryRegion",
  ],
  marketer: ["fullName", "email", "phone", "role", "status"],
  analyst: ["fullName", "email", "phone", "role", "status"],
  admin: ["fullName", "email", "phone", "role", "status"],
};
