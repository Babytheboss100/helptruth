import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { resolveTenantFromLocation } from "./config/resolveTenant";
import { TENANTS, DEFAULT_TENANT_ID } from "./config/tenants";

const TenantContext = createContext(TENANTS[DEFAULT_TENANT_ID]);

const FONT_LINK_ID = "tenant-google-fonts";

function applyTenantFonts(tenant) {
  if (typeof document === "undefined") return;
  const families = tenant.fonts?.googleImports || [];
  const existing = document.getElementById(FONT_LINK_ID);
  if (!families.length) {
    if (existing) existing.remove();
    return;
  }
  const href = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;
  if (existing) {
    if (existing.getAttribute("href") !== href) existing.setAttribute("href", href);
    return;
  }
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

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
  applyTenantFonts(tenant);
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
