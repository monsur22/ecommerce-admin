"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { settingsApi } from "@/lib/settingsApi"
import { useToast } from "@/hooks/use-toast"

const DEFAULTS = { primaryColor: "#6B1A2A", accentColor: "#B8963E", backgroundColor: "#F0EBE3" }

/**
 * Storefront brand colours (primary / accent / background). Applied to the
 * customer-facing Aura storefront. Self-contained: loads and saves through the
 * storefront general-settings endpoint, so it can be dropped on any settings
 * page. Distinct from the admin accent picker, which recolours the dashboard.
 */
export function StorefrontBrandColors() {
  const { toast } = useToast()
  const [colors, setColors] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi.getAll()
      .then((res) => {
        const g = res.data?.general ?? {}
        setColors({
          primaryColor: g.primaryColor ?? DEFAULTS.primaryColor,
          accentColor: g.accentColor ?? DEFAULTS.accentColor,
          backgroundColor: g.backgroundColor ?? DEFAULTS.backgroundColor,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof typeof colors, value: string) =>
    setColors((prev) => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      await settingsApi.updateGeneral(colors)
      toast({ title: "Saved", description: "Storefront brand colors updated" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.response?.data?.message || "Failed to save" })
    } finally {
      setSaving(false)
    }
  }

  const fields: { label: string; key: keyof typeof colors }[] = [
    { label: "Primary Color", key: "primaryColor" },
    { label: "Accent Color", key: "accentColor" },
    { label: "Background Color", key: "backgroundColor" },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Applied to the customer-facing storefront.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {fields.map(({ label, key }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">{label}</label>
            <div className="flex items-center gap-2 border border-border rounded-lg px-2 py-1.5">
              <input
                type="color"
                value={colors[key]}
                disabled={loading}
                onChange={(e) => set(key, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
              />
              <input
                type="text"
                value={colors[key]}
                disabled={loading}
                onChange={(e) => {
                  const v = e.target.value
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) set(key, v)
                }}
                maxLength={7}
                className="w-full text-xs font-mono uppercase bg-transparent outline-none text-foreground"
                placeholder="#000000"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || loading} className="bg-brand hover:brightness-110 text-brand-foreground">
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Save colors"}
        </Button>
      </div>
    </div>
  )
}
