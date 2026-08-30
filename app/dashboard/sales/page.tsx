"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StatsCards } from "@/components/ui/stats-card"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Search, Download, ShoppingBag, DollarSign, Clock, MapPin, Eye, Printer } from "lucide-react"
import { sellsApi, type SellResponse } from "@/lib/sellsApi"
import { printSaleInvoice } from "@/lib/invoice-print"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { exportToCSV } from "@/lib/export-import-utils"
import { NewSaleModal } from "@/components/sales/new-sale-modal"
import { Plus } from "lucide-react"

const STATUS_STYLE: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Processing: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  Delivered: "bg-money-soft text-money-fg",
}

interface Stats {
  totalSells: number
  totalRevenue: number
  pendingOrders: number
  processingOrders: number
  deliveredOrders: number
}

function shippingLines(s: SellResponse): string[] {
  return [
    s.shippingFullName || s.customerName || "",
    [s.shippingAddressLine1, s.shippingAddressLine2].filter(Boolean).join(", "),
    [s.shippingCity, s.shippingState, s.shippingPostalCode].filter(Boolean).join(", "),
    s.shippingCountry || "",
    s.shippingPhone || "",
  ].filter(Boolean)
}

export default function SalesPage() {
  const { formatCurrency, settings } = useCompanySettings()

  const printInvoice = async (sale: SellResponse) => {
    let full = sale
    if (!sale.items?.length) {
      try { const res = await sellsApi.getById(sale.id); full = res.data } catch { /* use list row */ }
    }
    printSaleInvoice(full, { formatCurrency, taxId: settings?.taxId })
  }

  const [sales, setSales] = useState<SellResponse[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [selected, setSelected] = useState<SellResponse | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  const blocked = useModuleGuard("Orders")

  const fetchSales = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: perPage, source: "manual" }
      if (search) params.search = search
      if (statusFilter !== "all") params.status = statusFilter
      if (methodFilter !== "all") params.method = methodFilter
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      const res = await sellsApi.getAll(params)
      setSales(res.data ?? [])
      setTotal(res.total ?? res.data?.length ?? 0)
    } catch {
      setSales([])
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, statusFilter, methodFilter, startDate, endDate])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await sellsApi.getStats()
      const d = res.data as Record<string, number>
      setStats({
        totalSells: d.totalSells ?? d.total_sells ?? 0,
        totalRevenue: d.totalRevenue ?? d.total_revenue ?? 0,
        pendingOrders: d.pendingOrders ?? d.pending_count ?? 0,
        processingOrders: d.processingOrders ?? d.processing_count ?? 0,
        deliveredOrders: d.deliveredOrders ?? d.delivered_count ?? 0,
      })
    } catch {
      /* ignore */
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => { fetchSales() }, [fetchSales])
  useEffect(() => { fetchStats() }, [fetchStats])

  if (blocked) return blocked

  const resetFilters = () => {
    setSearch(""); setStatusFilter("all"); setMethodFilter("all"); setStartDate(""); setEndDate(""); setPage(1)
  }

  const openDetail = async (sale: SellResponse) => {
    setSelected(sale)
    // Fetch full record (items) if the list row is lightweight.
    if (!sale.items?.length) {
      try { const res = await sellsApi.getById(sale.id); setSelected(res.data) } catch { /* keep list row */ }
    }
  }

  const handleExport = () => {
    const rows = sales.map((s) => [
      s.invoiceNo,
      new Date(s.orderTime).toLocaleString(),
      s.customerName,
      s.method,
      s.status,
      shippingLines(s).join(" | "),
      String(s.amount),
    ])
    exportToCSV(rows, "sales", ["Invoice", "Date", "Customer", "Method", "Status", "Shipping Address", "Amount"])
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales</h1>
          <p className="text-sm text-muted-foreground">All completed sales, with customer and shipping details</p>
        </div>
        <Button className="bg-brand hover:brightness-110 text-brand-foreground gap-2" onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4" /> New Sale
        </Button>
      </div>

      {statsLoading || !stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <StatsCards stats={[
          { label: "Total Sales", value: stats.totalSells, icon: <ShoppingBag className="w-5 h-5 text-brand-fg" /> },
          { label: "Revenue", value: formatCurrency(stats.totalRevenue), icon: <DollarSign className="w-5 h-5 text-money-fg" /> },
          { label: "Pending", value: stats.pendingOrders, icon: <Clock className="w-5 h-5 text-amber-600" /> },
          { label: "Delivered", value: stats.deliveredOrders, icon: <ShoppingBag className="w-5 h-5 text-money-fg" /> },
        ]} />
      )}

      <Card className="p-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search invoice or customer…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Processing">Processing</SelectItem>
              <SelectItem value="Delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(1) }}>
            <SelectTrigger className="w-full lg:w-40"><SelectValue placeholder="Method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="Card">Card</SelectItem>
              <SelectItem value="Online">Online</SelectItem>
              <SelectItem value="COD">Cash on Delivery</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} className="gap-2"><Download className="w-4 h-4" /> Export</Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Start Date</label>
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">End Date</label>
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1) }} />
          </div>
          <Button variant="ghost" onClick={resetFilters}>Reset</Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-2.5 px-3">Invoice</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Shipping Address</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}><td colSpan={8} className="py-3 px-3"><Skeleton className="h-8 rounded" /></td></tr>
                ))
              ) : sales.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">No sales found for the selected filters.</td></tr>
              ) : (
                sales.map((s) => {
                  const addr = [s.shippingAddressLine1, s.shippingCity, s.shippingCountry].filter(Boolean).join(", ")
                  return (
                    <tr key={s.id} className="hover:bg-muted/40">
                      <td className="py-2.5 px-3 font-medium text-foreground whitespace-nowrap">#{s.invoiceNo}</td>
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{new Date(s.orderTime).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3">{s.customerName}</td>
                      <td className="py-2.5 px-3 max-w-[220px]">
                        {addr ? (
                          <span className="flex items-center gap-1 text-muted-foreground truncate">
                            <MapPin className="w-3.5 h-3.5 shrink-0" /> {s.shippingFullName ? `${s.shippingFullName} — ` : ""}{addr}
                          </span>
                        ) : <span className="text-muted-foreground/60">—</span>}
                      </td>
                      <td className="py-2.5 px-3 capitalize">{s.method}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-money-fg whitespace-nowrap">{formatCurrency(Number(s.amount))}</td>
                      <td className="py-2.5 px-3">
                        <Badge className={STATUS_STYLE[s.status] ?? "bg-muted text-foreground"}>{s.status}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => openDetail(s)}><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Print invoice" onClick={() => printInvoice(s)}><Printer className="w-4 h-4" /></Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && sales.length > 0 && (
          <PaginationControl
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(total / perPage))}
            itemsPerPage={perPage}
            totalItems={total}
            onPageChange={setPage}
            onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
          />
        )}
      </Card>

      {/* Detail */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Sale #{selected?.invoiceNo}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Date</p><p className="font-medium">{new Date(selected.orderTime).toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge className={STATUS_STYLE[selected.status] ?? ""}>{selected.status}</Badge></div>
                <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium">{selected.customerName}</p></div>
                <div><p className="text-xs text-muted-foreground">Payment</p><p className="font-medium capitalize">{selected.method}</p></div>
              </div>

              {/* Shipping address */}
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-brand-fg" /> Shipping Address
                </p>
                {shippingLines(selected).length ? (
                  <div className="text-sm text-foreground space-y-0.5">
                    {shippingLines(selected).map((l, i) => <p key={i}>{l}</p>)}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No shipping address on this sale.</p>}
              </div>

              {/* Items */}
              {selected.items && selected.items.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Price</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selected.items.map((it, i) => {
                        const price = (it as any).unit_price ?? (it as any).unitPrice ?? (it as any).price ?? 0
                        const qty = it.quantity ?? 1
                        return (
                          <tr key={i}>
                            <td className="py-2 px-3">{(it as any).productName ?? (it as any).product_name}</td>
                            <td className="py-2 px-3 text-center">{qty}</td>
                            <td className="py-2 px-3 text-right">{formatCurrency(Number(price))}</td>
                            <td className="py-2 px-3 text-right font-medium">{formatCurrency(Number(price) * qty)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-end justify-between">
                <Button variant="outline" className="gap-2" onClick={() => printInvoice(selected)}>
                  <Printer className="w-4 h-4" /> Print Invoice
                </Button>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-money-fg">{formatCurrency(Number(selected.amount))}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <NewSaleModal
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => { fetchSales(); fetchStats() }}
      />
    </div>
  )
}
