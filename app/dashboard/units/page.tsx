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
import { Plus, Edit2, Trash2, Ruler } from "lucide-react"
import { unitApi, type UnitResponse } from "@/lib/unitApi"
import { useToast } from "@/hooks/use-toast"
import { useModuleGuard } from "@/hooks/use-module-guard"

export default function UnitsPage() {
  const { toast } = useToast()
  const [units, setUnits] = useState<UnitResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<UnitResponse | null>(null)
  const [form, setForm] = useState({ unitName: "", symbol: "", status: true })
  const [saving, setSaving] = useState(false)

  const blocked = useModuleGuard("Units")

  const load = () => {
    setLoading(true)
    unitApi.getAll({ limit: 200 })
      .then((r) => setUnits(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  if (blocked) return blocked

  const openCreate = () => { setEditing(null); setForm({ unitName: "", symbol: "", status: true }); setDialogOpen(true) }
  const openEdit = (u: UnitResponse) => { setEditing(u); setForm({ unitName: u.unitName, symbol: u.symbol ?? "", status: u.status }); setDialogOpen(true) }

  const save = async () => {
    if (!form.unitName.trim()) { toast({ variant: "destructive", title: "Error", description: "Unit name is required" }); return }
    setSaving(true)
    try {
      if (editing) {
        await unitApi.update(editing.id, form)
        toast({ title: "Updated", description: "Unit updated" })
      } else {
        await unitApi.create(form)
        toast({ title: "Created", description: "Unit created" })
      }
      setDialogOpen(false)
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.response?.data?.message || "Failed to save unit" })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (u: UnitResponse) => {
    if (!confirm(`Delete unit "${u.unitName}"?`)) return
    try {
      await unitApi.delete(u.id)
      toast({ title: "Deleted", description: "Unit removed" })
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.response?.data?.message || "Failed to delete" })
    }
  }

  const filtered = units.filter((u) => u.unitName.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Ruler className="w-6 h-6 text-brand-fg" /> Units</h1>
          <p className="text-sm text-muted-foreground">Units of measurement used by products (pcs, kg, litre…)</p>
        </div>
        <Button className="bg-brand hover:brightness-110 text-brand-foreground" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Unit
        </Button>
      </div>

      <Card className="p-4">
        <Input placeholder="Search units…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm mb-4" />
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No units yet. Add one to use it on products.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40">
                    <td className="py-2.5 px-3 font-medium text-foreground">{u.unitName}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{u.symbol || "—"}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className={u.status ? "text-money-fg border-money/30" : "text-muted-foreground"}>
                        {u.status ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}><Edit2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(u)}><Trash2 className="w-4 h-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Unit" : "Add Unit"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Unit Name *</Label>
              <Input value={form.unitName} onChange={(e) => setForm({ ...form, unitName: e.target.value })} placeholder="e.g. Kilogram" />
            </div>
            <div className="space-y-1.5">
              <Label>Symbol</Label>
              <Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="e.g. kg" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.status} onCheckedChange={(v) => setForm({ ...form, status: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-brand hover:brightness-110 text-brand-foreground" onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update Unit" : "Add Unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
