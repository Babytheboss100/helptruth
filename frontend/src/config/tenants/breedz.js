/** @type {import('./types').Tenant} */
const breedz = {
  id: "breedz",
  brandName: "BREEDZ",
  domain: "social.breedz.eu",
  aliases: [],
  logoSrc: "/breedz-logo.png",
  faviconSrc: "/breedz-favicon.png",
  localeDefault: "en",
  metaDescription: "BREEDZ Social — a members-only feed for investors, founders, and operators.",
  palette: {
    bg: "#0a0a0f",
    bgElevated: "#12121a",
    surface: "rgba(255, 255, 255, 0.03)",
    border: "rgba(255, 255, 255, 0.08)",
    borderGlow: "rgba(138, 92, 255, 0.35)",
    text: "#f5f5f7",
    textMuted: "rgba(245, 245, 247, 0.6)",
    textFaint: "rgba(245, 245, 247, 0.35)",
    accent: "#8a5cff",
    accentGlow: "#a878ff",
    gold: "#d4af37",
    danger: "#ff5470",
    success: "#2ee6a0",
  },
  fonts: {
    sans: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    serif: "'Playfair Display', Georgia, serif",
    googleImports: ["Plus+Jakarta+Sans:wght@400;500;600;700;800", "Playfair+Display:wght@600;700;800"],
  },
  features: {
    breedzInsights: true,
  },
};

export default breedz;
