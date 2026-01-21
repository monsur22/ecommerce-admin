"use client"

import { useState, useMemo } from "react"
import { useCustomerReturn } from "@/contexts/customer-return-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { Textarea } from "@/components/ui/textarea"
import { Search, Check, X, Eye, Download, RotateCcw } from "lucide-react"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Skeleton } from "@/components/ui/skeleton"

// Status badge component
function ReturnStatusBadge({ status }: { status: string }) {
  const config = {
    pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pending' },
    approved: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Approved' },
    rejected: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Rejected' },
    completed: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Completed' },
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

export default function CustomerReturnsPage() {
  const { returns, approveReturn, rejectReturn, getReturnStats } = useCustomerReturn()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")

  const stats = getReturnStats()

  // Filter returns
  const filteredReturns = useMemo(() => {
    return returns.filter((ret) => {
      const matchesSearch = 
        ret.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = statusFilter === "all" || ret.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [returns, searchQuery, statusFilter])

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

  const handleApproveClick = (returnItem: any) => {
    setSelectedReturn(returnItem)
    setIsApproveDialogOpen(true)
  }

  const handleRejectClick = (returnItem: any) => {
    setSelectedReturn(returnItem)
    setRejectNotes("")
    setIsRejectDialogOpen(true)
  }

  const confirmApprove = () => {
    if (selectedReturn) {
      approveReturn(selectedReturn.id, "Admin")
      setIsApproveDialogOpen(false)
      setSelectedReturn(null)
    }
  }

  const confirmReject = () => {
    if (selectedReturn) {
      rejectReturn(selectedReturn.id, "Admin", rejectNotes)
      setIsRejectDialogOpen(false)
      setSelectedReturn(null)
      setRejectNotes("")
    }
  }

  const handleDownloadReport = () => {
    const csvContent = [
      ["Return #", "Customer", "Order #", "Items", "Amount", "Status", "Date"],
      ...filteredReturns.map((ret) => [
        ret.returnNumber,
        ret.customerName,
        ret.orderNumber || "N/A",
        ret.items.length.toString(),
        `$${ret.totalAmount.toFixed(2)}`,
        ret.status,
        formatDate(ret.requestDate),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `customer-returns-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Returns</h1>
          <p className="text-gray-600 mt-1">Manage product returns from customers</p>
        </div>
        <Button onClick={handleDownloadReport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Returns</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <RotateCcw className="w-8 h-8 text-gray-400" />
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
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Refunds</p>
              <p className="text-2xl font-bold text-blue-600">${stats.totalRefundAmount.toFixed(2)}</p>
            </div>
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
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
              placeholder="Search by return #, customer, or order #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
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
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Customer</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Order #</th>
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
                    <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-6 w-20 mx-auto" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : currentReturns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    No returns found
                  </td>
                </tr>
              ) : (
                currentReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">{ret.returnNumber}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{ret.customerName}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{ret.orderNumber || "N/A"}</td>
                    <td className="py-3 px-4 text-center text-sm text-gray-900">{ret.items.length}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">
                      ${ret.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <ReturnStatusBadge status={ret.status} />
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDate(ret.requestDate)}
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
                        {ret.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApproveClick(ret)}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRejectClick(ret)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
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
            <DialogTitle>Return Details - {selectedReturn?.returnNumber}</DialogTitle>
            <DialogDescription>
              Complete information about this return request
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-6">
              {/* Customer & Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Customer</p>
                  <p className="text-sm text-gray-900">{selectedReturn.customerName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Order Number</p>
                  <p className="text-sm text-gray-900">{selectedReturn.orderNumber || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <div className="mt-1">
                    <ReturnStatusBadge status={selectedReturn.status} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Refund Method</p>
                  <p className="text-sm text-gray-900 capitalize">{selectedReturn.refundMethod.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Request Date</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedReturn.requestDate)}</p>
                </div>
                {selectedReturn.processedDate && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Processed Date</p>
                    <p className="text-sm text-gray-900">{formatDate(selectedReturn.processedDate)}</p>
                  </div>
                )}
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
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Price</th>
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
                          <td className="py-2 px-3 text-right text-sm font-medium">
                            ${(item.price * item.quantity).toFixed(2)}
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
                  <p className="text-sm text-gray-600">Total Refund Amount</p>
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

      {/* Approve Confirmation Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Return?</DialogTitle>
            <DialogDescription>
              This will approve the return and process the refund. The items will be added back to inventory.
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Return #:</span> {selectedReturn.returnNumber}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Customer:</span> {selectedReturn.customerName}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Refund Amount:</span> ${selectedReturn.totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmApprove} className="bg-green-600 hover:bg-green-700">
              Approve Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Return?</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this return request.
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Return #:</span> {selectedReturn.returnNumber}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Customer:</span> {selectedReturn.customerName}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Rejection Reason
                </label>
                <Textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmReject} 
              className="bg-red-600 hover:bg-red-700"
              disabled={!rejectNotes.trim()}
            >
              Reject Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
