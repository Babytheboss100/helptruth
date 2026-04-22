import { TENANTS, DEFAULT_TENANT_ID } from "./tenants";

const normalize = (host) => (host || "").toLowerCase().split(":")[0].replace(/^www\./, "");

export function resolveTenantByHost(host) {
  const h = normalize(host);
  if (!h) return TENANTS[DEFAULT_TENANT_ID];
  for (const tenant of Object.values(TENANTS)) {
    if (normalize(tenant.domain) === h) return tenant;
    if (tenant.aliases.some((alias) => normalize(alias) === h)) return tenant;
  }
  return TENANTS[DEFAULT_TENANT_ID];
}

export function resolveTenantFromLocation() {
  if (typeof window === "undefined") return TENANTS[DEFAULT_TENANT_ID];
  const override = new URLSearchParams(window.location.search).get("tenant");
  if (override && TENANTS[override]) return TENANTS[override];
  return resolveTenantByHost(window.location.hostname);
}
