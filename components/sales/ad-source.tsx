"use client"

import * as React from "react"
import {
  Facebook, Globe, Instagram, MessageCircle, MessagesSquare, Music2, Phone, Search, Youtube, Zap, AlertTriangle,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { WithTooltip } from "@/components/common/WithTooltip"
import type { SellResponse } from "@/lib/sellsApi"
import { cn } from "@/lib/utils"

/** Sources an order can be attributed to (sells.adSource; null = direct / walk-in). AD_ORDERS_API_CONTRACT.md §1 */
export const AD_SOURCES = ["facebook", "instagram", "whatsapp", "messenger", "tiktok", "google", "youtube", "phone", "other"] as const
export type AdSource = typeof AD_SOURCES[number]

interface SourceMeta { label: string; icon: LucideIcon; className: string; social: boolean }

/** Brand-ish tint per source (text + soft background, readable in both themes). */
export const AD_SOURCE_META: Record<string, SourceMeta> = {
  facebook: { label: "Facebook", icon: Facebook, className: "border-transparent bg-[#1877F2]/12 text-[#1464cc] dark:text-[#6ea8ff]", social: true },
  instagram: { label: "Instagram", icon: Instagram, className: "border-transparent bg-[#E1306C]/12 text-[#c1275b] dark:text-[#ff7aa8]", social: true },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, className: "border-transparent bg-[#25D366]/15 text-[#128C7E] dark:text-[#4ee59a]", social: true },
  tiktok: { label: "TikTok", icon: Music2, className: "border-transparent bg-foreground/10 text-foreground", social: true },
  google: { label: "Google", icon: Search, className: "border-transparent bg-[#4285F4]/12 text-[#2a65c9] dark:text-[#8ab4f8]", social: true },
  youtube: { label: "YouTube", icon: Youtube, className: "border-transparent bg-[#FF0000]/10 text-[#cc0000] dark:text-[#ff6b6b]", social: true },
  messenger: { label: "Messenger", icon: MessagesSquare, className: "border-transparent bg-[#0084FF]/12 text-[#006fd6] dark:text-[#6eb6ff]", social: true },
  phone: { label: "Phone call", icon: Phone, className: "border-transparent bg-muted text-muted-foreground", social: false },
  other: { label: "Other", icon: Globe, className: "border-transparent bg-muted text-muted-foreground", social: true },
}

export const adSourceLabel = (s?: string | null) => (s ? AD_SOURCE_META[s]?.label ?? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "")

/** Options for the Orders / Sales `adSource` filter ("any" = any social / ad source). */
export const AD_SOURCE_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Ad source: All" },
  { value: "any", label: "From ads/social" },
  ...AD_SOURCES.map((v) => ({ value: v, label: AD_SOURCE_META[v].label })),
  { value: "none", label: "Direct / no source" },
]

/** Valid `adSource` filter values (for deep links). */
export const isAdSourceFilter = (v: string) => AD_SOURCE_FILTERS.some((f) => f.value === v && v !== "all")

/** "Source" options of the New sale form (orders typed in from chats / calls). */
export const MANUAL_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "direct", label: "Walk-in / direct" },
  { value: "facebook", label: "Facebook" },
  { value: "messenger", label: "Messenger" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "tiktok", label: "TikTok" },
  { value: "phone", label: "Phone call" },
  { value: "other", label: "Other" },
]

/** Small coloured badge with the source's icon. */
export function AdSourceBadge({ source, label, className, title }: { source?: string | null; label?: string | null; className?: string; title?: string }) {
  if (!source) return null
  const meta = AD_SOURCE_META[source]
  const Icon = meta?.icon ?? Globe
  const badge = (
    <Badge variant="outline" tabIndex={title ? 0 : undefined} className={cn("gap-1", meta?.className ?? "bg-muted text-muted-foreground", className)}>
      <Icon className="size-3" aria-hidden />
      {label || adSourceLabel(source)}
    </Badge>
  )
  return title ? <WithTooltip content={title}>{badge}</WithTooltip> : badge
}

/** Campaign line for tooltips: "Eid Panjabi FB post · utm_campaign=eid". */
export function campaignHint(o: SellResponse): string {
  return [o.campaignLink?.name, o.utmCampaign && `Campaign: ${o.utmCampaign}`].filter(Boolean).join(" · ")
}

/** "Quick order" + "Possible duplicate" chips for an order. */
export function OrderFlagBadges({ order, className }: { order: Pick<SellResponse, "isQuickOrder" | "possibleDuplicate">; className?: string }) {
  if (!order.isQuickOrder && !order.possibleDuplicate) return null
  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {order.isQuickOrder && (
        <WithTooltip content="Placed on the one-page quick order form">
          <Badge variant="secondary" className="gap-1" tabIndex={0}><Zap className="size-3" aria-hidden />Quick order</Badge>
        </WithTooltip>
      )}
      {order.possibleDuplicate && (
        <WithTooltip content="Same phone ordered the same product in the last 30 minutes. Check before confirming.">
          <Badge variant="destructive" className="gap-1" tabIndex={0}><AlertTriangle className="size-3" aria-hidden />Possible duplicate</Badge>
        </WithTooltip>
      )}
    </span>
  )
}
