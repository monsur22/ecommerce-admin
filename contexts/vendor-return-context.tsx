"use client"

import React, { createContext, useContext, useState } from "react"
import { generateId } from "@/lib/export-import-utils"

export interface VendorReturnItem {
  productId: string
  productName: string
  variantId?: string
  variantName?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  reason: string
}

export interface VendorReturn {
  id: string
  returnNumber: string
  vendorId: string
  vendorName: string
  items: VendorReturnItem[]
  totalAmount: number
  status: 'pending' | 'shipped' | 'received_by_vendor' | 'completed'
  returnDate: string
  completedDate?: string
  creditType: 'refund' | 'credit_note' | 'replacement'
  notes?: string
  createdBy: string
}

interface VendorReturnContextType {
  returns: VendorReturn[]
  addReturn: (returnData: Omit<VendorReturn, 'id' | 'returnNumber' | 'returnDate'>) => void
  updateReturn: (id: string, updates: Partial<VendorReturn>) => void
  deleteReturn: (id: string) => void
  updateStatus: (id: string, status: VendorReturn['status']) => void
  getReturnById: (id: string) => VendorReturn | undefined
  getReturnsByVendor: (vendorId: string) => VendorReturn[]
  getReturnStats: () => {
    total: number
    pending: number
    shipped: number
    completed: number
    totalCreditAmount: number
  }
}

const VendorReturnContext = createContext<VendorReturnContextType | undefined>(undefined)

// Sample data
const initialReturns: VendorReturn[] = [
  {
    id: "vret_1",
    returnNumber: "VRT-00001",
    vendorId: "1",
    vendorName: "Fresh Foods Ltd",
    items: [
      {
        productId: "3",
        productName: "Green Leaf Lettuce",
        quantity: 10,
        unitPrice: 112.72,
        totalPrice: 1127.20,
        reason: "Damaged during shipping"
      }
    ],
    totalAmount: 1127.20,
    status: "completed",
    returnDate: "2026-01-18T10:00:00",
    completedDate: "2026-01-20T15:30:00",
    creditType: "credit_note",
    createdBy: "Admin",
    notes: "Vendor confirmed receipt and issued credit note"
  },
  {
    id: "vret_2",
    returnNumber: "VRT-00002",
    vendorId: "2",
    vendorName: "Best Electronics",
    items: [
      {
        productId: "2",
        productName: "Himalaya Powder",
        quantity: 5,
        unitPrice: 174.97,
        totalPrice: 874.85,
        reason: "Expired products"
      }
    ],
    totalAmount: 874.85,
    status: "shipped",
    returnDate: "2026-01-20T11:00:00",
    creditType: "refund",
    createdBy: "Admin",
    notes: "Awaiting vendor confirmation"
  }
]

export function VendorReturnProvider({ children }: { children: React.ReactNode }) {
  const [returns, setReturns] = useState<VendorReturn[]>(initialReturns)

  const generateReturnNumber = () => {
    const maxNumber = returns.reduce((max, ret) => {
      const num = parseInt(ret.returnNumber.split('-')[1])
      return num > max ? num : max
    }, 0)
    return `VRT-${String(maxNumber + 1).padStart(5, '0')}`
  }

  const addReturn = (returnData: Omit<VendorReturn, 'id' | 'returnNumber' | 'returnDate'>) => {
    const newReturn: VendorReturn = {
      ...returnData,
      id: generateId(),
      returnNumber: generateReturnNumber(),
      returnDate: new Date().toISOString()
    }
    setReturns(prev => [newReturn, ...prev])
    
    // TODO: Integrate with inventory to deduct items
    // TODO: Integrate with vendor context to update credits
  }

  const updateReturn = (id: string, updates: Partial<VendorReturn>) => {
    setReturns(prev => prev.map(ret => ret.id === id ? { ...ret, ...updates } : ret))
  }

  const deleteReturn = (id: string) => {
    setReturns(prev => prev.filter(ret => ret.id !== id))
  }

  const updateStatus = (id: string, status: VendorReturn['status']) => {
    setReturns(prev => prev.map(ret => {
      if (ret.id === id) {
        const updates: Partial<VendorReturn> = { status }
        if (status === 'completed') {
          updates.completedDate = new Date().toISOString()
        }
        return { ...ret, ...updates }
      }
      return ret
    }))
    
    // TODO: If status is 'completed', update vendor credit
  }

  const getReturnById = (id: string) => {
    return returns.find(ret => ret.id === id)
  }

  const getReturnsByVendor = (vendorId: string) => {
    return returns.filter(ret => ret.vendorId === vendorId)
  }

  const getReturnStats = () => {
    return {
      total: returns.length,
      pending: returns.filter(r => r.status === 'pending').length,
      shipped: returns.filter(r => r.status === 'shipped').length,
      completed: returns.filter(r => r.status === 'completed').length,
      totalCreditAmount: returns
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + r.totalAmount, 0)
    }
  }

  return (
    <VendorReturnContext.Provider
      value={{
        returns,
        addReturn,
        updateReturn,
        deleteReturn,
        updateStatus,
        getReturnById,
        getReturnsByVendor,
        getReturnStats
      }}
    >
      {children}
    </VendorReturnContext.Provider>
  )
}

export function useVendorReturn() {
  const context = useContext(VendorReturnContext)
  if (context === undefined) {
    throw new Error("useVendorReturn must be used within a VendorReturnProvider")
  }
  return context
}
