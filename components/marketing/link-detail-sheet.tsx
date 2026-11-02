"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, MousePointerClick, Percent, ShoppingCart, Banknote } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/common/EmptyState"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { SectionTitle } from "@/components/common/SectionTitle"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { StatTile } from "@/components/common/StatTile"
import { StatusBadge } from "@/components/common/StatusBadge"
import { AdSourceBadge, OrderFlagBadges } from "@/components/sales/ad-source"
import { SharePanel } from "@/components/marketing/link-dialog"
import { ClicksOrdersChart, PERIODS, TARGET_LABEL, pct } from "@/components/marketing/link-ui"
import { campaignLinkApi, type CampaignLink, type LinkDetailStats, type LinkPeriod } from "@/lib/campaignLinkApi"
import { apiErrorMessage } from "@/lib/collectionApi"
import { useCompanySettings } from "@/contexts/company-settings-context"

interface LinkDetailSheetProps {
  /** Link id to show; null closes the sheet. */
  linkId: number | null
  /** Row data shown while the stats load. */
  initial?: CampaignLink | null
  storeName?: string
  onClose: () => void
  onEdit?: (link: CampaignLink) => void
}

export function LinkDetailSheet({ linkId, initial, storeName, onClose, onEdit }: LinkDetailSheetProps) {
  const { formatCurrency } = useCompanySettings()
  const [period, setPeriod] = React.useState<LinkPeriod>("30d")
  const [data, setData] = React.useState<LinkDetailStats | null>(null)
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => { if (linkId == null) { setData(null); setError("") } }, [linkId])

  React.useEffect(() => {
    if (linkId == null) return
    let live = true
    setLoading(true); setError("")
    campaignLinkApi.stats(linkId, period)
      .then((d) => { if (live) setData(d) })
      .catch((e) => { if (live) setError(apiErrorMessage(e, "Could not load this link")) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [linkId, period])

  const link = data?.link.id === linkId ? data.link : initial?.id === linkId ? initial : null

  return (
    <Sheet open={linkId != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="pr-10">
          <SheetTitle>{link?.name ?? "Order link"}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-1.5">
              {link && <AdSourceBadge source={link.channel} />}
              {link && <Badge variant="outline">{TARGET_LABEL[link.targetType]}{link.target ? `: ${link.target.name}` : ""}</Badge>}
              {link && <StatusBadge status={link.isActive ? "Active" : "Inactive"} variant={link.isActive ? "default" : "outline"} />}
              {link && <span className="font-mono text-xs text-muted-foreground">/{link.code}</span>}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          {link && <SharePanel link={link} storeName={storeName} compact />}

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle as="h2">Performance</SectionTitle>
            <SegmentedControl aria-label="Period" value={period} onValueChange={(v) => setPeriod(v as LinkPeriod)} options={PERIODS} />
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : loading && !data ? (
            <div className="grid grid-cols-2 gap-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="Clicks" value={data.clicks.toLocaleString()} icon={<MousePointerClick />} className="p-4" />
                <StatTile label="Orders" value={data.orders.toLocaleString()} icon={<ShoppingCart />} className="p-4" />
                <StatTile label="Revenue" value={formatCurrency(data.revenue)} icon={<Banknote />} className="p-4" hint="Excludes cancelled" />
                <StatTile label="Conversion" value={pct(data.conversionRate)} icon={<Percent />} className="p-4" hint="Orders ÷ clicks" />
              </div>
              <InfoList className="grid-cols-2 gap-3 sm:grid-cols-4">
                <InfoRow layout="stacked" label="Pending" value={<span className="tabular-nums">{data.pending}</span>} />
                <InfoRow layout="stacked" label="Confirmed" value={<span className="tabular-nums">{data.confirmed}</span>} />
                <InfoRow layout="stacked" label="Delivered" value={<span className="tabular-nums">{data.delivered}</span>} />
                <InfoRow layout="stacked" label="Cancelled" value={<span className="tabular-nums">{data.cancelled}</span>} />
              </InfoList>
              <ClicksOrdersChart days={data.byDay} />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <SectionTitle as="h2">Recent orders</SectionTitle>
                  {data.orders > 0 && (
                    <Button asChild variant="link" size="sm" className="h-auto p-0">
                      <Link href={`/dashboard/orders?campaignLinkId=${linkId}`}>All orders from this link <ArrowRight className="size-3.5" aria-hidden /></Link>
                    </Button>
                  )}
                </div>
                {data.recentOrders.length === 0 ? (
                  <EmptyState icon={ShoppingCart} title="No orders yet" description="Orders placed through this link show up here." bordered className="p-6" />
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recentOrders.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell>
                              <Link href={`/dashboard/orders?q=${encodeURIComponent(o.invoiceNo)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                                #{o.invoiceNo}
                              </Link>
                              <div className="text-xs text-muted-foreground">{o.orderTime ? new Date(o.orderTime).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : ""}</div>
                              <OrderFlagBadges order={o} className="mt-1" />
                            </TableCell>
                            <TableCell>{o.customerName || "—"}</TableCell>
                            <TableCell><StatusBadge status={o.status} /></TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(o.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          ) : null}

          {link && (
            <>
              <Separator />
              <InfoList className="gap-2">
                <InfoRow label="utm_source" value={<span className="font-mono text-xs">{link.utmSource || "—"}</span>} />
                <InfoRow label="utm_medium" value={<span className="font-mono text-xs">{link.utmMedium || "—"}</span>} />
                <InfoRow label="utm_campaign" value={<span className="break-all font-mono text-xs">{link.utmCampaign || "—"}</span>} />
                <InfoRow label="utm_content" value={<span className="break-all font-mono text-xs">{link.utmContent || "—"}</span>} />
                {link.notes && <InfoRow label="Notes" value={<span className="whitespace-pre-line font-normal">{link.notes}</span>} />}
                <InfoRow label="Created" value={[link.createdAt ? new Date(link.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "", link.createdByName].filter(Boolean).join(" · ") || "—"} />
                {link.lastClickedAt && <InfoRow label="Last click" value={new Date(link.lastClickedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} />}
              </InfoList>
              {onEdit && <Button type="button" variant="outline" className="w-fit" onClick={() => onEdit(link)}>Edit link</Button>}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
