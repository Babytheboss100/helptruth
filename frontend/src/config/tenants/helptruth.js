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
    bg: "#F8FAFF",
    bgElevated: "#FFFFFF",
    surface: "rgba(53, 109, 255, 0.04)",
    border: "#E2E8F0",
    borderGlow: "rgba(53, 109, 255, 0.25)",
    text: "#0F172A",
    textMuted: "#5B6B84",
    textFaint: "#94A3B8",
    accent: "#356DFF",
    accentGlow: "#2559E8",
    gold: "#356DFF",
    danger: "#EF4444",
    success: "#22C55E",
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
