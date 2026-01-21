"use client"

import { useState, useMemo } from "react"
import { useVendorReturn } from "@/contexts/vendor-return-context"
import { useVendor } from "@/contexts/vendor-context"
import { useProduct } from "@/contexts/product-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, Eye, Download, TruckIcon, Package, Plus, Trash2 } from "lucide-react"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Skeleton } from "@/components/ui/skeleton"

// Return reasons
const RETURN_REASONS = [
  "Defective/Damaged",
  "Expired products",
  "Overstocked items",
  "Wrong items received",
  "Quality issues",
  "Recall",
  "Other"
]

// Status badge component
function VendorReturnStatusBadge({ status }: { status: string }) {
  const config = {
    pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pending' },
    shipped: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Shipped' },
    received_by_vendor: { color: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Received' },
    completed: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Completed' },
  }

  const statusConfig = config[status as keyof typeof config] || config.pending

  return (
    <Badge variant="outline" className={statusConfig.color}>
      {statusConfig.label}
    </Badge>
  )
}

// Format date helper
function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function VendorReturnsPage() {
  const { returns, addReturn, updateStatus, getReturnStats } = useVendorReturn()
  const { vendors } = useVendor()
  const { products } = useProduct()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [vendorFilter, setVendorFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  
  // Create Return Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    vendorId: "",
    returnDate: new Date().toISOString().split('T')[0], // Today's date as default

    creditType: "credit_note" as const,
    notes: "",
    items: [
      {
        productId: "",
        variantId: "",
        quantity: 1,
        reason: ""
      }
    ]
  })

  const stats = getReturnStats()

  // Filter returns
  const filteredReturns = useMemo(() => {
    return returns.filter((ret) => {
      const matchesSearch = 
        ret.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.vendorName.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = statusFilter === "all" || ret.status === statusFilter
      const matchesVendor = vendorFilter === "all" || ret.vendorId === vendorFilter

      return matchesSearch && matchesStatus && matchesVendor
    })
  }, [returns, searchQuery, statusFilter, vendorFilter])

  const {
    currentItems: currentReturns,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredReturns, 10)

  const handleViewDetails = (returnItem: any) => {
    setSelectedReturn(returnItem)
    setIsDetailsOpen(true)
  }

  const handleStatusUpdate = (returnId: string, newStatus: any) => {
    updateStatus(returnId, newStatus)
  }

  const handleDownloadReport = () => {
    const csvContent = [
      ["Return #", "Vendor", "Items", "Amount", "Status", "Date"],
      ...filteredReturns.map((ret) => [
        ret.returnNumber,
        ret.vendorName,
        ret.items.length.toString(),
        `$${ret.totalAmount.toFixed(2)}`,
        ret.status,
        formatDate(ret.returnDate),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vendor-returns-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Create Return Handlers
  const handleOpenCreateDialog = () => {
    setFormData({
      vendorId: "",
      returnDate: new Date().toISOString().split('T')[0],
      creditType: "credit_note",
      notes: "",
      items: [{
        productId: "",
        variantId: "",
        quantity: 1,
        reason: ""
      }]
    })
    setIsCreateDialogOpen(true)
  }

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { productId: "", variantId: "", quantity: 1, reason: "" }]
    }))
  }

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }))
  }

  const calculateTotal = () => {
    return formData.items.reduce((total, item) => {
      const product = products.find(p => p.id === item.productId)
      if (!product) return total
      const priceToUse = product.salePrice || product.price
      return total + (priceToUse * item.quantity)
    }, 0)
  }

  const handleCreateReturn = () => {
    // Validation
    if (!formData.vendorId) {
      alert("Please select a vendor")
      return
    }

    if (formData.items.some(item => !item.productId || !item.quantity || !item.reason)) {
      alert("Please fill in all item details")
      return
    }

    const vendor = vendors.find(v => v.id === formData.vendorId)
    if (!vendor) return

    const returnItems = formData.items.map(item => {
      const product = products.find(p => p.id === item.productId)
      const variant = item.variantId ? product?.variants?.find((v: any) => v.id === item.variantId) : null
      const priceToUse = variant?.price || product?.salePrice || product?.price || 0

      return {
        productId: item.productId,
        productName: product?.name || "",
        variantId: item.variantId || undefined,
        variantName: variant?.name || undefined,
        quantity: item.quantity,
        unitPrice: priceToUse,
        totalPrice: priceToUse * item.quantity,
        reason: item.reason
      }
    })

    const totalAmount = returnItems.reduce((sum, item) => sum + item.totalPrice, 0)

    addReturn({
      vendorId: formData.vendorId,
      vendorName: vendor.name,
      items: returnItems,
      totalAmount,
      status: "pending",
      creditType: formData.creditType,
      notes: formData.notes,
      createdBy: "Admin"
    })

    setIsCreateDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vendor Returns</h1>
          <p className="text-gray-600 mt-1">Manage returns to suppliers and vendors</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenCreateDialog} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            New Return
          </Button>
          <Button onClick={handleDownloadReport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Returns</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <TruckIcon className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Shipped</p>
              <p className="text-2xl font-bold text-blue-600">{stats.shipped}</p>
            </div>
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Credit</p>
              <p className="text-2xl font-bold text-green-600">${stats.totalCreditAmount.toFixed(2)}</p>
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by return # or vendor"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={vendorFilter} onValueChange={setVendorFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="received_by_vendor">Received</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Returns Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Return #</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Vendor</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Items</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Amount</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Date</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-6 w-20 mx-auto" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : currentReturns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    No vendor returns found
                  </td>
                </tr>
              ) : (
                currentReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">{ret.returnNumber}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{ret.vendorName}</td>
                    <td className="py-3 px-4 text-center text-sm text-gray-900">{ret.items.length}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">
                      ${ret.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <VendorReturnStatusBadge status={ret.status} />
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDate(ret.returnDate)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(ret)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {ret.status !== "completed" && (
                          <Select
                            value={ret.status}
                            onValueChange={(value) => handleStatusUpdate(ret.id, value)}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="shipped">Shipped</SelectItem>
                              <SelectItem value="received_by_vendor">Received</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && filteredReturns.length > 0 && (
          <div className="mt-4">
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              totalItems={filteredReturns.length}
            />
          </div>
        )}
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vendor Return Details - {selectedReturn?.returnNumber}</DialogTitle>
            <DialogDescription>
              Complete information about this return to vendor
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-6">
              {/* Vendor Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Vendor</p>
                  <p className="text-sm text-gray-900">{selectedReturn.vendorName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <div className="mt-1">
                    <VendorReturnStatusBadge status={selectedReturn.status} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Credit Type</p>
                  <p className="text-sm text-gray-900 capitalize">{selectedReturn.creditType.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Return Date</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedReturn.returnDate)}</p>
                </div>
                {selectedReturn.completedDate && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Completed Date</p>
                    <p className="text-sm text-gray-900">{formatDate(selectedReturn.completedDate)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700">Created By</p>
                  <p className="text-sm text-gray-900">{selectedReturn.createdBy}</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Return Items</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Product</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-700">Qty</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Unit Price</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Total</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedReturn.items.map((item: any, index: number) => (
                        <tr key={index}>
                          <td className="py-2 px-3 text-sm">
                            <div>
                              <p className="font-medium text-gray-900">{item.productName}</p>
                              {item.variantName && (
                                <p className="text-xs text-gray-500">{item.variantName}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center text-sm">{item.quantity}</td>
                          <td className="py-2 px-3 text-right text-sm">${item.unitPrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-sm font-medium">
                            ${item.totalPrice.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-sm text-gray-600">{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Credit Amount</p>
                  <p className="text-2xl font-bold text-gray-900">${selectedReturn.totalAmount.toFixed(2)}</p>
                </div>
              </div>

              {/* Notes */}
              {selectedReturn.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedReturn.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Return Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        {/* <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto"> */}
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">

        {/* <DialogContent className="sm:max-w-5xl p-0 gap-0 max-h-[90vh] flex flex-col bg-white"> */}

          <DialogHeader>
            <DialogTitle>Create New Vendor Return</DialogTitle>
            <DialogDescription>
              Initiate a return of products to the vendor for credit or refund
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Vendor Selection and Date */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Vendor *</Label>
                <Select value={formData.vendorId} onValueChange={(value) => setFormData({...formData, vendorId: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Return Date *</Label>
                <Input
                  type="date"
                  value={formData.returnDate}
                  onChange={(e) => setFormData({...formData, returnDate: e.target.value})}
                />
              </div>
              <div>
                <Label>Credit Type *</Label>
                <Select value={formData.creditType} onValueChange={(value: any) => setFormData({...formData, creditType: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refund">Refund</SelectItem>
                    <SelectItem value="credit_note">Credit Note</SelectItem>
                    <SelectItem value="replacement">Replacement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Return Items *</Label>
                <Button type="button" onClick={handleAddItem} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-4">
                        <Label className="text-xs">Product</Label>
                        <Select 
                          value={item.productId} 
                          onValueChange={(value) => handleItemChange(index, 'productId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="col-span-2">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      
                      <div className="col-span-3">
                        <Label className="text-xs">Reason</Label>
                        <Select 
                          value={item.reason} 
                          onValueChange={(value) => handleItemChange(index, 'reason', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                          <SelectContent>
                            {RETURN_REASONS.map((reason) => (
                              <SelectItem key={reason} value={reason}>
                                {reason}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="col-span-2 flex items-end">
                        <div className="text-sm">
                          <div className="text-xs text-gray-500 mb-1">Total</div>
                          <div className="font-semibold">
                            ${((products.find(p => p.id === item.productId)?.salePrice || products.find(p => p.id === item.productId)?.price || 0) * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="col-span-1 flex items-end justify-end">
                        {formData.items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Add any additional notes about this return..."
                rows={3}
              />
            </div>

            {/* Total */}
            <div className="flex justify-end pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Return Amount</p>
                <p className="text-2xl font-bold text-gray-900">${calculateTotal().toFixed(2)}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReturn} className="bg-emerald-600 hover:bg-emerald-700">
              Create Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
