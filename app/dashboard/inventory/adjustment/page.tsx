"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useToast } from "@/hooks/use-toast"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { transferApi, type LocationProduct, type LocationProductRaw } from "@/lib/transferApi"
import { adjustmentApi, type AdjustmentType, type AdjustmentRow } from "@/lib/adjustmentApi"
import { Plus, Minus, Equal, ArrowUpDown } from "lucide-react"

// Flatten the per-location product list into selectable rows (product or variant),
// each carrying its current stock at that location.
function flatten(raw: LocationProductRaw[]): LocationProduct[] {
  const rows: LocationProduct[] = []
  for (const product of raw) {
    if (product.variants && product.variants.length > 0) {
      for (const v of product.variants) {
        rows.push({ type: "variant", id: v.id, productId: product.id, productName: product.name, variantName: v.name, sku: v.sku, stock: v.stock })
      }
    } else {
      rows.push({ type: "product", id: product.id, productId: product.id, productName: product.name, sku: product.sku, stock: product.stock })
    }
  }
  return rows
}

const TYPES: { value: AdjustmentType; label: string; icon: any }[] = [
  { value: "increase", label: "Increase", icon: Plus },
  { value: "decrease", label: "Decrease", icon: Minus },
  { value: "set", label: "Set to", icon: Equal },
]

export default function StockAdjustmentPage() {
  const { toast } = useToast()
  const { warehouses } = useWarehouse()

  const [warehouse, setWarehouse] = useState("")
  const [rawProducts, setRawProducts] = useState<LocationProductRaw[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [rowKey, setRowKey] = useState("")
  const [type, setType] = useState<AdjustmentType>("increase")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [history, setHistory] = useState<AdjustmentRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const blocked = useModuleGuard("Inventory")

  const rows = flatten(rawProducts)
  const selected = rows.find((r) => `${r.type}-${r.id}` === rowKey)

  const loadHistory = () => {
    setHistoryLoading(true)
    adjustmentApi.getAll()
      .then((res) => setHistory(res.data ?? []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => { loadHistory() }, [])

  // Load products (with current stock) when a warehouse is picked.
  useEffect(() => {
    if (!warehouse) { setRawProducts([]); return }
    setProductsLoading(true)
    setRowKey("")
    transferApi.getProductsByLocation(Number(warehouse))
      .then((res) => setRawProducts(res.data ?? []))
      .catch(() => toast({ variant: "destructive", title: "Error", description: "Failed to load products" }))
      .finally(() => setProductsLoading(false))
  }, [warehouse]) // eslint-disable-line

  if (blocked) return blocked

  const currentStock = selected?.stock ?? 0
  const qtyNum = Number(quantity) || 0
  const projected =
    type === "increase" ? currentStock + qtyNum
    : type === "decrease" ? currentStock - qtyNum
    : qtyNum

  const canSubmit =
    warehouse && selected && reason.trim() &&
    (type === "set" ? qtyNum >= 0 : qtyNum >= 1) &&
    !(type === "decrease" && qtyNum > currentStock)

  const submit = async () => {
    if (!selected || !warehouse) return
    setSubmitting(true)
    try {
      const res = await adjustmentApi.create({
        productId: selected.productId,
        variantId: selected.type === "variant" ? selected.id : null,
        locationId: Number(warehouse),
        type,
        quantity: qtyNum,
        reason: reason.trim(),
      })
      toast({ title: "Stock adjusted", description: `${res.data.productName}: ${res.data.before} → ${res.data.after}` })
      // Refresh product stock + history; reset the form fields.
      transferApi.getProductsByLocation(Number(warehouse)).then((r) => setRawProducts(r.data ?? [])).catch(() => {})
      loadHistory()
      setQuantity(""); setReason("")
    } catch (err: any) {
      toast({ variant: "destructive", title: "Adjustment failed", description: err?.response?.data?.message || "Please try again" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowUpDown className="w-6 h-6 text-brand-fg" /> Stock Adjustment
        </h1>
        <p className="text-sm text-muted-foreground">Manually correct on-hand stock, with a reason and audit trail</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>New Adjustment</CardTitle>
            <CardDescription>Pick a warehouse and product, then adjust its stock</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Warehouse</Label>
              <Select value={warehouse} onValueChange={setWarehouse}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Product / Variant</Label>
              <Select value={rowKey} onValueChange={setRowKey} disabled={!warehouse || productsLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={!warehouse ? "Select warehouse first" : productsLoading ? "Loading..." : rows.length ? "Select product" : "No products here"} />
                </SelectTrigger>
                <SelectContent>
                  {rows.map((r) => (
                    <SelectItem key={`${r.type}-${r.id}`} value={`${r.type}-${r.id}`}>
                      {r.productName}{r.variantName ? ` — ${r.variantName}` : ""} · stock {r.stock}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selected && (
                <p className="text-xs text-muted-foreground">Current stock at this warehouse: <b className="text-foreground">{currentStock}</b></p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Adjustment Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      type === value ? "border-brand bg-brand-soft text-brand-fg font-medium" : "border-border hover:bg-accent"
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{type === "set" ? "Set stock to" : "Quantity"}</Label>
              <Input type="number" min={type === "set" ? 0 : 1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
              {selected && qtyNum > 0 && (
                <p className="text-xs text-muted-foreground">
                  New stock: <b className={projected < 0 ? "text-destructive" : "text-foreground"}>{projected}</b>
                  {type === "decrease" && qtyNum > currentStock && <span className="text-destructive"> — exceeds current stock</span>}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Stock count correction, damaged goods, received shipment…" rows={2} />
            </div>

            <Button className="w-full bg-brand hover:brightness-110 text-brand-foreground" disabled={!canSubmit || submitting} onClick={submit}>
              {submitting ? "Adjusting…" : "Apply Adjustment"}
            </Button>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Adjustments</CardTitle>
            <CardDescription>Audit trail of stock changes</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No adjustments yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between py-2.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {h.productName}{h.variantName ? ` — ${h.variantName}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {h.locationName} · {h.notes}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-sm font-semibold ${h.quantity >= 0 ? "text-money-fg" : "text-destructive"}`}>
                        {h.quantity >= 0 ? "+" : ""}{h.quantity}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
