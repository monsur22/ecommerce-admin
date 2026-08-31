'use client'

import { useState, useRef, useCallback } from 'react'
import { productApi, type ProductResponse } from '@/lib/productApi'
import { useSaasAuth } from '@/contexts/saas-auth-context'
import { useModuleGuard } from '@/hooks/use-module-guard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Trash2, Loader2, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useCompanySettings } from '@/contexts/company-settings-context'

// ============ TYPES ============

interface PrintItem {
  product: ProductResponse
  quantity: number
  packingDate: string
}

interface LabelSettings {
  showProductName: boolean
  showProductVariation: boolean
  showProductPrice: boolean
  showBusinessName: boolean
  showPackingDate: boolean
}

interface FontSizes {
  productName: number
  productVariation: number
  productPrice: number
  businessName: number
  packingDate: number
}

interface PaperSize {
  id: string
  label: string
  cols: number
  labelHeightPx: number
}

// ============ CONSTANTS ============

const PAPER_SIZES: PaperSize[] = [
  { id: '20-per-sheet', label: '20 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 4" x 1", Labels per Row: 2', cols: 2, labelHeightPx: 96 },
  { id: '30-per-sheet', label: '30 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 2.6" x 1", Labels per Row: 3', cols: 3, labelHeightPx: 96 },
  { id: '40-per-sheet', label: '40 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 2" x 1", Labels per Row: 4', cols: 4, labelHeightPx: 96 },
  { id: '50-per-sheet', label: '50 Labels per Sheet, Sheet Size: 8.5" x 11", Label Size: 1.5" x 1", Labels per Row: 5', cols: 5, labelHeightPx: 96 },
]

const LABEL_FIELDS: { key: keyof LabelSettings; sizeKey: keyof FontSizes; label: string }[] = [
  { key: 'showProductName', sizeKey: 'productName', label: 'Product Name' },
  { key: 'showProductVariation', sizeKey: 'productVariation', label: 'Product Variation (recommended)' },
  { key: 'showProductPrice', sizeKey: 'productPrice', label: 'Product Price' },
  { key: 'showBusinessName', sizeKey: 'businessName', label: 'Business name' },
  { key: 'showPackingDate', sizeKey: 'packingDate', label: 'Print packing date' },
]

const todayStr = () => new Date().toISOString().slice(0, 10)

// ============ PAGE COMPONENT ============

