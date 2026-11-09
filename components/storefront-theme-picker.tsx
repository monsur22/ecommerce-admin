"use client"

import { useEffect } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { STORE_THEMES, STORE_THEME_FONTS_HREF, type StoreThemeId, type StoreThemePreview } from "@/lib/storeThemes"
import { cn } from "@/lib/utils"

export type ColorSource = "theme" | "brand"

export interface BrandColors {
  primaryColor: string
  accentColor: string
  backgroundColor: string
}

interface Props {
  theme: StoreThemeId
  onTheme: (id: StoreThemeId) => void
  colorSource: ColorSource
  onColorSource: (v: ColorSource) => void
  /** Accent colour hex, or "" for the template's own */
  accent: string
  onAccent: (hex: string) => void
  accents: [string, string][]
  /** Company settings brand colours, or null when none are saved */
  brand: BrandColors | null
}

const hsl = (v: string) => `hsl(${v})`

/** Gallery of storefront templates, each with a miniature of its real layout, plus colour and accent choice. */
export function StorefrontThemePicker({ theme, onTheme, colorSource, onColorSource, accent, onAccent, accents, brand }: Props) {
  useEffect(() => {
    if (document.getElementById("store-theme-preview-fonts")) return
    const link = document.createElement("link")
    link.id = "store-theme-preview-fonts"
    link.rel = "stylesheet"
    link.href = STORE_THEME_FONTS_HREF
    document.head.appendChild(link)
  }, [])

  const usingBrand = colorSource === "brand" && !!brand

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Store template" className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
        {STORE_THEMES.map((t) => {
          const selected = t.id === theme
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onTheme(t.id)}
              className={cn(
                "group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary ring-2 ring-primary" : "hover:shadow-md",
              )}
            >
              <span aria-hidden="true" className="relative block h-[188px] overflow-hidden border-b" style={{ background: hsl(t.bg), color: hsl(t.fg), fontFamily: t.body }}>
                <Preview t={t} accent={!usingBrand && accent ? accent : null} />
              </span>
              <span className="flex flex-1 items-start justify-between gap-2 p-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{t.description}</span>
                  <span className="mt-1.5 block text-[11px] font-medium text-foreground/70">Best for: {t.bestFor}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{t.fonts}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                >
                  {selected && <Check className="size-3" strokeWidth={3} />}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">Colours</p>
        <div role="group" aria-label="Colours" className="flex flex-wrap gap-2">
          <Button type="button" size="sm" aria-pressed={!usingBrand} variant={!usingBrand ? "default" : "outline"} onClick={() => onColorSource("theme")}>
            Template colours
          </Button>
          <Button type="button" size="sm" aria-pressed={usingBrand} variant={usingBrand ? "default" : "outline"} disabled={!brand} onClick={() => onColorSource("brand")}>
            {brand && (
              <span className="flex -space-x-1" aria-hidden="true">
                {[brand.backgroundColor, brand.primaryColor, brand.accentColor].map((c, i) => (
                  <span key={i} className="size-3.5 rounded-full ring-1 ring-border" style={{ background: c }} />
                ))}
              </span>
            )}
            My brand colours
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {!brand
            ? "Set brand colours in Company settings to use them instead of the template's."
            : usingBrand
              ? "Your Company settings brand colours replace the template's colours. The layout and fonts stay."
              : "The template's own colours, in light and dark mode."}
        </p>
      </div>

      {!usingBrand && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">Accent</p>
          <div role="group" aria-label="Accent colour" className="flex flex-wrap gap-2">
            <Button type="button" size="sm" aria-pressed={!accent} variant={!accent ? "default" : "outline"} onClick={() => onAccent("")}>
              Template&apos;s own
            </Button>
            {accents.map(([color, label]) => (
              <Button key={color} type="button" size="sm" aria-pressed={accent === color} variant={accent === color ? "default" : "outline"} onClick={() => onAccent(color)}>
                <span className="size-4 rounded-full" style={{ background: color }} />
                {label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Used for sale tags, badges and the main buttons.</p>
        </div>
      )}
    </div>
  )
}

/** Miniature of each template's real home page layout, in its own colours and fonts. */
function Preview({ t, accent }: { t: StoreThemePreview; accent: string | null }) {
  const hl = accent ?? hsl(t.highlight)
  const hlFg = accent ? "#fff" : hsl(t.highlightFg)
  const display = { fontFamily: t.display } as const
  const bar = (w: string, o = 0.18) => <span className="block h-1 rounded-full" style={{ width: w, background: hsl(t.fg), opacity: o }} />

  switch (t.id) {
    case "market":
      return (
        <span className="flex h-full flex-col text-[7px]">
          <span className="flex items-center gap-1.5 px-2 py-1.5" style={{ background: hsl(t.ink), color: hsl(t.inkFg) }}>
            <span style={{ ...display, fontWeight: 800 }} className="text-[9px]">Aura</span>
            <span className="h-3 flex-1 rounded-sm" style={{ background: hsl(t.card) }} />
            <span className="rounded-sm px-1 py-0.5" style={{ background: hl, color: hlFg }}>Cart 2</span>
          </span>
          <span className="grid flex-1 grid-cols-[52px_1fr] gap-1.5 p-1.5">
            <span className="flex flex-col gap-1 rounded-sm p-1" style={{ background: hsl(t.card) }}>
              {["Phones", "Fashion", "Home", "Beauty", "Toys"].map((c) => (
                <span key={c} className="flex items-center justify-between" style={{ color: hsl(t.muted) }}>{c}<span>›</span></span>
              ))}
            </span>
            <span className="flex flex-col gap-1.5">
              <span className="flex h-12 flex-col justify-center rounded-sm px-2" style={{ background: hsl(t.ink), color: hsl(t.inkFg) }}>
                <span style={{ ...display, fontWeight: 800 }} className="text-[10px]">Mega Sale</span>
                <span className="opacity-70">Up to 60% off</span>
              </span>
              <span className="flex items-center gap-1">
                <span style={{ ...display, fontWeight: 800, color: hl }} className="text-[8px]">Flash Sale</span>
                {["02", "14", "37"].map((n) => <span key={n} className="rounded-sm px-0.5" style={{ background: hsl(t.ink), color: hsl(t.inkFg) }}>{n}</span>)}
              </span>
              <span className="grid grid-cols-4 gap-1">
                {t.tiles.map((tile, i) => (
                  <span key={i} className="flex flex-col gap-0.5 rounded-sm p-0.5" style={{ background: hsl(t.card) }}>
                    <span className="block aspect-square rounded-sm" style={{ background: hsl(tile) }} />
                    <span style={{ color: hl, fontWeight: 700 }}>৳{[450, 1290, 99, 760][i]}</span>
                  </span>
                ))}
              </span>
            </span>
          </span>
        </span>
      )

    case "luxe":
      return (
        <span className="flex h-full flex-col">
          <span className="relative flex flex-1 flex-col justify-end p-3" style={{ background: `linear-gradient(160deg, hsl(${t.tiles[0]}), hsl(${t.tiles[1]}) 60%, hsl(${t.fg} / 0.55))` }}>
            <span className="absolute inset-x-0 top-2 flex items-center justify-between px-3 text-[7px] uppercase tracking-[0.2em] text-white">
              <span>☰</span>
              <span style={display} className="text-[10px] tracking-[0.3em]">AURA</span>
              <span>Bag (0)</span>
            </span>
            <span style={display} className="text-[22px] leading-none text-white">
              New <em>Season</em>
            </span>
            <span className="mt-1 text-[7px] uppercase tracking-[0.2em] text-white underline underline-offset-2">Discover →</span>
          </span>
          <span className="grid grid-cols-3 gap-1 p-1.5">
            {t.tiles.slice(1).map((tile, i) => (
              <span key={i} className="flex flex-col gap-0.5">
                <span className="block h-7" style={{ background: hsl(tile) }} />
                <span className="text-[6px] uppercase tracking-[0.15em]">Silk dress</span>
              </span>
            ))}
          </span>
        </span>
      )

    case "single":
      return (
        <span className="flex h-full flex-col">
          <span className="flex items-center justify-between px-2.5 py-1.5 text-[7px]" style={{ borderBottom: `1px solid ${hsl(t.border)}` }}>
            <span style={{ ...display, fontWeight: 800 }} className="text-[9px]">Aura</span>
            <span className="px-2 py-0.5 font-semibold" style={{ background: hl, color: hlFg, borderRadius: t.pill }}>Order now</span>
          </span>
          <span className="grid flex-1 grid-cols-[1.1fr_1fr] items-center gap-2 px-2.5">
            <span className="flex flex-col gap-1">
              <span className="self-start px-1.5 text-[6px] font-semibold" style={{ background: hsl(t.tiles[1]), borderRadius: t.pill }}>Best seller</span>
              <span style={{ ...display, fontWeight: 800 }} className="text-[12px] leading-tight">Glow Serum</span>
              <span className="flex items-baseline gap-1 text-[8px]">
                <b style={display}>৳890</b>
                <s style={{ color: hsl(t.muted) }}>৳1200</s>
              </span>
              <span className="text-[7px]" style={{ color: hl }}>★★★★★ 214</span>
              <span className="mt-0.5 py-1 text-center text-[7px] font-semibold" style={{ background: hl, color: hlFg, borderRadius: t.pill }}>Order now — COD</span>
            </span>
            <span className="flex aspect-square items-center justify-center text-2xl" style={{ background: hsl(t.tiles[0]), borderRadius: t.radius }}>🧴</span>
          </span>
          <span className="flex items-center justify-between px-2.5 py-1 text-[7px]" style={{ background: hsl(t.ink), color: hsl(t.inkFg) }}>
            <span>Offer ends in 05:42:10</span>
            <span>Only 7 left</span>
          </span>
        </span>
      )

    case "fresh":
      return (
        <span className="flex h-full flex-col text-[7px]">
          <span className="px-2 py-0.5 text-[6px]" style={{ background: hsl(t.primary), color: hsl(t.primaryFg) }}>Delivery in 24 hours</span>
          <span className="flex items-center gap-1.5 px-2 py-1.5">
            <span style={{ ...display, fontWeight: 800, color: hsl(t.primary) }} className="text-[10px]">Aura</span>
            <span className="h-3.5 flex-1" style={{ background: hsl(t.card), border: `1px solid ${hsl(t.border)}`, borderRadius: t.pill }} />
            <span className="px-1.5 py-0.5 font-bold" style={{ background: hl, color: hlFg, borderRadius: t.pill }}>🛒 ৳540</span>
          </span>
          <span className="flex justify-between px-2">
            {["🥦", "🍎", "🥛", "🍞", "🧴"].map((e, i) => (
              <span key={e} className="flex size-7 items-center justify-center rounded-full text-[11px]" style={{ background: hsl(t.tiles[i % 4]) }}>{e}</span>
            ))}
          </span>
          <span className="mt-1.5 grid grid-cols-3 gap-1 px-2">
            {["🥕", "🍌", "🥚"].map((e, i) => (
              <span key={e} className="relative flex flex-col gap-0.5 p-1" style={{ background: hsl(t.card), border: `1px solid ${hsl(t.border)}`, borderRadius: `calc(${t.radius} * 0.6)` }}>
                <span className="flex h-7 items-center justify-center text-[12px]" style={{ background: hsl(t.tiles[(i + 1) % 4]), borderRadius: `calc(${t.radius} * 0.4)` }}>{e}</span>
                <b style={{ color: hsl(t.primary) }}>৳{[60, 45, 140][i]}</b>
                <span className="absolute bottom-1 right-1 flex size-3.5 items-center justify-center rounded-full font-bold" style={{ background: hsl(t.primary), color: hsl(t.primaryFg) }}>+</span>
              </span>
            ))}
          </span>
        </span>
      )

    default:
      return (
        <span className="flex h-full flex-col p-3">
          <span className="flex items-center justify-between">
            <span style={{ ...display, fontWeight: 800 }} className="text-[12px] leading-none">Aura</span>
            <span className="flex gap-1">
              <span className="size-1.5 rounded-full" style={{ background: hsl(t.fg) }} />
              <span className="size-1.5 rounded-full" style={{ background: hl }} />
            </span>
          </span>
          <span className="mt-2.5 grid flex-1 grid-cols-[1fr_1.15fr] gap-2.5">
            <span className="relative">
              <span className="absolute left-1 top-1 h-16 w-12 rotate-[-6deg] text-center text-xl leading-[4rem]" style={{ background: hsl(t.tiles[0]), borderRadius: `calc(${t.radius} * 0.6)` }}>👗</span>
              <span className="absolute bottom-1 right-0 h-14 w-11 rotate-[5deg] text-center text-lg leading-[3.5rem]" style={{ background: hsl(t.tiles[1]), borderRadius: `calc(${t.radius} * 0.6)` }}>👔</span>
            </span>
            <span className="flex min-w-0 flex-col justify-center">
              <span style={{ ...display, fontWeight: 800 }} className="text-[16px] leading-[1.05]">
                Wear the <em style={{ color: hl }}>happy</em> stuff.
              </span>
              <span className="mt-2 self-start px-2.5 py-1 text-[8px] font-semibold" style={{ background: hsl(t.ink), color: hsl(t.inkFg), borderRadius: t.pill }}>Shop the drop</span>
            </span>
          </span>
          <span className="mt-2 grid grid-cols-3 gap-1.5">
            {t.tiles.slice(1).map((tile, i) => (
              <span key={i} className="flex flex-col gap-0.5">
                <span className="block h-5" style={{ background: hsl(tile), borderRadius: `calc(${t.radius} * 0.5)` }} />
                {bar("70%")}
              </span>
            ))}
          </span>
        </span>
      )
  }
}
