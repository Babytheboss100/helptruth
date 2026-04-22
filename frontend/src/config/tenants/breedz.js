/** @type {import('./types').Tenant} */
const breedz = {
  id: "breedz",
  brandName: "BREEDZ",
  domain: "social.breedz.eu",
  aliases: [],
  logoSrc: "/breedz-logo.png",
  faviconSrc: "/breedz-favicon.png",
  localeDefault: "en",
  metaDescription: "BREEDZ Social — a Twitter-style platform for European investors, founders, and builders.",
  palette: {
    bg: "#FBFAFF",
    bgElevated: "rgba(255, 255, 255, 0.75)",
    surface: "rgba(255, 255, 255, 0.55)",
    border: "rgba(255, 255, 255, 0.45)",
    borderGlow: "rgba(199, 182, 255, 0.4)",
    text: "#243B7A",
    textMuted: "#6B7499",
    textFaint: "#94A3B8",
    accent: "#8B7FD8",
    accentGlow: "#2C4FA3",
    gold: "#C7B6FF",
    danger: "#f91880",
    success: "#4ADE80",
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
