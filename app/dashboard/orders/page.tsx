"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Printer, Eye, Download, Mail, ShoppingBag, Trash2, Package, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusBadge } from "@/components/ui/status-badge"
import { StatsCards } from "@/components/ui/stats-card"
import { sellsApi, SellResponse, SellItem } from "@/lib/sellsApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"

const fmt = (val: unknown) => Number(val ?? 0).toFixed(2)
const itemPrice = (item: SellItem) => item.unit_price ?? item.unitPrice ?? item.price ?? 0
const itemTotal = (item: SellItem) => item.total_price ?? item.totalPrice ?? (itemPrice(item) * item.quantity)

interface StatsData {
  totalSells: number
  totalRevenue: number
  pendingOrders: number
  processingOrders: number
  deliveredOrders: number
}

// Seller identity printed at the top of every invoice. Company settings only
// carry tax/currency, so name/address/contact live here until the backend
// exposes them.
const SELLER = {
  name: "Admin",
  addressLines: ["59 Station Rd, Purls Bridge", "United Kingdom"],
  phone: "019 579 034",
  email: "",
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

/** Spells a whole number below one billion, e.g. 1280 -> "one thousand two hundred eighty". */
function spell(n: number): string {
  if (n === 0) return "zero"
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "")
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + spell(n % 100) : "")
  for (const [limit, word] of [[1e9, "million"], [1e6, "thousand"]] as const) {
    const unit = limit === 1e9 ? 1e6 : 1e3
    if (n < limit) return spell(Math.floor(n / unit)) + " " + word + (n % unit ? " " + spell(n % unit) : "")
  }
  return String(n)
}

/** "Two hundred eighty and 00/100" — the legal amount line on the total plate. */
function amountInWords(amount: number): string {
  const whole = Math.floor(Math.abs(amount))
  const cents = Math.round((Math.abs(amount) - whole) * 100)
  const words = spell(whole)
  return words.charAt(0).toUpperCase() + words.slice(1) + ` and ${String(cents).padStart(2, "0")}/100`
}

