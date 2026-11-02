"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown, Layers, Package, QrCode as QrIcon, Store, Zap } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { FormField } from "@/components/common/FormField"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { AD_SOURCE_META } from "@/components/sales/ad-source"
import { CollectionPicker, ProductPicker, type PickedTarget } from "@/components/marketing/target-pickers"
import { CopyField, QrCode, TARGET_LABEL, UTM_MEDIUM, buildCaption, shareUrl, slugify } from "@/components/marketing/link-ui"
import {
  LINK_CHANNELS, campaignLinkApi, type CampaignLink, type CampaignLinkPayload, type LinkChannel, type LinkTargetType,
} from "@/lib/campaignLinkApi"
import { apiErrorMessage, apiFieldErrors } from "@/lib/collectionApi"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const TARGETS: { value: LinkTargetType; icon: React.ReactNode; description: string }[] = [
  { value: "quick_order", icon: <Zap className="size-4" aria-hidden />, description: "One-page order form for a product. Fastest for ads (COD, no login)." },
  { value: "product", icon: <Package className="size-4" aria-hidden />, description: "The product page in your online store." },
  { value: "collection", icon: <Layers className="size-4" aria-hidden />, description: "A collection, e.g. “Eid Panjabi”." },
  { value: "store", icon: <Store className="size-4" aria-hidden />, description: "Your store's home page." },
]

type UtmKey = "utmSource" | "utmMedium" | "utmCampaign" | "utmContent"
const UTM_FIELDS: [UtmKey, string][] = [["utmSource", "utm_source"], ["utmMedium", "utm_medium"], ["utmCampaign", "utm_campaign"], ["utmContent", "utm_content"]]

interface FormState {
  name: string
  channel: LinkChannel | ""
  targetType: LinkTargetType
  target: PickedTarget | null
  code: string
  utm: Record<UtmKey, string>
  /** UTM fields the user typed in (others follow the auto values). */
  touched: Partial<Record<UtmKey, boolean>>
  notes: string
  isActive: boolean
}

const emptyForm = (): FormState => ({
  name: "", channel: "", targetType: "quick_order", target: null, code: "",
  utm: { utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "" }, touched: {}, notes: "", isActive: true,
})

const fromLink = (l: CampaignLink): FormState => ({
  name: l.name, channel: l.channel, targetType: l.targetType,
  target: l.target ? { id: l.target.id, name: l.target.name, image: l.target.image } : null,
  code: l.code,
  utm: { utmSource: l.utmSource ?? "", utmMedium: l.utmMedium ?? "", utmCampaign: l.utmCampaign ?? "", utmContent: l.utmContent ?? "" },
  touched: { utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true },
  notes: l.notes ?? "", isActive: l.isActive,
})

/** Auto UTM values from channel + name + target (same rules as the server defaults). */
function autoUtm(f: FormState): Record<UtmKey, string> {
  return {
    utmSource: f.channel || "",
    utmMedium: f.channel ? UTM_MEDIUM[f.channel] : "",
    utmCampaign: slugify(f.name),
    utmContent: f.targetType === "store" ? "store" : f.target ? slugify(f.target.name) : "",
  }
}

interface LinkDialogProps {
  open: boolean
  /** Link to edit; null creates a new one. */
  link: CampaignLink | null
  /** Open straight on the share step (links / QR / captions). */
  shareOnly?: boolean
  storeName?: string
  onClose: () => void
  onSaved: (link: CampaignLink) => void
}

