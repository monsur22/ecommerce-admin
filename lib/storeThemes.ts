/**
 * Storefront templates the owner can pick (Online store > Template), saved as `onlineStore.themePreset`.
 *
 * Each template is a different store layout (header, home page, product card, product page, footer)
 * with its own colours and fonts. Mirrors aura-shop `src/templates` + `src/themes/index.ts` and the
 * backend list (StorefrontController::THEME_PRESETS). Here only what the gallery preview needs.
 */

export type StoreThemeId = "editorial" | "market" | "luxe" | "single" | "fresh"

export interface StoreThemePreview {
  id: StoreThemeId
  name: string
  description: string
  /** Who it suits */
  bestFor: string
  fonts: string
  /** CSS font-family stacks */
  display: string
  body: string
  /** HSL triplets, light mode */
  bg: string
  card: string
  fg: string
  muted: string
  primary: string
  primaryFg: string
  highlight: string
  highlightFg: string
  ink: string
  inkFg: string
  border: string
  tiles: [string, string, string, string]
  radius: string
  pill: string
}

export const DEFAULT_STORE_THEME: StoreThemeId = "editorial"

export const STORE_THEMES: StoreThemePreview[] = [
  {
    id: "editorial",
    name: "Editorial",
    description: "Magazine-style home with tilted photo cards, pastel tiles and a floating phone tab bar.",
    bestFor: "Fashion and lifestyle brands",
    fonts: "Fraunces · DM Sans",
    display: "Fraunces, Georgia, serif",
    body: '"DM Sans", system-ui, sans-serif',
    bg: "0 0% 100%", card: "0 0% 100%", fg: "24 10% 10%", muted: "25 5% 45%",
    primary: "24 10% 10%", primaryFg: "0 0% 100%",
    highlight: "341 62% 36%", highlightFg: "0 0% 100%",
    ink: "24 10% 10%", inkFg: "0 0% 100%", border: "30 8% 90%",
    tiles: ["47 95% 76.5%", "158 55% 78%", "197.5 71% 78%", "346 85% 84%"],
    radius: "1rem", pill: "9999px",
  },
  {
    id: "market",
    name: "Mega Market",
    description: "Marketplace layout: category sidebar, banner slider, flash sale with countdown, dense product grid.",
    bestFor: "Stores with many products and categories",
    fonts: "Sora · Inter",
    display: 'Sora, "Segoe UI", system-ui, sans-serif',
    body: 'Inter, "Segoe UI", system-ui, sans-serif',
    bg: "220 20% 95%", card: "0 0% 100%", fg: "222 30% 12%", muted: "220 9% 42%",
    primary: "222 47% 16%", primaryFg: "0 0% 100%",
    highlight: "350 80% 47%", highlightFg: "0 0% 100%",
    ink: "222 47% 13%", inkFg: "0 0% 100%", border: "220 14% 88%",
    tiles: ["220 20% 94%", "210 40% 94%", "30 60% 94%", "150 30% 93%"],
    radius: "0.5rem", pill: "0.375rem",
  },
  {
    id: "luxe",
    name: "Luxe Lookbook",
    description: "Full-screen photo hero, centred logo, big images that swap on hover, lots of white space.",
    bestFor: "Fashion, jewellery and premium brands",
    fonts: "Bodoni Moda · Jost",
    display: '"Bodoni Moda", Didot, "Times New Roman", serif',
    body: 'Jost, Futura, system-ui, sans-serif',
    bg: "0 0% 100%", card: "0 0% 100%", fg: "0 0% 7%", muted: "0 0% 40%",
    primary: "0 0% 7%", primaryFg: "0 0% 100%",
    highlight: "12 40% 40%", highlightFg: "0 0% 100%",
    ink: "0 0% 7%", inkFg: "0 0% 100%", border: "0 0% 88%",
    tiles: ["30 10% 86%", "20 8% 80%", "40 12% 88%", "0 0% 84%"],
    radius: "0rem", pill: "0rem",
  },
  {
    id: "single",
    name: "Single Product",
    description: "One long landing page for your hero product with reviews, FAQ and the order form on the page.",
    bestFor: "1–5 products sold through Facebook or TikTok ads",
    fonts: "Unbounded · Hind Siliguri",
    display: 'Unbounded, "Arial Black", system-ui, sans-serif',
    body: '"Hind Siliguri", system-ui, sans-serif',
    bg: "40 40% 98%", card: "0 0% 100%", fg: "250 30% 12%", muted: "250 8% 40%",
    primary: "250 30% 12%", primaryFg: "0 0% 100%",
    highlight: "152 76% 32%", highlightFg: "0 0% 100%",
    ink: "250 30% 12%", inkFg: "40 40% 98%", border: "40 15% 87%",
    tiles: ["40 100% 92%", "152 50% 90%", "260 60% 94%", "200 70% 92%"],
    radius: "1.25rem", pill: "9999px",
  },
  {
    id: "fresh",
    name: "Daily Fresh",
    description: "Quick-buy layout: category circles, product rails, + buttons on every card and a cart total bar.",
    bestFor: "Grocery, pharmacy and daily needs",
    fonts: "Baloo Da 2 · Nunito",
    display: '"Baloo Da 2", "Trebuchet MS", system-ui, sans-serif',
    body: "Nunito, system-ui, sans-serif",
    bg: "100 30% 97%", card: "0 0% 100%", fg: "150 30% 12%", muted: "150 8% 38%",
    primary: "150 62% 27%", primaryFg: "0 0% 100%",
    highlight: "40 96% 52%", highlightFg: "150 30% 10%",
    ink: "150 50% 17%", inkFg: "100 30% 97%", border: "100 15% 86%",
    tiles: ["95 45% 90%", "48 90% 88%", "16 85% 90%", "180 35% 88%"],
    radius: "1rem", pill: "9999px",
  },
]

export const isStoreThemeId = (v: unknown): v is StoreThemeId => STORE_THEMES.some((t) => t.id === v)

/** One stylesheet with every template's fonts, for the gallery previews. */
export const STORE_THEME_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "Fraunces:ital,opsz,wght@0,9..144,800;1,9..144,800",
    "DM+Sans:wght@400;600",
    "Sora:wght@700;800",
    "Inter:wght@400;600",
    "Bodoni+Moda:ital,opsz,wght@0,6..96,500;1,6..96,500",
    "Jost:wght@400;500",
    "Unbounded:wght@700;800",
    "Hind+Siliguri:wght@500;600",
    "Baloo+Da+2:wght@700;800",
    "Nunito:wght@600;800",
  ].map((f) => `family=${f}`).join("&") +
  "&display=swap"
