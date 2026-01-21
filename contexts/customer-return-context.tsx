"use client"

import React, { createContext, useContext, useState } from "react"
import { generateId } from "@/lib/export-import-utils"

export interface CustomerReturnItem {
  productId: string
  productName: string
  variantId?: string
  variantName?: string
  quantity: number
  price: number
  reason: string
}

export interface CustomerReturn {
  id: string
  returnNumber: string
  customerId: string
  customerName: string
  orderId?: string
  orderNumber?: string
  items: CustomerReturnItem[]
  totalAmount: number
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  requestDate: string
  processedDate?: string
  refundMethod: 'cash' | 'store_credit' | 'original_payment'
  notes?: string
  processedBy?: string
}

interface CustomerReturnContextType {
  returns: CustomerReturn[]
  addReturn: (returnData: Omit<CustomerReturn, 'id' | 'returnNumber' | 'requestDate'>) => void
  updateReturn: (id: string, updates: Partial<CustomerReturn>) => void
  deleteReturn: (id: string) => void
  approveReturn: (id: string, processedBy: string) => void
  rejectReturn: (id: string, processedBy: string, notes?: string) => void
  getReturnById: (id: string) => CustomerReturn | undefined
  getReturnsByCustomer: (customerId: string) => CustomerReturn[]
  getReturnStats: () => {
    total: number
    pending: number
    approved: number
    rejected: number
    completed: number
    totalRefundAmount: number
  }
}

const CustomerReturnContext = createContext<CustomerReturnContextType | undefined>(undefined)

// Sample data
const initialReturns: CustomerReturn[] = [
  {
    id: "ret_1",
    returnNumber: "RET-00001",
    customerId: "1",
    customerName: "John Doe",
    orderId: "12342",
    orderNumber: "12342",
    items: [
      {
        productId: "1",
        productName: "Premium T-Shirt",
        variantId: "v1",
        variantName: "Small / Red",
        quantity: 1,
        price: 450,
        reason: "Wrong size"
      }
    ],
    totalAmount: 450,
    status: "pending",
    requestDate: "2026-01-20T10:30:00",
    refundMethod: "original_payment",
    notes: "Customer ordered wrong size"
  },
  {
    id: "ret_2",
    returnNumber: "RET-00002",
    customerId: "2",
    customerName: "Jane Smith",
    orderId: "12336",
    orderNumber: "12336",
    items: [
      {
        productId: "2",
        productName: "Himalaya Powder",
        quantity: 2,
        price: 160,
        reason: "Defective product"
      }
    ],
    totalAmount: 320,
    status: "approved",
    requestDate: "2026-01-19T14:20:00",
    processedDate: "2026-01-20T09:15:00",
    refundMethod: "cash",
    processedBy: "Admin"
  }
]

export function CustomerReturnProvider({ children }: { children: React.ReactNode }) {
  const [returns, setReturns] = useState<CustomerReturn[]>(initialReturns)

  const generateReturnNumber = () => {
    const maxNumber = returns.reduce((max, ret) => {
      const num = parseInt(ret.returnNumber.split('-')[1])
      return num > max ? num : max
    }, 0)
    return `RET-${String(maxNumber + 1).padStart(5, '0')}`
  }

  const addReturn = (returnData: Omit<CustomerReturn, 'id' | 'returnNumber' | 'requestDate'>) => {
    const newReturn: CustomerReturn = {
      ...returnData,
      id: generateId(),
      returnNumber: generateReturnNumber(),
      requestDate: new Date().toISOString()
    }
    setReturns(prev => [newReturn, ...prev])
  }

  const updateReturn = (id: string, updates: Partial<CustomerReturn>) => {
    setReturns(prev => prev.map(ret => ret.id === id ? { ...ret, ...updates } : ret))
  }

  const deleteReturn = (id: string) => {
    setReturns(prev => prev.filter(ret => ret.id !== id))
  }

  const approveReturn = (id: string, processedBy: string) => {
    setReturns(prev => prev.map(ret => {
      if (ret.id === id) {
        return {
          ...ret,
          status: 'approved',
          processedDate: new Date().toISOString(),
          processedBy
        }
      }
      return ret
    }))
    
    // TODO: Integrate with inventory to restock items
    // TODO: Integrate with payment system to process refund
  }

  const rejectReturn = (id: string, processedBy: string, notes?: string) => {
    setReturns(prev => prev.map(ret => {
      if (ret.id === id) {
        return {
          ...ret,
          status: 'rejected',
          processedDate: new Date().toISOString(),
          processedBy,
          notes: notes || ret.notes
        }
      }
      return ret
    }))
  }

  const getReturnById = (id: string) => {
    return returns.find(ret => ret.id === id)
  }

  const getReturnsByCustomer = (customerId: string) => {
    return returns.filter(ret => ret.customerId === customerId)
  }

  const getReturnStats = () => {
    return {
      total: returns.length,
      pending: returns.filter(r => r.status === 'pending').length,
      approved: returns.filter(r => r.status === 'approved').length,
      rejected: returns.filter(r => r.status === 'rejected').length,
      completed: returns.filter(r => r.status === 'completed').length,
      totalRefundAmount: returns
        .filter(r => r.status === 'approved' || r.status === 'completed')
        .reduce((sum, r) => sum + r.totalAmount, 0)
    }
  }

  return (
    <CustomerReturnContext.Provider
      value={{
        returns,
        addReturn,
        updateReturn,
        deleteReturn,
        approveReturn,
        rejectReturn,
        getReturnById,
        getReturnsByCustomer,
        getReturnStats
      }}
    >
      {children}
    </CustomerReturnContext.Provider>
  )
}

export function useCustomerReturn() {
  const context = useContext(CustomerReturnContext)
  if (context === undefined) {
    throw new Error("useCustomerReturn must be used within a CustomerReturnProvider")
  }
  return context
}