export function LinkDialog({ open, link, shareOnly, storeName, onClose, onSaved }: LinkDialogProps) {
  const { toast } = useToast()
  const [f, setF] = React.useState<FormState>(emptyForm)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState<CampaignLink | null>(null)
  const [utmOpen, setUtmOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setF(link ? fromLink(link) : emptyForm())
    setErrors({}); setUtmOpen(false)
    setSaved(shareOnly && link ? link : null)
  }, [open, link, shareOnly])

  const auto = autoUtm(f)
  const utmValue = (k: UtmKey) => (f.touched[k] ? f.utm[k] : auto[k])
  const patch = (p: Partial<FormState>) => setF((cur) => ({ ...cur, ...p }))
  const needsProduct = f.targetType === "product" || f.targetType === "quick_order"

  const validate = () => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = "Give the link a name."
    if (!f.channel) e.channel = "Choose a channel."
    if (needsProduct && !f.target) e.targetId = "Choose a product."
    if (f.targetType === "collection" && !f.target) e.targetId = "Choose a collection."
    const code = f.code.trim()
    if (code && !/^[A-Za-z0-9_-]{4,20}$/.test(code)) e.code = "The code may only contain letters, numbers, - and _ (4-20 characters)."
    for (const [k] of UTM_FIELDS) if (utmValue(k).length > 100) e[k] = "UTM values may not be longer than 100 characters."
    return e
  }

  const submit = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) {
      if (UTM_FIELDS.some(([k]) => e[k])) setUtmOpen(true)
      return
    }
    const body: CampaignLinkPayload = {
      name: f.name.trim(),
      channel: f.channel as LinkChannel,
      targetType: f.targetType,
      targetId: f.targetType === "store" ? null : f.target?.id ?? null,
      code: f.code.trim() ? f.code.trim() : null,
      // Untouched UTM fields go as null so the server applies its defaults
      utmSource: f.touched.utmSource ? f.utm.utmSource.trim() || null : null,
      utmMedium: f.touched.utmMedium ? f.utm.utmMedium.trim() || null : null,
      utmCampaign: f.touched.utmCampaign ? f.utm.utmCampaign.trim() || null : null,
      utmContent: f.touched.utmContent ? f.utm.utmContent.trim() || null : null,
      notes: f.notes.trim() || null,
      isActive: f.isActive,
    }
    setSaving(true)
    try {
      const res = link ? await campaignLinkApi.update(link.id, body) : await campaignLinkApi.create(body)
      onSaved(res)
      setSaved(res)
      toast({ title: link ? "Link updated" : "Link created", description: "Copy it into your post or ad." })
    } catch (err) {
      const fe = apiFieldErrors(err)
      setErrors(fe)
      if (UTM_FIELDS.some(([k]) => fe[k])) setUtmOpen(true)
      toast({ variant: "destructive", title: "Could not save the link", description: apiErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{saved ? saved.name : link ? "Edit order link" : "New order link"}</DialogTitle>
          <DialogDescription>
            {saved
              ? "Post this link on Facebook, Instagram, WhatsApp or TikTok. Orders from it are tagged automatically."
              : "One link per post or ad, so you can see which one brings orders."}
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <SharePanel link={saved} storeName={storeName} />
        ) : (
          <div className="flex flex-col gap-5">
            <FormField label="Link name" htmlFor="cl-name" required error={errors.name} description="Only you see this, e.g. “Eid Panjabi FB post”.">
              <Input id="cl-name" value={f.name} maxLength={150} autoFocus placeholder="Eid Panjabi FB post"
                aria-invalid={!!errors.name} onChange={(e) => patch({ name: e.target.value })} />
            </FormField>

            <FormField label="Where will you post it?" required error={errors.channel}>
              <ChoiceCardGroup aria-label="Channel" value={f.channel} onValueChange={(v) => patch({ channel: v as LinkChannel })}
                className="grid-cols-2 sm:grid-cols-4">
                {LINK_CHANNELS.map((c) => {
                  const meta = AD_SOURCE_META[c]
                  const Icon = meta.icon
                  return (
                    <ChoiceCard key={c} value={c} className="p-3"
                      icon={<span className={cn("grid size-7 place-items-center rounded-md", meta.className)}><Icon className="size-4" aria-hidden /></span>}
                      title={meta.label} />
                  )
                })}
              </ChoiceCardGroup>
            </FormField>

            <FormField label="What does the link open?" required>
              <ChoiceCardGroup aria-label="Link opens" value={f.targetType}
                onValueChange={(v) => {
                  const next = v as LinkTargetType
                  const sameKind = (a: LinkTargetType, b: LinkTargetType) => (a === "product" || a === "quick_order") && (b === "product" || b === "quick_order")
                  patch({ targetType: next, target: sameKind(next, f.targetType) ? f.target : null })
                  setErrors((e) => ({ ...e, targetId: "" }))
                }}
                className="sm:grid-cols-2">
                {TARGETS.map((t) => (
                  <ChoiceCard key={t.value} value={t.value} icon={t.icon} title={TARGET_LABEL[t.value]} description={t.description} />
                ))}
              </ChoiceCardGroup>
            </FormField>

            {needsProduct && (
              <FormField label="Product" htmlFor="cl-product" required error={errors.targetId}>
                <ProductPicker id="cl-product" value={f.target} invalid={!!errors.targetId} onChange={(p) => { patch({ target: p }); setErrors((e) => ({ ...e, targetId: "" })) }} />
              </FormField>
            )}
            {f.targetType === "collection" && (
              <FormField label="Collection" htmlFor="cl-collection" required error={errors.targetId}>
                <CollectionPicker id="cl-collection" value={f.target} invalid={!!errors.targetId} onChange={(c) => { patch({ target: c }); setErrors((e) => ({ ...e, targetId: "" })) }} />
              </FormField>
            )}

            <Collapsible open={utmOpen} onOpenChange={setUtmOpen} className="rounded-lg border">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="h-auto w-full justify-between px-4 py-3 text-left">
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="font-medium">Tracking (UTM) and short code</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {[utmValue("utmSource"), utmValue("utmMedium"), utmValue("utmCampaign")].filter(Boolean).join(" · ") || "Filled in automatically"}
                    </span>
                  </span>
                  <ChevronDown className={cn("size-4 transition-transform", utmOpen && "rotate-180")} aria-hidden />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-3 border-t p-4 sm:grid-cols-2">
                {UTM_FIELDS.map(([k, label]) => (
                  <FormField key={k} label={label} htmlFor={`cl-${k}`} error={errors[k]}
                    description={f.touched[k] ? (
                      <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs"
                        onClick={() => setF((cur) => ({ ...cur, touched: { ...cur.touched, [k]: false } }))}>
                        Use automatic value
                      </Button>
                    ) : "Automatic"}>
                    <Input id={`cl-${k}`} className="font-mono text-xs" maxLength={100} value={utmValue(k)} aria-invalid={!!errors[k]}
                      onChange={(e) => setF((cur) => ({ ...cur, utm: { ...cur.utm, [k]: e.target.value }, touched: { ...cur.touched, [k]: true } }))} />
                  </FormField>
                ))}
                <FormField label="Short code" htmlFor="cl-code" error={errors.code} className="sm:col-span-2"
                  description="Leave empty for a random 6-character code. Custom: 4–20 letters, numbers, - or _.">
                  <Input id="cl-code" className="font-mono" maxLength={20} value={f.code} placeholder="auto" aria-invalid={!!errors.code}
                    onChange={(e) => patch({ code: e.target.value.replace(/\s/g, "") })} />
                </FormField>
              </CollapsibleContent>
            </Collapsible>

            <FormField label="Notes" htmlFor="cl-notes" description="Optional, e.g. ad budget or audience.">
              <Textarea id="cl-notes" rows={2} maxLength={1000} value={f.notes} onChange={(e) => patch({ notes: e.target.value })} />
            </FormField>

            <div className="flex items-center gap-3">
              <Switch id="cl-active" checked={f.isActive} onCheckedChange={(v) => patch({ isActive: v })} />
              <label htmlFor="cl-active" className="text-sm">
                Active <span className="text-muted-foreground">— inactive short links send shoppers to your home page</span>
              </label>
            </div>
          </div>
        )}

        <DialogFooter>
          {saved ? (
            <>
              {shareOnly && link && <Button type="button" variant="outline" onClick={() => setSaved(null)}>Edit link</Button>}
              <Button type="button" onClick={onClose}>Done</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="button" disabled={saving} onClick={submit}>{saving ? "Saving…" : link ? "Save changes" : "Create link"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Full URL + short URL with copy, QR code and ready-to-post captions. */
export function SharePanel({ link, storeName, compact }: { link: CampaignLink; storeName?: string; compact?: boolean }) {
  const [captionKind, setCaptionKind] = React.useState<"facebook" | "whatsapp">(link.channel === "whatsapp" ? "whatsapp" : "facebook")
  const [caption, setCaption] = React.useState(() => buildCaption(captionKind, link, storeName))
  const [showQr, setShowQr] = React.useState(!compact)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => { setCaption(buildCaption(captionKind, link, storeName)) }, [captionKind, link, storeName])

  const copyCaption = async () => {
    try { await navigator.clipboard.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* blocked */ }
  }
  const url = shareUrl(link)
  const hasAbsolute = !!(link.shortUrl || link.fullUrl)

  return (
    <div className="flex flex-col gap-4">
      {!link.storeBaseUrl && (
        <Alert>
          <Store aria-hidden />
          <AlertTitle>Store address not set</AlertTitle>
          <AlertDescription>
            <p>Add your store domain in <Link href="/dashboard/store" className="font-medium underline underline-offset-4">Online store settings</Link> to get a full link. Until then only the path is shown.</p>
          </AlertDescription>
        </Alert>
      )}
      <div className={cn("grid gap-4", !compact && hasAbsolute && "sm:grid-cols-[1fr_auto]")}>
        <div className="flex min-w-0 flex-col gap-3">
          {link.shortUrl && (
            <FormField label="Short link (best for posts)" htmlFor={`cl-short-${link.id}`}>
              <CopyField id={`cl-short-${link.id}`} label="Short link" value={link.shortUrl} />
            </FormField>
          )}
          <FormField label={link.fullUrl ? "Full link (with UTM tags)" : "Link path"} htmlFor={`cl-full-${link.id}`}
            description="Use the full link in Ads Manager's Website URL if you prefer.">
            <CopyField id={`cl-full-${link.id}`} label="Full link" value={link.fullUrl || link.targetPath} />
          </FormField>
          {compact && hasAbsolute && (
            <Button type="button" variant="outline" size="sm" className="w-fit" aria-expanded={showQr} onClick={() => setShowQr((v) => !v)}>
              <QrIcon className="size-4" aria-hidden /> {showQr ? "Hide QR code" : "Show QR code"}
            </Button>
          )}
        </div>
        {showQr && hasAbsolute && <QrCode value={url} fileName={`order-link-${link.code}`} className={compact ? "items-start" : undefined} />}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Ready-to-post caption</p>
          <SegmentedControl aria-label="Caption for" value={captionKind} onValueChange={(v) => setCaptionKind(v as "facebook" | "whatsapp")}
            options={[{ value: "facebook", label: "Facebook / Instagram" }, { value: "whatsapp", label: "WhatsApp" }]} />
        </div>
        <Textarea aria-label="Caption" rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyCaption}>{copied ? "Copied" : "Copy caption"}</Button>
          {captionKind === "whatsapp" && (
            <Button asChild variant="outline" size="sm">
              <a href={`https://wa.me/?text=${encodeURIComponent(caption)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp ↗</a>
            </Button>
          )}
          {captionKind === "facebook" && link.fullUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Share on Facebook ↗</a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
