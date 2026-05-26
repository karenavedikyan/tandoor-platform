import type {
  ActualizationState,
  DealerActualizationContact,
} from "../../client/src/lib/client-base-actualization-state.js";

export type ContactMigrationPlan = {
  rows: Array<{
    managerScopeUserId: string;
    dealerId: string;
    contactId: string;
    fullName: string;
    phone: string;
    email: string;
    source: "from_override" | "from_manual_dealer";
  }>;
  skipped: Array<{ managerScopeUserId: string; dealerId: string; reason: string }>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function strField(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === "string" ? v.trim() : "";
}

function hasPrimaryContact(state: ActualizationState, dealerId: string): boolean {
  return Object.values(state.dealerActualizationContactsById ?? {}).some(
    (c) => c.dealerId === dealerId && c.isPrimary === true,
  );
}

function migratedContactId(dealerId: string): string {
  const safeDealerId = dealerId.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `migrated-contact-${safeDealerId}-${Math.random().toString(36).slice(2, 8)}`;
}

function contactFieldsFrom(fields: Record<string, unknown>): { fullName: string; phone: string; email: string } | null {
  const phone = strField(fields, "phone");
  const email = strField(fields, "email");
  const contactPerson = strField(fields, "contactPerson");
  if (!phone && !email && !contactPerson) return null;
  return {
    fullName: contactPerson || strField(fields, "dealerName") || strField(fields, "name") || "Контакт",
    phone,
    email,
  };
}

/** Строит план миграции контактов для одного state. */
export function buildContactMigrationPlanForState(args: {
  managerScopeUserId: string;
  state: ActualizationState;
  actorUserId: string;
}): ContactMigrationPlan {
  void args.actorUserId;
  const rows: ContactMigrationPlan["rows"] = [];
  const skipped: ContactMigrationPlan["skipped"] = [];
  const plannedDealerIds = new Set<string>();

  for (const [dealerId, override] of Object.entries(args.state.dealerOverridesById ?? {})) {
    if (override.source !== "manual_actualization") continue;
    if (hasPrimaryContact(args.state, dealerId)) {
      skipped.push({ managerScopeUserId: args.managerScopeUserId, dealerId, reason: "already_has_primary_contact" });
      continue;
    }
    const fields = isRecord(override.fields) ? override.fields : {};
    const contact = contactFieldsFrom(fields);
    if (!contact) {
      skipped.push({ managerScopeUserId: args.managerScopeUserId, dealerId, reason: "no_contact_fields" });
      continue;
    }
    rows.push({
      managerScopeUserId: args.managerScopeUserId,
      dealerId,
      contactId: migratedContactId(dealerId),
      ...contact,
      source: "from_override",
    });
    plannedDealerIds.add(dealerId);
  }

  for (const [dealerId, manual] of Object.entries(args.state.manuallyCreatedDealersById ?? {})) {
    if (plannedDealerIds.has(dealerId)) continue;
    if (hasPrimaryContact(args.state, dealerId)) {
      skipped.push({ managerScopeUserId: args.managerScopeUserId, dealerId, reason: "already_has_primary_contact" });
      continue;
    }
    const fields = isRecord(manual.fields) ? manual.fields : {};
    const contact = contactFieldsFrom(fields);
    if (!contact) {
      skipped.push({ managerScopeUserId: args.managerScopeUserId, dealerId, reason: "no_contact_fields" });
      continue;
    }
    rows.push({
      managerScopeUserId: args.managerScopeUserId,
      dealerId,
      contactId: migratedContactId(dealerId),
      ...contact,
      source: "from_manual_dealer",
    });
    plannedDealerIds.add(dealerId);
  }

  return { rows, skipped };
}

/** Применяет план к state. Возвращает новый state. */
export function applyContactMigrationPlan(
  state: ActualizationState,
  plan: ContactMigrationPlan,
  actorUserId: string,
  actorName: string,
): ActualizationState {
  const now = new Date().toISOString();
  const contactsById: Record<string, DealerActualizationContact> = { ...(state.dealerActualizationContactsById ?? {}) };
  const auditByDealerId = { ...(state.dealerActualizationAuditByDealerId ?? {}) };

  for (const row of plan.rows) {
    if (hasPrimaryContact({ ...state, dealerActualizationContactsById: contactsById }, row.dealerId)) continue;
    contactsById[row.contactId] = {
      id: row.contactId,
      dealerId: row.dealerId,
      fullName: row.fullName,
      role: "lpr",
      phone: row.phone,
      email: row.email,
      messenger: "",
      comment: "",
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
      updatedBy: actorUserId,
      updatedByName: actorName,
    };
    auditByDealerId[row.dealerId] = {
      lastUpdatedAt: now,
      lastUpdatedBy: actorUserId,
      lastUpdatedByName: actorName,
    };
  }

  return {
    ...state,
    dealerActualizationContactsById: contactsById,
    dealerActualizationAuditByDealerId: auditByDealerId,
    updatedAt: now,
    updatedBy: actorUserId,
  };
}