export default function OrdersPage() {
  const { canRead } = useSaasAuth()
  const searchParams = useSearchParams()
  const { formatCurrency, settings } = useCompanySettings()
  const latestFetchIdRef = useRef(0)
  const [orders, setOrders] = useState<SellResponse[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<SellResponse | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    const customerParam = searchParams.get("customer")
    if (customerParam) {
      setSearchQuery(customerParam)
      setCurrentPage(1)
      return
    }

    setSearchQuery("")
  }, [searchParams])

  const fetchOrders = useCallback(async () => {
    const fetchId = ++latestFetchIdRef.current
    setIsLoading(true)
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: itemsPerPage,
      }
      if (searchQuery) params.search = searchQuery
      if (statusFilter !== "all") params.status = statusFilter
      if (methodFilter !== "all") params.method = methodFilter
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate

      const res = await sellsApi.getAll(params)
      if (fetchId !== latestFetchIdRef.current) {
        return
      }
      setOrders(res.data ?? [])
      setTotal(res.total ?? res.data?.length ?? 0)
    } catch (err) {
      if (fetchId !== latestFetchIdRef.current) {
        return
      }
      console.error("Failed to fetch orders:", err)
      setOrders([])
    } finally {
      if (fetchId === latestFetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [currentPage, itemsPerPage, searchQuery, statusFilter, methodFilter, startDate, endDate])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await sellsApi.getStats()
      const d = res.data as Record<string, number>
      setStats({
        totalSells:        d.totalSells        ?? d.total_sells        ?? 0,
        totalRevenue:      d.totalRevenue      ?? d.total_revenue      ?? 0,
        pendingOrders:     d.pendingOrders     ?? d.pending_count      ?? 0,
        processingOrders:  d.processingOrders  ?? d.processing_count   ?? 0,
        deliveredOrders:   d.deliveredOrders   ?? d.delivered_count    ?? 0,
      })
    } catch (err) {
      console.error("Failed to fetch stats:", err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    fetchStats()
  }, [fetchOrders, fetchStats])

  const blocked = useModuleGuard('Orders')
  if (blocked) return blocked

  const handleStatusChange = async (id: number, newStatus: SellResponse["status"]) => {
    setUpdatingStatus(id)
    try {
      await sellsApi.updateStatus(id, newStatus)
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o)))
      if (selectedOrder?.id === id) setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : prev)
    } catch (err) {
      console.error("Failed to update status:", err)
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this order?")) return
    setDeletingId(id)
    try {
      await sellsApi.delete(id)
      setOrders((prev) => prev.filter((o) => o.id !== id))
      setTotal((prev) => prev - 1)
      if (selectedOrder?.id === id) setIsDetailsOpen(false)
    } catch (err) {
      console.error("Failed to delete order:", err)
    } finally {
      setDeletingId(null)
    }
  }

  const fetchFullOrder = async (id: number): Promise<SellResponse | null> => {
    try {
      const res = await sellsApi.getById(id)
      // Backend may return { data: order } or the order directly
      return (res.data ?? res) as SellResponse
    } catch (err) {
      console.error("Failed to fetch order details:", err)
      return null
    }
  }

  const handleViewDetails = async (order: SellResponse) => {
    setSelectedOrder(order)
    setIsDetailsOpen(true)
    const full = await fetchFullOrder(order.id)
    if (full) setSelectedOrder(full)
  }

  const handlePrintFromTable = async (order: SellResponse) => {
    // If items already loaded (from list response), print immediately
    if (order.items?.length) {
      handlePrintInvoice(order)
      return
    }
    // Otherwise fetch full order first
    const full = await fetchFullOrder(order.id)
    handlePrintInvoice(full ?? order)
  }

  const handleReset = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setMethodFilter("all")
    setStartDate("")
    setEndDate("")
    setCurrentPage(1)
  }

  const handleDownloadAllOrders = () => {
    const csvContent = [
      ["Invoice No", "Order Time", "Customer Name", "Method", "Amount", "Status"],
      ...orders.map((o) => [
        o.invoiceNo,
        o.orderTime,
        o.customerName,
        o.method,
        fmt(o.amount),
        o.status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "orders.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handlePrintInvoice = (order: SellResponse) => {
    const esc = (v: unknown) =>
      String(v ?? "").replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))

    const money = (n: number) => formatCurrency(n)

    // ---- figures -------------------------------------------------------
    const shippingCost = Number(fmt(order.shippingCost))
    const discount = Number(fmt(order.discount))
    const total = Number(order.amount)
    const subtotal = total - shippingCost + discount
    const deposit = Number(order.shippingDepositAmount ?? 0)

    // Split the total so the plate can set the cents smaller, like a cheque.
    const totalWhole = Math.floor(Math.abs(total))
    const totalCents = String(Math.round((Math.abs(total) - totalWhole) * 100)).padStart(2, "0")
    // Currency symbol = whatever formatCurrency puts before the first digit.
    const currencySymbol = money(0).replace(/[\d.,\s]/g, "") || "$"

    // ---- payment state -------------------------------------------------
    const ps = order.paymentStatus ?? ""
    const paid = ps === "paid"
    const payment =
      paid ? { label: "Paid", note: "Settled in full" }
      : ps === "shipping_deposit_paid" ? { label: "Deposit", note: "Shipping deposit received" }
      : ps === "failed" || ps === "cancelled" ? { label: ps, note: "Payment unsuccessful" }
      : ps === "pending_payment" ? { label: "Pending", note: "Awaiting payment" }
      : ps ? { label: ps, note: "" }
      : null

    const issued = new Date(order.orderTime)
    const issuedDate = issued.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    const issuedTime = issued.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    const stampDate = [issued.getDate(), issued.getMonth() + 1, issued.getFullYear()]
      .map((n, i) => (i < 2 ? String(n).padStart(2, "0") : String(n)))
      .join(" &middot; ")

    // ---- billed-to -----------------------------------------------------
    const buyerName = order.shippingFullName || order.customerName || "Walk-in Customer"
    const buyerLines = [
      order.shippingAddressLine1
        ? esc(order.shippingAddressLine1) + (order.shippingAddressLine2 ? ", " + esc(order.shippingAddressLine2) : "")
        : "",
      esc([order.shippingCity, order.shippingState, order.shippingPostalCode].filter(Boolean).join(", ")),
      esc(order.shippingCountry ?? ""),
      esc(order.shippingEmail ?? ""),
      esc(order.shippingPhone ?? ""),
    ].filter(Boolean)
    const buyerSub = buyerLines.length ? buyerLines.join("<br />") : "Point of sale"

    // ---- line items (table rows) --------------------------------------
    const itemsRows = order.items?.length
      ? order.items.map((item, i) => {
          const children = item.bundleItems?.length
            ? item.bundleItems.map(bi => `
              <tr class="sub">
                <td></td>
                <td class="desc"><span class="branch">&#8627;</span>${esc(bi.productName)}</td>
                <td class="num mono">${bi.qtyPerBundle}&times;${item.quantity}</td>
                <td class="num mono">&mdash;</td>
                <td class="num mono">&mdash;</td>
              </tr>`).join("")
            : ""
          return `
            <tr>
              <td class="num mono">${String(i + 1).padStart(2, "0")}</td>
              <td class="desc">${esc(item.productName)}${item.bundleItems?.length ? '<span class="tag">Bundle</span>' : ""}</td>
              <td class="num mono">${item.quantity}</td>
              <td class="num mono">${money(itemPrice(item))}</td>
              <td class="num mono strong">${money(itemTotal(item))}</td>
            </tr>${children}`
        }).join("")
      : `
        <tr>
          <td class="num mono">01</td>
          <td class="desc">${esc(order.customerName)}</td>
          <td class="num mono">1</td>
          <td class="num mono">${money(total)}</td>
          <td class="num mono strong">${money(total)}</td>
        </tr>`

    const sumRow = (label: string, value: string, cls = "") => `
      <div class="sum-row ${cls}"><span>${label}</span><b class="mono">${value}</b></div>`

    const summaryHtml = `
      ${sumRow("Subtotal", money(subtotal))}
      ${sumRow("Shipping", money(shippingCost))}
      ${discount > 0 ? sumRow("Discount", "-" + money(discount)) : ""}
      ${deposit > 0 ? sumRow("Deposit paid", money(deposit)) : ""}
      <div class="sum-total"><span>Total</span><b class="mono">${money(total)}</b></div>
      ${deposit > 0 && order.paymentStatus === "shipping_deposit_paid"
        ? `<div class="sum-note">Remaining on delivery: ${money(total - deposit)}</div>` : ""}`

    // One invoice copy. Rendered twice (customer + merchant) on a single A4.
    const copy = (label: string) => `
      <section class="copy">
        <div class="copy-tag">${label}</div>

        <header class="head">
          <div class="issuer">
            <div class="mark">${esc(SELLER.name.charAt(0).toUpperCase())}</div>
            <div>
              <div class="name">${esc(SELLER.name)}</div>
              <div class="sub">
                ${SELLER.addressLines.map(l => esc(l)).join(" &middot; ")}
                &middot; ${esc(SELLER.phone)}${settings?.taxId ? " &middot; Tax ID " + esc(settings.taxId) : ""}
              </div>
            </div>
          </div>
          <div class="doc">
            <div class="doc-word">INVOICE</div>
            <div class="doc-no mono">#${esc(order.invoiceNo)}</div>
          </div>
        </header>

        <div class="meta">
          <div class="meta-cell">
            <span class="lbl">Bill to</span>
            <span class="val">${esc(buyerName)}</span>
            <span class="sub2">${buyerSub}</span>
          </div>
          <div class="meta-cell">
            <span class="lbl">Date</span>
            <span class="val">${esc(issuedDate)}</span>
            <span class="sub2 mono">${esc(issuedTime)}</span>
          </div>
          <div class="meta-cell">
            <span class="lbl">Payment</span>
            <span class="val">${esc(order.method)}${payment ? ` &mdash; <span class="pay ${paid ? "ok" : "warn"}">${esc(payment.label)}</span>` : ""}</span>
            ${order.paymentTransactionId ? `<span class="sub2 mono txn">Txn ${esc(order.paymentTransactionId)}</span>` : ""}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="num" style="width:32px">#</th>
              <th>Description</th>
              <th class="num" style="width:48px">Qty</th>
              <th class="num" style="width:82px">Unit</th>
              <th class="num" style="width:90px">Amount</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>

        <div class="foot">
          <div class="terms">
            <span class="lbl">Notes</span>
            Goods once sold are subject to the return policy. Thank you for your business.
          </div>
          <div class="summary">${summaryHtml}</div>
        </div>
      </section>`

    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Invoice ${esc(order.invoiceNo)} &mdash; ${esc(SELLER.name)}</title>
<style>
  :root{
    --ink:#111827; --muted:#6b7280; --faint:#9ca3af; --line:#e5e7eb; --line-2:#d1d5db;
    --accent:#0f766e; --accent-soft:#ccfbf1; --ok:#047857; --ok-soft:#d1fae5;
    --warn:#b45309; --warn-soft:#fef3c7;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);
    font-size:12px;line-height:1.45;background:#f3f4f6;padding:16px}
  .mono{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}

  /* Page = two copies stacked, cut line between */
  .page{max-width:760px;margin:0 auto;background:#fff}
  .cut{display:flex;align-items:center;gap:10px;color:var(--faint);font-size:10px;
    letter-spacing:.14em;text-transform:uppercase;padding:6px 22px}
  .cut::before,.cut::after{content:"";flex:1;border-top:1.4px dashed var(--line-2)}
  .cut svg{width:14px;height:14px}

  .copy{position:relative;padding:26px 30px 22px}
  .copy-tag{position:absolute;top:20px;right:30px;font-size:9.5px;font-weight:700;
    letter-spacing:.14em;text-transform:uppercase;color:var(--accent);
    background:var(--accent-soft);padding:3px 9px;border-radius:99px}

  /* head */
  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;
    padding-bottom:14px;border-bottom:2px solid var(--ink)}
  .issuer{display:flex;gap:11px;align-items:center}
  .mark{width:34px;height:34px;border-radius:8px;background:var(--accent);color:#fff;flex:none;
    display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700}
  .name{font-size:14px;font-weight:700;letter-spacing:-.01em}
  .sub{font-size:10.5px;color:var(--muted);margin-top:2px;max-width:360px}
  .doc{text-align:right;padding-right:78px}
  .doc-word{font-size:20px;font-weight:800;letter-spacing:.08em}
  .doc-no{font-size:11px;color:var(--muted);margin-top:2px}

  /* meta */
  .meta{display:grid;grid-template-columns:1.5fr 1fr 1.2fr;gap:16px;padding:12px 0 14px;
    border-bottom:1px solid var(--line)}
  .meta-cell{display:flex;flex-direction:column;min-width:0}
  .meta-cell .lbl{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-bottom:3px}
  .meta-cell .val{font-size:12.5px;font-weight:600}
  .meta-cell .sub2{font-size:10.5px;color:var(--muted);margin-top:1px;line-height:1.5}
  .txn{word-break:break-all}
  .pay{font-size:10px;font-weight:700;padding:1px 7px;border-radius:99px}
  .pay.ok{background:var(--ok-soft);color:var(--ok)}
  .pay.warn{background:var(--warn-soft);color:var(--warn)}

  /* items */
  table{width:100%;border-collapse:collapse;margin-top:2px}
  th{text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
    color:var(--muted);padding:8px 8px;border-bottom:1px solid var(--line)}
  th.num{text-align:right}
  td{padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;vertical-align:top}
  td.num{text-align:right}
  td.desc{font-weight:500}
  td.strong{font-weight:700}
  .tag{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:3px;
    background:var(--accent-soft);color:var(--accent);font-size:9px;font-weight:700;
    letter-spacing:.06em;text-transform:uppercase}
  .sub td{padding:4px 8px;border-bottom:1px solid #fafafa}
  .sub .desc{font-weight:400;color:var(--muted);font-size:11px}
  .branch{color:var(--faint);margin-right:5px}

  /* foot: notes + summary */
  .foot{display:flex;justify-content:space-between;gap:28px;margin-top:14px}
  .terms{flex:1;font-size:10.5px;color:var(--muted);max-width:320px}
  .terms .lbl{display:block;font-size:9px;font-weight:700;letter-spacing:.1em;
    text-transform:uppercase;color:var(--faint);margin-bottom:4px}
  .summary{width:230px}
  .sum-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:var(--muted)}
  .sum-row b{color:var(--ink);font-weight:500}
  .sum-total{display:flex;justify-content:space-between;align-items:baseline;
    margin-top:6px;padding-top:9px;border-top:2px solid var(--ink)}
  .sum-total span{font-size:13px;font-weight:700}
  .sum-total b{font-size:18px;font-weight:800;letter-spacing:-.02em}
  .sum-note{margin-top:5px;font-size:10px;color:var(--warn);text-align:right}

  @page{size:A4;margin:10mm}
  @media print{
    body{background:#fff;padding:0}
    .page{max-width:none}
    .copy{page-break-inside:avoid}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style>
</head>
<body>
  <div class="page">
    ${copy("Customer Copy")}
    <div class="cut" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none"><path d="M8 8 4 12l4 4M16 8l4 4-4 4M6 3l12 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Cut here
    </div>
    ${copy("Merchant Copy")}
  </div>
</body>
</html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.setTimeout(() => printWindow.print(), 300)
  }

  const handleEmailInvoice = (order: SellResponse) => {
    alert(`Email invoice #${order.invoiceNo} functionality would be implemented here`)
  }

  const totalPages = Math.ceil(total / itemsPerPage)

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : stats ? (
        <StatsCards
          stats={[
            { label: "Total", value: stats.totalSells, icon: <ShoppingBag className="w-5 h-5" />, color: "blue" },
            { label: "Pending", value: stats.pendingOrders, icon: <Clock className="w-5 h-5" />, color: "yellow" },
            { label: "Processing", value: stats.processingOrders, icon: <Package className="w-5 h-5" />, color: "purple" },
            { label: "Delivered", value: stats.deliveredOrders, icon: <CheckCircle className="w-5 h-5" />, color: "green" },
            { label: "Revenue", value: formatCurrency(stats.totalRevenue), icon: <AlertCircle className="w-5 h-5" />, color: "blue" },
          ]}
        />
      ) : null}

      <Card className="p-6">
        <div className="space-y-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search by Customer Name"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
                <SelectItem value="Processing">Processing</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="Online">Online</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleDownloadAllOrders} className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap">
              <Download className="w-4 h-4 mr-2" />
              Download All Orders
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1) }} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1) }} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={fetchOrders} className="bg-emerald-600 hover:bg-emerald-700">Filter</Button>
              <Button onClick={handleReset} variant="outline">Reset</Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Invoice No</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Order Time</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Customer Name</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Method</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Amount</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-12" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-8 w-32" /></td>
                    <td className="py-3 px-4"><div className="flex gap-2"><Skeleton className="h-8 w-8 rounded" /><Skeleton className="h-8 w-8 rounded" /></div></td>
                  </tr>
                ))
                : orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-gray-900">#{order.invoiceNo}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(order.orderTime).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{order.customerName}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{order.method}</td>
                    <td className="py-3 px-4 text-sm font-semibold text-gray-900">{formatCurrency(Number(order.amount ?? 0))}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4">
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusChange(order.id, value as SellResponse["status"])}
                        disabled={updatingStatus === order.id}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Delivered">Delivered</SelectItem>
                          <SelectItem value="Processing">Processing</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handlePrintFromTable(order)} className="p-2 h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600" title="Print">
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(order)} className="p-2 h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600" title="View">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(order.id)}
                          disabled={deletingId === order.id}
                          className="p-2 h-8 w-8 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!isLoading && orders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No orders found</p>
          </div>
        )}
      </Card>

      <PaginationControl
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={total}
      />

      {/* Order Detail Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Invoice</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-8 py-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <h1 className="text-4xl font-bold mb-3">INVOICE</h1>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-700">STATUS</span>
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end mb-2">
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-emerald-600">Admin</span>
                  </div>
                  <p className="text-sm text-gray-600">59 Station Rd, Purls Bridge, United Kingdom</p>
                  <p className="text-sm text-gray-600">019579034</p>
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Date</h3>
                  <p className="text-sm text-gray-900">{new Date(selectedOrder.orderTime).toLocaleDateString()}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Invoice No</h3>
                  <p className="text-sm text-gray-900">#{selectedOrder.invoiceNo}</p>
                </div>
                <div className="sm:text-right">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                    {selectedOrder.shippingFullName ? "Ship To" : "Invoice To"}
                  </h3>
                  {selectedOrder.shippingFullName ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900">{selectedOrder.shippingFullName}</p>
                      {selectedOrder.shippingEmail && <p className="text-xs text-gray-600">{selectedOrder.shippingEmail}</p>}
                      {selectedOrder.shippingPhone && <p className="text-xs text-gray-600">{selectedOrder.shippingPhone}</p>}
                      {selectedOrder.shippingAddressLine1 && <p className="text-xs text-gray-600">{selectedOrder.shippingAddressLine1}{selectedOrder.shippingAddressLine2 ? `, ${selectedOrder.shippingAddressLine2}` : ""}</p>}
                      <p className="text-xs text-gray-600">{[selectedOrder.shippingCity, selectedOrder.shippingState, selectedOrder.shippingPostalCode].filter(Boolean).join(", ")}</p>
                      {selectedOrder.shippingCountry && <p className="text-xs text-gray-600">{selectedOrder.shippingCountry}</p>}
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-gray-900">{selectedOrder.customerName}</p>
                      {(selectedOrder.shippingEmail) && <p className="text-xs text-gray-600">{selectedOrder.shippingEmail}</p>}
                      {(selectedOrder.shippingPhone) && <p className="text-xs text-gray-600">{selectedOrder.shippingPhone}</p>}
                    </>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-900 uppercase">SR.</th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-900 uppercase">Product Title</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-900 uppercase">Quantity</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-900 uppercase">Item Price</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-900 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.length ? (
                      selectedOrder.items.map((item, i) => (
                        <React.Fragment key={item.id ?? i}>
                          <tr className="border-t">
                            <td className="py-5 px-4 text-sm text-gray-900">{i + 1}</td>
                            <td className="py-5 px-4 text-sm text-gray-900">
                              {item.productName}
                              {item.bundleItems && item.bundleItems.length > 0 && (
                                <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">Bundle</span>
                              )}
                            </td>
                            <td className="py-5 px-4 text-sm text-center text-gray-900">{item.quantity}</td>
                            <td className="py-5 px-4 text-sm text-right text-gray-900">{formatCurrency(itemPrice(item))}</td>
                            <td className="py-5 px-4 text-sm text-right font-semibold text-red-600">{formatCurrency(itemTotal(item))}</td>
                          </tr>
                          {item.bundleItems && item.bundleItems.length > 0 && item.bundleItems.map((bi, j) => (
                            <tr key={`${item.id}-bi-${j}`} className="bg-gray-50">
                              <td className="py-2 px-4"></td>
                              <td className="py-2 px-4 text-xs text-gray-500 pl-8">↳ {bi.productName}</td>
                              <td className="py-2 px-4 text-xs text-center text-gray-500">{bi.totalQty}</td>
                              <td className="py-2 px-4 text-xs text-right text-gray-400">{bi.qtyPerBundle}×{item.quantity}</td>
                              <td className="py-2 px-4"></td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr className="border-t">
                        <td colSpan={5} className="py-8 text-center text-sm text-gray-500">No items available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Payment Method</h3>
                    <p className="text-base font-semibold text-gray-900">{selectedOrder.method}</p>
                    {/* Payment status badge */}
                    {selectedOrder.paymentStatus && (() => {
                      const ps = selectedOrder.paymentStatus
                      const isPaid = ps === "paid"
                      const isDeposit = ps === "shipping_deposit_paid"
                      return (
                        <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isPaid ? "bg-green-100 text-green-700"
                          : isDeposit ? "bg-amber-100 text-amber-700"
                          : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {isPaid ? "✓ Paid" : isDeposit ? "⏳ Deposit Paid" : ps === "pending_payment" ? "⏳ Awaiting Payment" : ps === "failed" ? "✗ Failed" : ps === "cancelled" ? "✗ Cancelled" : "⏳ Pending"}
                        </span>
                      )
                    })()}
                    {selectedOrder.paymentTransactionId && (
                      <p className="text-[10px] text-gray-500 font-mono mt-1 break-all">Txn: {selectedOrder.paymentTransactionId}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Shipping Cost</h3>
                    <p className="text-base font-semibold text-gray-600">{formatCurrency(Number(selectedOrder.shippingCost ?? 0))}</p>
                    {/* Shipping deposit — only when > 0 */}
                    {selectedOrder.shippingDepositAmount != null && Number(selectedOrder.shippingDepositAmount) > 0 && (
                      <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-[10px] font-semibold text-amber-700 uppercase">Shipping Deposit Paid</p>
                        <p className="text-sm font-bold text-amber-700">{formatCurrency(Number(selectedOrder.shippingDepositAmount))}</p>
                        {selectedOrder.shippingDepositTransactionId && (
                          <p className="text-[10px] font-mono text-amber-600 break-all mt-0.5">Txn: {selectedOrder.shippingDepositTransactionId}</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Discount</h3>
                    <p className="text-base font-semibold text-gray-600">{formatCurrency(Number(selectedOrder.discount ?? 0))}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Total Amount</h3>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(Number(selectedOrder.amount ?? 0))}</p>
                    {selectedOrder.shippingDepositAmount != null && Number(selectedOrder.shippingDepositAmount) > 0 && selectedOrder.paymentStatus === "shipping_deposit_paid" && (
                      <p className="text-xs text-gray-500 mt-1">Remaining on delivery: {formatCurrency(Number(selectedOrder.amount ?? 0) - Number(selectedOrder.shippingDepositAmount))}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Update Status */}
              <div className="border rounded-lg p-6 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 uppercase">Update Status</h3>
                <Select
                  value={selectedOrder.status}
                  onValueChange={(value) => handleStatusChange(selectedOrder.id, value as SellResponse["status"])}
                  disabled={updatingStatus === selectedOrder.id}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                    <SelectItem value="Processing">Processing</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Order Notes */}
              <div className="border rounded-lg p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase">Order Note</h3>
                <Input
                  placeholder="Add a note to this order..."
                  defaultValue={selectedOrder.notes || ""}
                  onBlur={async (e) => {
                    const notes = e.target.value
                    if (notes !== selectedOrder.notes) {
                      try {
                        await sellsApi.update(selectedOrder.id, { notes })
                        setOrders((prev) => prev.map((o) => o.id === selectedOrder.id ? { ...o, notes } : o))
                        setSelectedOrder((prev) => prev ? { ...prev, notes } : prev)
                      } catch (err) {
                        console.error("Failed to save note:", err)
                      }
                    }
                  }}
                  className="flex-1"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={() => handlePrintInvoice(selectedOrder)} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  Download Invoice
                </Button>
                <Button onClick={() => handleEmailInvoice(selectedOrder)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Invoice
                </Button>
                <Button onClick={() => handlePrintInvoice(selectedOrder)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Invoice
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
