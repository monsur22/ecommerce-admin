"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { productApi } from "@/lib/productApi"
import { collectionApi } from "@/lib/collectionApi"
import { resolveStorageUrl } from "@/lib/settingsApi"
import { cn } from "@/lib/utils"

export interface PickedTarget { id: number; name: string; image?: string | null; hint?: string }

/** Product combobox that searches the server as you type (the catalog can be large). */
export function ProductPicker({ id, value, onChange, invalid }: { id?: string; value: PickedTarget | null; onChange: (p: PickedTarget) => void; invalid?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [items, setItems] = React.useState<PickedTarget[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let live = true
    setLoading(true)
    const t = setTimeout(() => {
      productApi.getAll({ search: query || undefined, limit: 20, page: 1 })
        .then((r) => {
          if (!live) return
          setItems(r.data.map((p: any) => ({
            id: Number(p.id), name: p.name,
            image: p.image ? resolveStorageUrl(p.image) : null,
            hint: [p.sku, p.stock != null ? `${p.stock} in stock` : ""].filter(Boolean).join(" · "),
          })))
        })
        .catch(() => { if (live) setItems([]) })
        .finally(() => { if (live) setLoading(false) })
    }, query ? 250 : 0)
    return () => { live = false; clearTimeout(t) }
  }, [open, query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} aria-invalid={invalid || undefined}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}>
          <span className="flex min-w-0 items-center gap-2">
            {value?.image ? <img src={value.image} alt="" className="size-5 rounded object-cover" /> : <Package className="size-4 shrink-0" aria-hidden />}
            <span className="truncate">{value ? value.name : "Choose a product…"}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search products by name or SKU…" value={query} onValueChange={setQuery} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Spinner /> Searching…</div>
            ) : (
              <>
                <CommandEmpty>No products found.</CommandEmpty>
                <CommandGroup>
                  {items.map((p) => (
                    <CommandItem key={p.id} value={String(p.id)} onSelect={() => { onChange(p); setOpen(false) }}>
                      <Check className={cn("size-4", value?.id === p.id ? "opacity-100" : "opacity-0")} aria-hidden />
                      {p.image ? <img src={p.image} alt="" className="size-7 rounded object-cover" /> : <span className="grid size-7 place-items-center rounded bg-muted"><Package className="size-3.5" aria-hidden /></span>}
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{p.name}</span>
                        {p.hint && <span className="truncate text-xs text-muted-foreground">{p.hint}</span>}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Collection combobox (collections are few; loaded once). */
export function CollectionPicker({ id, value, onChange, invalid }: { id?: string; value: PickedTarget | null; onChange: (p: PickedTarget) => void; invalid?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [items, setItems] = React.useState<PickedTarget[] | null>(null)

  React.useEffect(() => {
    if (!open || items) return
    collectionApi.listAll()
      .then((list) => setItems(list.map((c) => ({
        id: c.id, name: c.name, image: c.imageUrl ? resolveStorageUrl(c.imageUrl) : null,
        hint: `${c.productCount} product${c.productCount === 1 ? "" : "s"}${c.isPublished ? "" : " · not published"}`,
      }))))
      .catch(() => setItems([]))
  }, [open, items])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} aria-invalid={invalid || undefined}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}>
          <span className="truncate">{value ? value.name : "Choose a collection…"}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search collections…" />
          <CommandList>
            {!items ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Spinner /> Loading…</div>
            ) : (
              <>
                <CommandEmpty>No collections yet.</CommandEmpty>
                <CommandGroup>
                  {items.map((c) => (
                    <CommandItem key={c.id} value={`${c.name} ${c.id}`} onSelect={() => { onChange(c); setOpen(false) }}>
                      <Check className={cn("size-4", value?.id === c.id ? "opacity-100" : "opacity-0")} aria-hidden />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{c.name}</span>
                        {c.hint && <span className="truncate text-xs text-muted-foreground">{c.hint}</span>}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
