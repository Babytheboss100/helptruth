/**
 * @typedef {Object} TenantPalette
 * @property {string} bg               Base background
 * @property {string} bgElevated       Elevated surface (cards)
 * @property {string} surface          Glass/overlay surface
 * @property {string} border
 * @property {string} borderGlow
 * @property {string} text
 * @property {string} textMuted
 * @property {string} textFaint
 * @property {string} accent
 * @property {string} accentGlow
 * @property {string} gold             Optional — used by breedz; may repeat accent for others
 * @property {string} danger
 * @property {string} success
 */

/**
 * @typedef {Object} TenantFonts
 * @property {string} sans             CSS font-family string used for body text
 * @property {string} serif            CSS font-family string used for display/headings
 * @property {string[]} googleImports  Family names to preload via Google Fonts; empty array = no import
 */

/**
 * @typedef {Object} TenantFeatures
 * @property {boolean} breedzInsights  Shows structured AI-aggregated data-point panels
 */

/**
 * @typedef {Object} Tenant
 * @property {string} id                 Stable identifier (matches filename)
 * @property {string} brandName          Display name shown in nav and page title
 * @property {string} domain             Primary hostname (used for resolveTenant matching)
 * @property {string[]} aliases          Additional hostnames that map to this tenant
 * @property {string} logoSrc            Public path to the logo asset
 * @property {string} faviconSrc         Public path to the favicon
 * @property {string} localeDefault      BCP 47 locale string (e.g. "nb-NO", "en")
 * @property {string} metaDescription    HTML <meta name="description"> content
 * @property {TenantPalette} palette
 * @property {TenantFonts} fonts
 * @property {TenantFeatures} features
 */

export {};
