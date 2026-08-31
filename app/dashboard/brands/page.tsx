"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Edit2, Trash2, Tag } from "lucide-react"
import { brandApi, type BrandResponse } from "@/lib/brandApi"
import { useToast } from "@/hooks/use-toast"
import { useModuleGuard } from "@/hooks/use-module-guard"

export default function BrandsPage() {
  const { toast } = useToast()
  const [brands, setBrands] = useState<BrandResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BrandResponse | null>(null)
  const [form, setForm] = useState({ brandName: "", status: true })
  const [saving, setSaving] = useState(false)

  const blocked = useModuleGuard("Brands")

  const load = () => {
    setLoading(true)
    brandApi.getAll({ limit: 200 })
      .then((r) => setBrands(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  if (blocked) return blocked

  const openCreate = () => { setEditing(null); setForm({ brandName: "", status: true }); setDialogOpen(true) }
  const openEdit = (b: BrandResponse) => { setEditing(b); setForm({ brandName: b.brandName, status: b.status }); setDialogOpen(true) }

  const save = async () => {
    if (!form.brandName.trim()) { toast({ variant: "destructive", title: "Error", description: "Brand name is required" }); return }
    setSaving(true)
    try {
      if (editing) {
        await brandApi.update(editing.id, form)
        toast({ title: "Updated", description: "Brand updated" })
      } else {
        await brandApi.create(form)
        toast({ title: "Created", description: "Brand created" })
      }
      setDialogOpen(false)
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.response?.data?.message || "Failed to save brand" })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (b: BrandResponse) => {
    if (!confirm(`Delete brand "${b.brandName}"?`)) return
    try {
      await brandApi.delete(b.id)
      toast({ title: "Deleted", description: "Brand removed" })
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.response?.data?.message || "Failed to delete" })
    }
  }

  const filtered = brands.filter((b) => b.brandName.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Tag className="w-6 h-6 text-brand-fg" /> Brands</h1>
          <p className="text-sm text-muted-foreground">Product brands (Nike, Apple, Samsung…)</p>
        </div>
        <Button className="bg-brand hover:brightness-110 text-brand-foreground" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Brand
        </Button>
      </div>

      <Card className="p-4">
        <Input placeholder="Search brands…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm mb-4" />
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No brands yet. Add one to use it on products.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/40">
                    <td className="py-2.5 px-3 font-medium text-foreground">{b.brandName}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className={b.status ? "text-money-fg border-money/30" : "text-muted-foreground"}>
                        {b.status ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}><Edit2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(b)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Brand" : "Add Brand"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Brand Name *</Label>
              <Input value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} placeholder="e.g. Nike" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.status} onCheckedChange={(v) => setForm({ ...form, status: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-brand hover:brightness-110 text-brand-foreground" onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update Brand" : "Add Brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
