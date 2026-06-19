/**
 * URL-state для /admin/audit (Промт 430).
 */

import { useCallback, useEffect, useState } from "react";
import type { AuditSource } from "@/lib/admin-audit-api";

const SOURCES = new Set<AuditSource>([
  "general",
  "client_assignments",
  "dealer_responsibility",
  "scope_diagnostics",
  "overrides_api",
]);

export type AdminAuditUrlState = {
  source: AuditSource;
  actorUserId: string;
  from: string;
  to: string;
  offset: number;
  action: string;
  entityType: string;
  entityId: string;
  clientCode: string;
  dealerId: string;
  responsibleRole: string;
  route: string;
  responseStatus: string;
};

function defaultFromIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
}

function defaultToIso(): string {
  return new Date().toISOString();
}

export function defaultAdminAuditUrlState(): AdminAuditUrlState {
  return {
    source: "general",
    actorUserId: "",
    from: defaultFromIso(),
    to: defaultToIso(),
    offset: 0,
    action: "",
    entityType: "",
    entityId: "",
    clientCode: "",
    dealerId: "",
    responsibleRole: "",
    route: "",
    responseStatus: "",
  };
}

function readSearch(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const hash = window.location.hash ?? "";
  const q = hash.indexOf("?");
  if (q >= 0) return new URLSearchParams(hash.slice(q + 1));
  return new URLSearchParams(window.location.search);
}

function writeSearch(next: URLSearchParams): void {
  const base = window.location.pathname || "/";
  const hashPath = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const pathOnly = hashPath.split("?")[0] || "/admin/audit";
  const qs = next.toString();
  const nextHash = qs ? `${pathOnly}?${qs}` : pathOnly;
  window.history.replaceState(null, "", `${base}#${nextHash}`);
}

export function parseAdminAuditUrlState(): AdminAuditUrlState {
  const sp = readSearch();
  const defaults = defaultAdminAuditUrlState();
  const sourceRaw = sp.get("source");
  const source = sourceRaw && SOURCES.has(sourceRaw as AuditSource) ? (sourceRaw as AuditSource) : defaults.source;
  const offsetRaw = sp.get("offset");
  const offset = offsetRaw != null && offsetRaw !== "" ? Math.max(0, Number.parseInt(offsetRaw, 10) || 0) : 0;
  return {
    source,
    actorUserId: sp.get("actor") ?? sp.get("actorUserId") ?? "",
    from: sp.get("from") ?? defaults.from,
    to: sp.get("to") ?? defaults.to,
    offset,
    action: sp.get("action") ?? "",
    entityType: sp.get("entityType") ?? "",
    entityId: sp.get("entityId") ?? "",
    clientCode: sp.get("clientCode") ?? "",
    dealerId: sp.get("dealerId") ?? "",
    responsibleRole: sp.get("responsibleRole") ?? "",
    route: sp.get("route") ?? "",
    responseStatus: sp.get("responseStatus") ?? "",
  };
}

export function adminAuditUrlStateToSearch(state: AdminAuditUrlState): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set("source", state.source);
  if (state.from) sp.set("from", state.from);
  if (state.to) sp.set("to", state.to);
  if (state.actorUserId) sp.set("actor", state.actorUserId);
  if (state.offset > 0) sp.set("offset", String(state.offset));
  if (state.action) sp.set("action", state.action);
  if (state.entityType) sp.set("entityType", state.entityType);
  if (state.entityId) sp.set("entityId", state.entityId);
  if (state.clientCode) sp.set("clientCode", state.clientCode);
  if (state.dealerId) sp.set("dealerId", state.dealerId);
  if (state.responsibleRole) sp.set("responsibleRole", state.responsibleRole);
  if (state.route) sp.set("route", state.route);
  if (state.responseStatus) sp.set("responseStatus", state.responseStatus);
  return sp;
}

export function useAdminAuditUrlState(): {
  state: AdminAuditUrlState;
  setState: (patch: Partial<AdminAuditUrlState>) => void;
} {
  const [state, setStateInternal] = useState<AdminAuditUrlState>(() => parseAdminAuditUrlState());

  useEffect(() => {
    const onPop = () => setStateInternal(parseAdminAuditUrlState());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setState = useCallback((patch: Partial<AdminAuditUrlState>) => {
    setStateInternal((prev) => {
      const next = { ...prev, ...patch };
      writeSearch(adminAuditUrlStateToSearch(next));
      return next;
    });
  }, []);

  return { state, setState };
}

export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(v: string): string | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const d = new Date(t);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d.toISOString();
}
