"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Plus, Trash2, UserPlus } from "lucide-react"
import { sellsApi } from "@/lib/sellsApi"
import { useProduct } from "@/contexts/product-context"
import { useCustomer } from "@/contexts/customer-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"

interface Row { productId: string; productName: string; quantity: number; price: number }

const emptyRow = (): Row => ({ productId: "", productName: "", quantity: 1, price: 0 })

export function NewSaleModal({ open, onOpenChange, onCreated }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
}) {
  const { products } = useProduct()
  const { customers, addCustomer } = useCustomer()
  const { taxRate, formatCurrency } = useCompanySettings()
  const { toast } = useToast()

  const [customerId, setCustomerId] = useState("")
  const [customerName, setCustomerName] = useState("Walk-in Customer")
  const [method, setMethod] = useState("Cash")
  const [status, setStatus] = useState<"Pending" | "Processing" | "Delivered">("Pending")
  const [discount, setDiscount] = useState("")
  const [ship, setShip] = useState({ name: "", phone: "", line1: "", city: "", state: "", zip: "", country: "" })
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [saving, setSaving] = useState(false)

  // Quick add-customer
  const [addCustOpen, setAddCustOpen] = useState(false)
  const [newCust, setNewCust] = useState({ name: "", phone: "", email: "" })
  const [addingCust, setAddingCust] = useState(false)

  const quickAddCustomer = async () => {
    if (!newCust.name.trim() || !newCust.phone.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Name and phone are required" })
      return
    }
    setAddingCust(true)
    try {
      await addCustomer({
        name: newCust.name.trim(),
        email: newCust.email.trim() || undefined, // email is optional; omit when blank
        phone: newCust.phone.trim(),
        address: "", city: "", state: "", zipCode: "", country: "",
        customerType: "retail", status: "active", notes: "", storeCredit: 0,
      } as any)
      // Newly added customer is refreshed into `customers`; select by name.
      setCustomerName(newCust.name.trim())
      const match = customers.find((c) => c.name === newCust.name.trim())
      if (match) setCustomerId(String(match.id))
      toast({ title: "Customer added", description: newCust.name })
      setNewCust({ name: "", phone: "", email: "" })
      setAddCustOpen(false)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err?.message || "Could not add customer" })
    } finally {
      setAddingCust(false)
    }
  }

  const subtotal = useMemo(() => rows.reduce((s, r) => s + r.price * r.quantity, 0), [rows])
  const discountNum = Number(discount) || 0
  const tax = (subtotal - discountNum) * (taxRate / 100)
  const total = Math.max(0, subtotal - discountNum + tax)

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const pickProduct = (i: number, pid: string) => {
    const p = products.find((x) => String(x.id) === pid)
    const price = p ? Number((p as any).salePrice ?? p.price ?? 0) : 0
    setRow(i, { productId: pid, productName: p?.name ?? "", price })
  }

  const reset = () => {
    setCustomerId(""); setCustomerName("Walk-in Customer"); setMethod("Cash"); setStatus("Pending")
    setDiscount(""); setShip({ name: "", phone: "", line1: "", city: "", state: "", zip: "", country: "" })
    setRows([emptyRow()])
  }

  const submit = async () => {
    const items = rows.filter((r) => r.productId && r.quantity > 0)
    if (items.length === 0) { toast({ variant: "destructive", title: "Error", description: "Add at least one product" }); return }
    setSaving(true)
    try {
      await sellsApi.create({
        customerId: customerId ? Number(customerId) : undefined,
        customerName: customerName || "Walk-in Customer",
        shippingFullName: ship.name || undefined,
        shippingPhone: ship.phone || undefined,
        shippingAddressLine1: ship.line1 || undefined,
        shippingCity: ship.city || undefined,
        shippingState: ship.state || undefined,
        shippingPostalCode: ship.zip || undefined,
        shippingCountry: ship.country || undefined,
        method,
        source: "manual",
        amount: total,
        discount: discountNum > 0 ? discountNum : undefined,
        status,
        items: items.map((r) => ({
          productId: Number(r.productId),
          productName: r.productName,
          quantity: r.quantity,
          price: r.price,
          unitPrice: r.price,
          unit_price: r.price,
        })),
      })
      toast({ title: "Sale created", description: `${formatCurrency(total)} · ${items.length} item(s)` })
      reset()
      onOpenChange(false)
      onCreated()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err?.response?.data?.message || "Could not create sale" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Sale</DialogTitle></DialogHeader>

        <div className="space-y-5 py-1">
          {/* Customer + payment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <div className="flex gap-2">
                <SearchableSelect
                  className="flex-1"
                  value={customerId || "walk-in"}
                  onChange={(v) => {
                    if (v === "walk-in") { setCustomerId(""); setCustomerName("Walk-in Customer") }
                    else { const c = customers.find((x) => String(x.id) === v); setCustomerId(v); setCustomerName(c?.name ?? "") }
                  }}
                  placeholder="Select customer"
                  searchPlaceholder="Search customer…"
                  options={[
                    { value: "walk-in", label: "Walk-in Customer" },
                    ...customers.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                />
                <Button type="button" variant="outline" size="icon" title="Add customer" onClick={() => setAddCustOpen(true)}>
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="COD">Cash on Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Processing">Processing</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Products</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setRows((p) => [...p, emptyRow()])}>
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_70px_100px_auto] gap-2 items-center">
                  <SearchableSelect
                    value={r.productId}
                    onChange={(v) => pickProduct(i, v)}
                    placeholder="Select product"
                    searchPlaceholder="Search product…"
                    options={products.map((p) => ({ value: String(p.id), label: p.name }))}
                  />
                  <Input type="number" min={1} value={r.quantity} onChange={(e) => setRow(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                  <Input type="number" min={0} step="0.01" value={r.price} onChange={(e) => setRow(i, { price: Number(e.target.value) || 0 })} />
                  <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} disabled={rows.length === 1}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping address */}
          <div>
            <Label className="mb-2 block">Shipping Address (optional)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="Full name" value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} />
              <Input placeholder="Phone" value={ship.phone} onChange={(e) => setShip({ ...ship, phone: e.target.value })} />
              <Input className="sm:col-span-2" placeholder="Street address" value={ship.line1} onChange={(e) => setShip({ ...ship, line1: e.target.value })} />
              <Input placeholder="City" value={ship.city} onChange={(e) => setShip({ ...ship, city: e.target.value })} />
              <Input placeholder="State" value={ship.state} onChange={(e) => setShip({ ...ship, state: e.target.value })} />
              <Input placeholder="Zip / Postal code" value={ship.zip} onChange={(e) => setShip({ ...ship, zip: e.target.value })} />
              <Input placeholder="Country" value={ship.country} onChange={(e) => setShip({ ...ship, country: e.target.value })} />
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-lg border border-border p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono text-foreground">{formatCurrency(subtotal)}</span></div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Discount</span>
              <Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" className="w-28 h-8 text-right" />
            </div>
            <div className="flex justify-between text-muted-foreground"><span>Tax ({taxRate}%)</span><span className="font-mono text-foreground">{formatCurrency(tax)}</span></div>
            <div className="flex justify-between pt-2 border-t border-border text-base font-semibold">
              <span>Total</span><span className="text-money-fg">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-brand hover:brightness-110 text-brand-foreground" onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create Sale"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Quick add-customer */}
      <Dialog open={addCustOpen} onOpenChange={setAddCustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} placeholder="john@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCustOpen(false)}>Cancel</Button>
            <Button className="bg-brand hover:brightness-110 text-brand-foreground" onClick={quickAddCustomer} disabled={addingCust}>
              {addingCust ? "Adding…" : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
