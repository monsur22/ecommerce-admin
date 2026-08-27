"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { saasCompanyApi, type BillingContactPayload } from "@/lib/saasCompanyApi"
import { AlertCircle, Loader, Save, MapPin } from "lucide-react"

/**
 * Billing address + tax-ID form. Loads and saves through the company billing
 * endpoint. Extracted from the former /company/billing-contact page so it can
 * live inside Company Settings.
 */
export function BillingContactForm() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState<BillingContactPayload>({
    email: "", phone: "", address: "", city: "", state: "",
    zipCode: "", country: "", taxId: "", taxIdType: "gst",
  })

  useEffect(() => {
    saasCompanyApi.getBillingContact()
      .then((response) => {
        setFormData({
          email: response.data.email,
          phone: response.data.phone,
          address: response.data.address,
          city: response.data.city,
          state: response.data.state,
          zipCode: response.data.zipCode,
          country: response.data.country,
          taxId: response.data.taxId || "",
          taxIdType: (response.data.taxIdType as "vat" | "ein" | "gst" | "other") || "gst",
        })
      })
      .catch((err: any) => setError(err.response?.data?.message || "Failed to load billing contact"))
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (field: keyof BillingContactPayload, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!formData.email || !formData.phone || !formData.address || !formData.city) {
      setError("Please fill in all required fields")
      return
    }
    setSaving(true)
    setError("")
    setSuccessMessage("")
    try {
      await saasCompanyApi.updateBillingContact(formData)
      setSuccessMessage("Billing contact updated successfully")
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update billing contact")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader className="w-6 h-6 text-brand-fg animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <span className="w-5 h-5">✓</span>
          <p className="text-sm">{successMessage}</p>
        </div>
      )}

      {/* Billing Address */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <MapPin className="w-5 h-5 text-brand-fg" />
          <h3 className="text-lg font-semibold text-foreground">Billing Address</h3>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email <span className="text-red-500">*</span></label>
              <Input type="email" value={formData.email || ""} onChange={(e) => handleChange("email", e.target.value)} placeholder="billing@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Phone <span className="text-red-500">*</span></label>
              <Input type="tel" value={formData.phone || ""} onChange={(e) => handleChange("phone", e.target.value)} placeholder="+1 (555) 000-0000" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Street Address <span className="text-red-500">*</span></label>
            <Input value={formData.address || ""} onChange={(e) => handleChange("address", e.target.value)} placeholder="123 Main Street" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">City <span className="text-red-500">*</span></label>
              <Input value={formData.city || ""} onChange={(e) => handleChange("city", e.target.value)} placeholder="New York" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">State</label>
              <Input value={formData.state || ""} onChange={(e) => handleChange("state", e.target.value)} placeholder="NY" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Zip Code</label>
              <Input value={formData.zipCode || ""} onChange={(e) => handleChange("zipCode", e.target.value)} placeholder="10001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Country</label>
              <Input value={formData.country || ""} onChange={(e) => handleChange("country", e.target.value)} placeholder="United States" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-brand hover:brightness-110 text-brand-foreground">
          {saving ? <><Loader className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save billing contact</>}
        </Button>
      </div>
    </div>
  )
}