export default function PrintBarcodePage() {
  const { formatCurrency, taxRate } = useCompanySettings() as any
  const { toast } = useToast()
  const { company } = useSaasAuth()

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductResponse[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Print list
  const [printItems, setPrintItems] = useState<PrintItem[]>([])

  // Label settings
  const [labelSettings, setLabelSettings] = useState<LabelSettings>({
    showProductName: true,
    showProductVariation: true,
    showProductPrice: true,
    showBusinessName: true,
    showPackingDate: true,
  })
  const [fontSizes, setFontSizes] = useState<FontSizes>({
    productName: 15,
    productVariation: 17,
    productPrice: 17,
    businessName: 20,
    packingDate: 12,
  })
  const [showPrice, setShowPrice] = useState<'inc' | 'exc'>('inc')
  const [selectedPaperSizeId, setSelectedPaperSizeId] = useState('20-per-sheet')

  const blocked = useModuleGuard('Print Barcode')

  // ============ HANDLERS ============

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setSearchResults([]); setShowDropdown(false); return }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await productApi.getAll({ search: value, limit: 10 })
        setSearchResults(res.data ?? [])
        setShowDropdown(true)
      } catch { setSearchResults([]) } finally { setIsSearching(false) }
    }, 300)
  }, [])

  const handleAddProduct = useCallback((product: ProductResponse) => {
    setPrintItems(prev => prev.some(i => i.product.id === product.id)
      ? prev
      : [...prev, { product, quantity: 1, packingDate: todayStr() }])
    setSearchQuery(''); setSearchResults([]); setShowDropdown(false)
  }, [])

  const updateItem = (id: number, patch: Partial<PrintItem>) =>
    setPrintItems(prev => prev.map(i => i.product.id === id ? { ...i, ...patch } : i))

  const removeItem = (id: number) => setPrintItems(prev => prev.filter(i => i.product.id !== id))

  const getPrice = (product: ProductResponse) => {
    const base = product.sale_price ?? (product as any).salePrice ?? product.price ?? 0
    const rate = Number(taxRate) || 0
    if (showPrice === 'inc' && rate) return base + (base * rate) / 100
    return base
  }

  const buildLabelsHtml = () => {
    const paper = PAPER_SIZES.find(p => p.id === selectedPaperSizeId) ?? PAPER_SIZES[0]
    const businessName = company?.name ?? 'Business'
    const expanded = printItems.flatMap(item =>
      Array.from({ length: item.quantity }, () => item))

    const labelHtml = expanded.map((item, index) => {
      const p = item.product
      const barcodeValue = p.barcode || (p as any).barcode_code || p.sku || String(p.id)
      let html = '<div class="label">'
      if (labelSettings.showBusinessName) html += `<div class="business-name" style="font-size:${fontSizes.businessName}px">${businessName}</div>`
      if (labelSettings.showProductName) html += `<div class="product-name" style="font-size:${fontSizes.productName}px">${p.name}</div>`
      if (labelSettings.showProductVariation) html += `<div class="variation" style="font-size:${fontSizes.productVariation}px">${(p as any).variationName ?? p.sku ?? ''}</div>`
      html += `<svg id="barcode-${index}" class="barcode-svg"></svg>`
      html += `<div class="barcode-code">${barcodeValue}</div>`
      if (labelSettings.showProductPrice) html += `<div class="price" style="font-size:${fontSizes.productPrice}px">${formatCurrency(getPrice(p))}</div>`
      if (labelSettings.showPackingDate) html += `<div class="packing-date" style="font-size:${fontSizes.packingDate}px">Packed: ${item.packingDate}</div>`
      html += '</div>'
      return html
    }).join('')

    const fmtMap: Record<string, string> = {
      C128: 'CODE128', C39: 'CODE39', EAN13: 'EAN13', EAN8: 'EAN8', UPCA: 'UPC', UPCE: 'UPC',
    }
    const jsbarcodeCalls = expanded.map((item, index) => {
      const p = item.product
      const barcodeValue = p.barcode || (p as any).barcode_code || p.sku || String(p.id)
      const format = fmtMap[(p as any).barcodeType || 'C128'] || 'CODE128'
      return `JsBarcode("#barcode-${index}", ${JSON.stringify(barcodeValue)}, { format: "${format}", width: 1.5, height: 40, displayValue: false, margin: 4 });`
    }).join('\n')

    return { paper, labelHtml, jsbarcodeCalls }
  }

  const openPrint = (autoPrint: boolean) => {
    if (printItems.length === 0) {
      toast({ title: 'No products', description: 'Add at least one product to print', variant: 'destructive' })
      return
    }
    const { paper, labelHtml, jsbarcodeCalls } = buildLabelsHtml()
    const win = window.open('', '_blank')
    if (!win) {
      toast({ title: 'Popup blocked', description: 'Allow popups to print labels', variant: 'destructive' })
      return
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Print Labels</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;padding:8px;background:#fff}
        .label-grid{display:grid;grid-template-columns:repeat(${paper.cols},1fr);gap:2px}
        .label{border:1px solid #ddd;padding:6px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-inside:avoid;overflow:hidden;min-height:${paper.labelHeightPx}px}
        .business-name{font-weight:bold;margin-bottom:2px}
        .product-name{font-weight:600;margin-bottom:2px;line-height:1.2;word-break:break-word}
        .variation{color:#555;margin-bottom:2px}
        .barcode-svg{max-width:100%;height:auto;margin:2px 0}
        .barcode-code{font-family:monospace;font-size:8px;color:#333;margin-top:2px}
        .price{font-weight:bold;color:#16a34a;margin-top:2px}
        .packing-date{color:#555;margin-top:2px}
        @media print{body{padding:0}.label-grid{gap:0}.label{border:1px dashed #ccc}}
      </style></head><body>
      <div class="label-grid">${labelHtml}</div>
      <script>window.onload=function(){${jsbarcodeCalls}${autoPrint ? 'setTimeout(function(){window.print()},600);' : ''}};<\/script>
      </body></html>`)
    win.document.close()
  }

  if (blocked) return blocked

  const currentPaper = PAPER_SIZES.find(p => p.id === selectedPaperSizeId)

  // ============ JSX ============

  return (
    <div className="min-h-screen bg-muted/30 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
          Print Labels <Info className="w-4 h-4 text-sky-500" />
        </h1>

        {/* Add products */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-brand-fg mb-4">Add products to generate Labels</h2>
          <div className="relative max-w-3xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10 pr-10"
              placeholder="Enter products name to print labels"
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            />
            {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-fg animate-spin" />}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border shadow-lg rounded-md max-h-64 overflow-y-auto">
                {searchResults.map(product => (
                  <button key={product.id} onClick={() => handleAddProduct(product)}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted border-b border-border last:border-0 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-foreground text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <span className="text-sm font-semibold text-money-fg">{formatCurrency(getPrice(product))}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Products table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="py-2.5 px-3">Products</th>
                  <th className="py-2.5 px-3 w-32">No. of labels</th>
                  <th className="py-2.5 px-3 w-44">Packing Date</th>
                  <th className="py-2.5 px-3 w-40">Selling Price Group</th>
                  <th className="py-2.5 px-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {printItems.length === 0 ? (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Search and add products above.</td></tr>
                ) : printItems.map(item => (
                  <tr key={item.product.id} className="hover:bg-muted/40">
                    <td className="py-2.5 px-3 font-medium text-foreground">{item.product.name}</td>
                    <td className="py-2.5 px-3">
                      <Input type="number" min={1} value={item.quantity}
                        onChange={e => updateItem(item.product.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-24" />
                    </td>
                    <td className="py-2.5 px-3">
                      <Input type="date" value={item.packingDate}
                        onChange={e => updateItem(item.product.id, { packingDate: e.target.value })}
                        className="w-40" />
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">{showPrice === 'inc' ? 'Default (Inc. tax)' : 'Default (Exc. tax)'}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button onClick={() => removeItem(item.product.id)} className="text-destructive hover:opacity-80"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Information to show in labels */}
        <Card className="p-6">
          <h2 className="text-base font-semibold text-brand-fg mb-4">Information to show in Labels</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
            {LABEL_FIELDS.map(field => {
              const checked = labelSettings[field.key]
              return (
                <div key={field.key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id={field.key} checked={checked}
                      onCheckedChange={v => setLabelSettings(prev => ({ ...prev, [field.key]: !!v }))} />
                    <Label htmlFor={field.key} className="font-semibold cursor-pointer">{field.label}</Label>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
                    <span className="text-xs text-muted-foreground">Size</span>
                    <Input type="number" min={6} max={40} value={fontSizes[field.sizeKey]} disabled={!checked}
                      onChange={e => setFontSizes(prev => ({ ...prev, [field.sizeKey]: parseInt(e.target.value) || 10 }))}
                      className="border-0 p-0 h-6 focus-visible:ring-0" />
                  </div>
                </div>
              )
            })}
            {/* Show Price */}
            <div className="space-y-2">
              <Label className="font-semibold">Show Price:</Label>
              <Select value={showPrice} onValueChange={v => setShowPrice(v as 'inc' | 'exc')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inc">Inc. tax</SelectItem>
                  <SelectItem value="exc">Exc. tax</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Barcode setting */}
          <div className="mt-6 border-t border-border pt-5">
            <Label className="font-semibold">Barcode setting:</Label>
            <Select value={selectedPaperSizeId} onValueChange={setSelectedPaperSizeId}>
              <SelectTrigger className="w-full max-w-xl mt-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAPER_SIZES.map(ps => <SelectItem key={ps.id} value={ps.id}>{ps.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">{currentPaper?.cols} labels per row</p>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3 mt-6">
            <Button onClick={() => openPrint(false)} disabled={printItems.length === 0}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-8">Preview</Button>
            <Button onClick={() => openPrint(true)} disabled={printItems.length === 0}
              className="bg-brand hover:brightness-110 text-brand-foreground px-8">Preview PDF</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
