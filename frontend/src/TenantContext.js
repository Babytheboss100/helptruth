import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { resolveTenantFromLocation } from "./config/resolveTenant";
import { TENANTS, DEFAULT_TENANT_ID } from "./config/tenants";

const TenantContext = createContext(TENANTS[DEFAULT_TENANT_ID]);

function applyTenantToDocument(tenant) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-tenant", tenant.id);
  root.lang = tenant.localeDefault.split("-")[0] || "en";
  document.title = tenant.brandName;
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute("content", tenant.metaDescription);
  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.setAttribute("rel", "icon");
    document.head.appendChild(favicon);
  }
  favicon.setAttribute("href", tenant.faviconSrc);
}

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(() => resolveTenantFromLocation());

  useEffect(() => {
    applyTenantToDocument(tenant);
  }, [tenant]);

  const value = useMemo(() => ({ tenant, setTenant }), [tenant]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  return useContext(TenantContext).tenant;
}

export function useTenantSetter() {
  return useContext(TenantContext).setTenant;
}
