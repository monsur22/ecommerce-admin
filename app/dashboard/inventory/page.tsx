"use client"

import { useState, useMemo } from "react"
import { Search, ArrowRightLeft, Printer, QrCode } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useProduct } from "@/contexts/product-context"
import { useWarehouse } from "@/contexts/warehouse-context"
import Link from "next/link"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Skeleton } from "@/components/ui/skeleton"
import { useEffect } from "react"

type InventoryRow = {
  type: 'variant' | 'product'
  id: string
  productName: string
  variantName: string | null
  sku: string
  stock: number
  inventory?: any[] // Replace 'any[]' with your actual inventory type if you have one
  product: any // Replace 'any' with your actual Product type if you have one
  barcode?: string
}

export default function InventoryPage() {
  const { products } = useProduct()
  const { warehouses } = useWarehouse()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    const timer = setTimeout(() => {
        setIsLoading(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Flatten products into rows BEFORE pagination
  const allRows = useMemo(() => {
const rows: InventoryRow[] = []
    
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    )

    filtered.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach(variant => {
          rows.push({
            type: 'variant',
            id: variant.id,
            productName: product.name,
            variantName: variant.name,
            sku: variant.sku,
            stock: variant.stock,
            inventory: variant.inventory,
            product: product,
            barcode: variant.barcode || product.barcode
          })
        })
      } else {
        rows.push({
          type: 'product',
          id: product.id,
          productName: product.name,
          variantName: null,
          sku: product.sku,
          stock: product.stock,
          inventory: product.inventory,
          product: product,
          barcode: product.barcode
        })
      }
    })
    
    return rows
  }, [products, searchQuery])

  const {
    currentItems: currentRows,
    currentPage,
    totalPages,
    itemsPerPage,
    goToPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(allRows, 10)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedWarehouse, setCurrentPage])

  // Selection handlers
  const handleSelectRow = (rowId: string) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId)
    } else {
      newSelected.add(rowId)
    }
    setSelectedRows(newSelected)
  }

  const handleSelectAll = () => {
    const allIds = currentRows.map(row => row.id)
    setSelectedRows(new Set(allIds))
  }

  const handleDeselectAll = () => {
    setSelectedRows(new Set())
  }

  // Bulk barcode print handler
  const handlePrintSelectedBarcodes = () => {
    const selectedRowsData = allRows.filter(row => selectedRows.has(row.id))
    
    if (selectedRowsData.length === 0) {
      alert("Please select at least one product to print")
      return
    }

    // Create a new window with the barcode content
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert("Please allow popups to print barcodes")
      return
    }

    const barcodeHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcodes</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .barcode-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 24px;
              padding: 20px;
            }
            .barcode-item {
              border: 2px dashed #ccc;
              padding: 16px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border-radius: 8px;
              aspect-ratio: 3/2;
              page-break-inside: avoid;
            }
            .product-name {
              font-weight: bold;
              font-size: 14px;
              margin-bottom: 8px;
              text-align: center;
              width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .variant-name {
              font-size: 12px;
              color: #666;
              margin-bottom: 8px;
            }
            .sku {
              font-size: 12px;
              margin-top: 4px;
            }
            .price {
              font-weight: bold;
              margin-top: 4px;
            }
            @media print {
              body {
                padding: 0;
              }
              .barcode-grid {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="barcode-grid">
            ${selectedRowsData.map((row, index) => `
              <div class="barcode-item">
                <div class="product-name">${row.productName}</div>
                ${row.variantName ? `<div class="variant-name">${row.variantName}</div>` : ''}
                <svg id="barcode-${index}"></svg>
                <div class="sku">${row.sku}</div>
                <div class="price">$${row.product.salePrice || row.product.price}</div>
              </div>
            `).join('')}
          </div>
          <script>
            // Generate barcodes after DOM is ready
            window.onload = function() {
              ${selectedRowsData.map((row, index) => `
                JsBarcode("#barcode-${index}", "${row.barcode || row.sku}", {
                  width: 1.5,
                  height: 40,
                  fontSize: 12,
                  format: "CODE128"
                });
              `).join('\n')}
              
              // Auto-print after a short delay to ensure barcodes are rendered
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `

    printWindow.document.write(barcodeHTML)
    printWindow.document.close()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Track stock levels across all locations</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedRows.size > 0 && (
            <Button 
              onClick={handlePrintSelectedBarcodes}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Selected ({selectedRows.size})
            </Button>
          )}
          <Link href="/dashboard/inventory/transfer">
              <Button className="bg-emerald-600 hover:bg-emerald-700">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Stock Transfer
              </Button>
          </Link>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by Name or SKU"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {!isLoading && currentRows.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectAll}
            >
              Select All on Page
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDeselectAll}
            >
              Deselect All
            </Button>
            {selectedRows.size > 0 && (
              <span className="text-sm text-gray-600 ml-2">
                {selectedRows.size} item(s) selected
              </span>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase w-12">
                  <Checkbox
                    checked={currentRows.length > 0 && currentRows.every(row => selectedRows.has(row.id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleSelectAll()
                      } else {
                        handleDeselectAll()
                      }
                    }}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Product</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">SKU</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Total Stock</th>
                {warehouses.map(w => (
                     (selectedWarehouse === "all" || selectedWarehouse === w.id) && (
                        <th key={w.id} className="text-center py-3 px-4 text-xs font-semibold text-emerald-700 uppercase bg-emerald-50">
                            {w.name}
                        </th>
                     )
                ))}
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4"><Skeleton className="h-4 w-4 mx-auto" /></td>
                          <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                          <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                          <td className="py-3 px-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                          {warehouses.map(w => (
                              (selectedWarehouse === "all" || selectedWarehouse === w.id) && (
                                  <td key={w.id} className="py-3 px-4"><Skeleton className="h-4 w-8 mx-auto" /></td>
                              )
                          ))}
                          <td className="py-3 px-4"><Skeleton className="h-4 w-8 mx-auto" /></td>
                      </tr>
                  ))
              ) : (
                currentRows.map(row => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-center">
                      <Checkbox
                        checked={selectedRows.has(row.id)}
                        onCheckedChange={() => handleSelectRow(row.id)}
                      />
                    </td>
                    <td className="py-3 px-4">
                      {row.type === 'variant' ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{row.productName}</span>
                          <span className="text-xs text-gray-500">{row.variantName}</span>
                        </div>
                      ) : (
                        <span className="font-medium text-gray-900">{row.productName}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{row.sku}</td>
                    <td className="py-3 px-4 text-center font-bold text-gray-900">{row.stock}</td>
                    {warehouses.map(w => {
                      if (selectedWarehouse !== "all" && selectedWarehouse !== w.id) return null;
                      
                      const inv = row.inventory?.find(i => i.warehouseId === w.id)
                      const qty = inv ? inv.quantity : (w.isDefault ? row.stock : 0)

                      return (
                        <td key={w.id} className="py-3 px-4 text-center text-sm text-gray-600">
                          {qty}
                        </td>
                      )
                    })}
                    <td className="py-3 px-4 text-center">
                      <Link href={`/dashboard/products/${row.product.id}/barcode`}>
                        <Button variant="ghost" size="sm" title="Print Barcode">
                          <QrCode className="w-4 h-4 text-gray-600 hover:text-emerald-600" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!isLoading && allRows.length === 0 && (
             <div className="text-center py-12">
               <p className="text-gray-500">No products found</p>
             </div>
        )}
      </Card>
      
      {!isLoading && (
        <PaginationControl
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            totalItems={allRows.length}
        />
      )}
    </div>
  )
}