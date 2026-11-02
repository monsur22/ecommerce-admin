"use client"

import { useCompanySettings } from "@/contexts/company-settings-context"
import { Card } from "@/components/ui/card"
import { SectionTitle } from "@/components/common/SectionTitle"
import { AD_SOURCE_META, adSourceLabel } from "@/components/sales/ad-source"
import { wholeMoney } from "./format"
import { CardTitle, DashCard, EmptyNote, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const CHANNEL_LABEL: Record<string, string> = { pos: "In-store POS", storefront: "Online store", manual: "Manual", cod: "Cash on delivery", online: "Online store" }
const CHANNEL_COLOR = ["var(--dash-accent)", "var(--dash-warn)", "var(--dash-neutral)", "var(--dash-success)"]
const CHANNEL_TEXT = ["#FFFFFF", "#1F1300", "#FFFFFF", "#FFFFFF"]

export function Channels() {
  const { formatCurrency: fullMoney } = useCompanySettings()
  const formatCurrency = (n: number) => wholeMoney(fullMoney, n)
  const { data, loading, error, retry } = useDashboardSection("channels")

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null
    if (data.channels.length === 0) return <EmptyNote>No sales in this period.</EmptyNote>

    const total = data.channels.reduce((s, c) => s + c.revenue, 0) || 1
    const pmTotal = data.paymentMethods.reduce((s, c) => s + c.revenue, 0) || 1

    return (
      <>
        <div className="flex h-10 gap-[3px] overflow-hidden rounded-[10px]" role="img"
          aria-label={data.channels.map((c) => `${CHANNEL_LABEL[c.key] ?? c.key} ${Math.round((c.revenue / total) * 100)}%`).join(", ")}>
          {data.channels.map((c, i) => {
            const pct = Math.round((c.revenue / total) * 100)
            return (
              <div key={c.key} className="flex items-center justify-center text-xs font-bold"
                style={{ width: `${(c.revenue / total) * 100}%`, background: CHANNEL_COLOR[i % 4], color: CHANNEL_TEXT[i % 4] }}>
                {pct >= 8 ? `${pct}%` : ""}
              </div>
            )
          })}
        </div>
        <ul className="divide-y">
          {data.channels.map((c, i) => (
            <li key={c.key} className="flex items-center gap-2.5 py-2.5 text-sm">
              <span className="size-2.5 rounded-[3px]" style={{ background: CHANNEL_COLOR[i % 4] }} aria-hidden />
              <span className="font-medium">{CHANNEL_LABEL[c.key] ?? c.key}</span>
              <span className="text-muted-foreground">{c.orders} orders</span>
              <span className="ml-auto font-semibold tabular-nums">{formatCurrency(c.revenue)}</span>
            </li>
          ))}
        </ul>
        {!!data.adSources?.length && (() => {
          const ads = data.adSources
          const adTotal = data.channels.reduce((n, c) => n + c.orders, 0)
          const adOrders = ads.reduce((n, a) => n + a.orders, 0)
          return (
            <>
              <SectionTitle className="mt-2">
                From ads &amp; social
                <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground">
                  {adOrders} order{adOrders === 1 ? "" : "s"}{adTotal > 0 ? ` · ${Math.round((adOrders / adTotal) * 100)}% of all` : ""}
                </span>
              </SectionTitle>
              <ul className="divide-y">
                {ads.map((a) => {
                  const Icon = AD_SOURCE_META[a.key]?.icon
                  return (
                    <li key={a.key} className="flex items-center gap-2.5 py-2 text-sm">
                      {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
                      <span className="font-medium">{adSourceLabel(a.key)}</span>
                      <span className="text-muted-foreground">{a.orders} orders</span>
                      <span className="ml-auto font-semibold tabular-nums">{formatCurrency(a.revenue)}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )
        })()}
        <SectionTitle className="mt-2">Payment methods</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.paymentMethods.map((m) => (
            <Card key={m.method} className="gap-0 p-2.5 shadow-none">
              <div className="truncate text-xs text-muted-foreground">{m.method}</div>
              <div className="font-semibold tabular-nums">{formatCurrency(m.revenue)}</div>
              <div className="text-[11px] text-muted-foreground">{Math.round((m.revenue / pmTotal) * 100)}%</div>
            </Card>
          ))}
        </div>
      </>
    )
  }

  return (
    <DashCard className="flex flex-col gap-3.5">
      <CardTitle title="Sales by channel" />
      {body()}
    </DashCard>
  )
}
