/**
 * Exchange path helpers for VM scripts (mirrors exchange-fetch.ts).
 * VM runs outside Next.js — keep in sync with shared/admin/exchange-fetch.ts.
 */

export function getFtpExchangeBase() {
  return (process.env.FTP_EXCHANGE_BASE?.trim() || "/s3/IMG/exchange").replace(/\/+$/, "");
}

export function resolveExchangeRootPrefix() {
  const raw = process.env.EXCHANGE_ROOT_PREFIX?.trim() ?? "";
  if (!raw) return "";
  const withLead = raw.startsWith("/") ? raw : `/${raw}`;
  return withLead.replace(/\/+$/, "");
}

export function applyExchangeRootPrefix(subpath) {
  const prefix = resolveExchangeRootPrefix();
  if (!prefix) return subpath;
  const clean = subpath.startsWith("/") ? subpath : `/${subpath}`;
  if (clean === prefix || clean.startsWith(`${prefix}/`)) return clean;
  return `${prefix}${clean}`;
}

export function resolveCatalogFtpSubpath() {
  const prefix = resolveExchangeRootPrefix();
  return prefix ? "/catalog1.xml" : "/full_import/catalog1.xml";
}

export function resolveCatalogFtpPath() {
  return `${getFtpExchangeBase()}${applyExchangeRootPrefix(resolveCatalogFtpSubpath())}`;
}
