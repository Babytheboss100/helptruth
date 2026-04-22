/** @type {import('./types').Tenant} */
const helptruth = {
  id: "helptruth",
  brandName: "HelpTruth",
  domain: "app.helptruth.com",
  aliases: ["helptruth.com", "www.helptruth.com"],
  logoSrc: "/logo-helptruth.png",
  faviconSrc: "/favicon.ico",
  localeDefault: "nb-NO",
  metaDescription: "HelpTruth — Si det som er sant",
  palette: {
    bg: "#050e05",
    bgElevated: "#0a150a",
    surface: "rgba(74, 222, 128, 0.03)",
    border: "#1e2a1e",
    borderGlow: "rgba(74, 222, 128, 0.28)",
    text: "#e8f5e8",
    textMuted: "#4a7a4a",
    textFaint: "rgba(232, 245, 232, 0.35)",
    accent: "#4ade80",
    accentGlow: "#6ee89a",
    gold: "#4ade80",
    danger: "#ef4444",
    success: "#4ade80",
  },
  fonts: {
    sans: "'Crimson Pro', Georgia, serif",
    serif: "'DM Serif Display', Georgia, serif",
    googleImports: ["DM+Serif+Display", "Crimson+Pro:wght@400;500;600;700"],
  },
  features: {
    breedzInsights: false,
  },
};

export default helptruth;
