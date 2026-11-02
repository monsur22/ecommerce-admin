"use client"

import * as React from "react"
import { Check, Copy, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { WithTooltip } from "@/components/common/WithTooltip"
import { AD_SOURCE_META } from "@/components/sales/ad-source"
import { qrMatrix } from "@/lib/qr"
import type { CampaignLink, LinkChannel, LinkPeriod, LinkTargetType } from "@/lib/campaignLinkApi"
import { cn } from "@/lib/utils"

export const PERIODS: { value: LinkPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
]

export const TARGET_LABEL: Record<LinkTargetType, string> = {
  product: "Product page",
  quick_order: "Quick order form",
  collection: "Collection",
  store: "Whole store",
}

export const channelLabel = (c: string) => AD_SOURCE_META[c]?.label ?? c

/** Server UTM defaults (AD_ORDERS_API_CONTRACT.md §3.1), mirrored for the live preview in the form. */
export const UTM_MEDIUM: Record<LinkChannel, string> = {
  facebook: "social", instagram: "social", tiktok: "social", youtube: "social", messenger: "social",
  whatsapp: "chat", google: "cpc", other: "referral",
}

export const slugify = (v: string, max = 100) =>
  v.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "")

export const pct = (n: number) => `${(Number(n) || 0).toFixed(n >= 10 || n === 0 ? 1 : 2)}%`

/** The link a shopper should get: short URL, else the full URL, else the bare path. */
export const shareUrl = (l: Pick<CampaignLink, "shortUrl" | "fullUrl" | "targetPath">) => l.shortUrl || l.fullUrl || l.targetPath

/** Read-only URL field with a copy button. */
export function CopyField({ id, label, value, onCopied }: { id: string; label: string; value: string; onCopied?: () => void }) {
  const [done, setDone] = React.useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true); onCopied?.()
      setTimeout(() => setDone(false), 1500)
    } catch { /* clipboard blocked */ }
  }
  return (
    <InputGroup>
      <InputGroupInput id={id} readOnly value={value} aria-label={label} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <InputGroupAddon align="inline-end">
        <WithTooltip content={done ? "Copied" : `Copy ${label.toLowerCase()}`}>
          <InputGroupButton size="icon-xs" aria-label={`Copy ${label.toLowerCase()}`} onClick={copy}>
            {done ? <Check aria-hidden /> : <Copy aria-hidden />}
          </InputGroupButton>
        </WithTooltip>
      </InputGroupAddon>
    </InputGroup>
  )
}

/** QR code for a URL (pure-TS encoder, no dependency) with an SVG download. */
export function QrCode({ value, size = 168, fileName = "order-link-qr", className }: { value: string; size?: number; fileName?: string; className?: string }) {
  const matrix = React.useMemo(() => qrMatrix(value), [value])
  if (!matrix) return <p className="text-xs text-muted-foreground">This link is too long for a QR code. Use the short link.</p>
  const n = matrix.length + 8
  let d = ""
  matrix.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + 4},${y + 4}h1v1h-1z` }))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="1024" height="1024" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
  const download = () => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    const a = document.createElement("a")
    a.href = url; a.download = `${fileName}.svg`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label={`QR code for ${value}`} className="rounded-md border">
        <rect width={n} height={n} fill="#fff" />
        <path d={d} fill="#000" />
      </svg>
      <Button type="button" variant="outline" size="sm" onClick={download}>
        <Download className="size-4" aria-hidden /> Download QR
      </Button>
    </div>
  )
}

/** Ready-to-post text for a link. */
export function buildCaption(kind: "facebook" | "whatsapp", link: Pick<CampaignLink, "targetType" | "target" | "shortUrl" | "fullUrl" | "targetPath">, storeName?: string) {
  const url = shareUrl(link)
  const what = link.target?.name || storeName || "our new collection"
  const action = link.targetType === "quick_order" ? "Order in 1 minute, no login needed" : link.targetType === "store" ? "Shop now" : "See details and order"
  if (kind === "whatsapp") {
    return [
      `Assalamu alaikum! ${what} is available now.`,
      `${action} (cash on delivery): ${url}`,
      "Reply here if you have any question.",
    ].join("\n")
  }
  return [
    `${what}`,
    "",
    `${action} — cash on delivery all over Bangladesh.`,
    `Order here: ${url}`,
    "",
    "Inbox us for size or colour questions.",
  ].join("\n")
}

/** Daily clicks (light) with orders (solid) on the same scale. */
export function ClicksOrdersChart({ days, height = 150 }: { days: { date: string; clicks: number; orders: number }[]; height?: number }) {
  const peak = Math.max(1, ...days.map((d) => Math.max(d.clicks, d.orders)))
  if (!days.some((d) => d.clicks || d.orders)) return <p className="py-8 text-center text-sm text-muted-foreground">No clicks or orders in this period.</p>
  const label = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  const every = days.length > 14 ? Math.ceil(days.length / 7) : 1
  return (
    <div>
      <div className="flex items-end gap-0.5 border-b" style={{ height }} role="img"
        aria-label={`Daily clicks and orders, peak ${peak}`}>
        {days.map((d) => (
          <WithTooltip key={d.date} content={`${label(d.date)}: ${d.clicks} click${d.clicks === 1 ? "" : "s"}, ${d.orders} order${d.orders === 1 ? "" : "s"}`}>
            <div className="relative flex h-full min-w-0 flex-1 items-end justify-center">
              <div className="absolute bottom-0 w-full max-w-5 rounded-t-sm bg-primary/20" style={{ height: `${d.clicks ? Math.max(2, (d.clicks / peak) * 100) : 0}%` }} />
              <div className="absolute bottom-0 w-full max-w-5 rounded-t-sm bg-primary" style={{ height: `${d.orders ? Math.max(3, (d.orders / peak) * 100) : 0}%` }} />
            </div>
          </WithTooltip>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5">
        {days.map((d, i) => (
          <span key={d.date} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground">{i % every === 0 ? label(d.date) : ""}</span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary/20" aria-hidden /> Clicks</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" aria-hidden /> Orders</span>
        <span className="ml-auto tabular-nums">Peak {peak}/day</span>
      </div>
    </div>
  )
}
