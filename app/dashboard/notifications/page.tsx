"use client"

import { useState, useMemo } from "react"
import { Mail, Trash2, ShoppingCart, AlertTriangle, DollarSign, Settings, CheckCheck, Eye, ExternalLink, Bell, Filter } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

type NotificationType = 'order' | 'stock_alert' | 'payment' | 'system'
type NotificationPriority = 'low' | 'medium' | 'high'

interface Notification {
  id: number
  user: string
  amount?: number
  avatar: string
  time: string
  read: boolean
  type: NotificationType
  priority: NotificationPriority
  message: string
  actionUrl?: string
}

// Helper function to get relative time
function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

// Notification type configuration
const notificationTypes = {
  order: { icon: ShoppingCart, color: 'emerald', label: 'New Order' },
  stock_alert: { icon: AlertTriangle, color: 'orange', label: 'Stock Alert' },
  payment: { icon: DollarSign, color: 'blue', label: 'Payment' },
  system: { icon: Settings, color: 'gray', label: 'System' }
}

// Priority configuration
const priorityConfig = {
  high: { color: 'red', label: 'High Priority' },
  medium: { color: 'yellow', label: 'Medium' },
  low: { color: 'gray', label: 'Low' }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      user: "Nevil Nevil",
      amount: 253.26,
      avatar: "/admin-avatar.jpg",
      time: "2026-01-21T11:29:00",
      read: false,
      type: "order",
      priority: "high",
      message: "placed an order of $253.26",
      actionUrl: "/dashboard/orders"
    },
    {
      id: 2,
      user: "System",
      avatar: "/placeholder.svg",
      time: "2026-01-21T10:57:00",
      read: false,
      type: "stock_alert",
      priority: "high",
      message: "Fresh Mustard Oil is running low (5 items remaining)",
      actionUrl: "/dashboard/inventory"
    },
    {
      id: 3,
      user: "TEJPAL SONI",
      amount: 166.49,
      avatar: "/marion-avatar.jpg",
      time: "2026-01-20T13:17:00",
      read: false,
      type: "order",
      priority: "medium",
      message: "placed an order of $166.49",
      actionUrl: "/dashboard/orders"
    },
    {
      id: 4,
      user: "Payment Gateway",
      amount: 660.0,
      avatar: "/placeholder.svg",
      time: "2026-01-20T12:26:00",
      read: true,
      type: "payment",
      priority: "medium",
      message: "Payment of $660.00 received successfully",
      actionUrl: "/dashboard/orders"
    },
    {
      id: 5,
      user: "Justinn Luish",
      amount: 265.01,
      avatar: "/stacey-avatar.jpg",
      time: "2026-01-19T20:37:00",
      read: true,
      type: "order",
      priority: "low",
      message: "placed an order of $265.01",
      actionUrl: "/dashboard/orders"
    },
    {
      id: 6,
      user: "System",
      avatar: "/placeholder.svg",
      time: "2026-01-19T15:22:00",
      read: true,
      type: "system",
      priority: "low",
      message: "Database backup completed successfully",
    },
    {
      id: 7,
      user: "System",
      avatar: "/placeholder.svg",
      time: "2026-01-18T09:00:00",
      read: false,
      type: "stock_alert",
      priority: "medium",
      message: "Rainbow Chard stock is low (8 items remaining)",
      actionUrl: "/dashboard/inventory"
    }
  ])

  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([])
  const [filterStatus, setFilterStatus] = useState<string>("all") // all, read, unread
  const [filterType, setFilterType] = useState<string>("all") // all, order, stock_alert, payment, system
  const [sortOrder, setSortOrder] = useState<string>("newest") // newest, oldest

  // Filter and sort notifications
  const filteredNotifications = useMemo(() => {
    let filtered = [...notifications]

    // Filter by read status
    if (filterStatus === "read") {
      filtered = filtered.filter(n => n.read)
    } else if (filterStatus === "unread") {
      filtered = filtered.filter(n => !n.read)
    }

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter(n => n.type === filterType)
    }

    // Sort by date
    filtered.sort((a, b) => {
      const dateA = new Date(a.time).getTime()
      const dateB = new Date(b.time).getTime()
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB
    })

    // Sort by priority (high first) within same date
    filtered.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      if (!a.read && b.read) return -1
      if (a.read && !b.read) return 1
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })

    return filtered
  }, [notifications, filterStatus, filterType, sortOrder])

  const {
    currentItems: currentNotifications,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredNotifications, 10)

  const unreadCount = notifications.filter((n) => !n.read).length
  const selectedCount = selectedNotifications.length

  const handleSelectAll = () => {
    if (selectedNotifications.length === currentNotifications.length && currentNotifications.length > 0) {
      setSelectedNotifications([])
    } else {
      setSelectedNotifications(currentNotifications.map((n) => n.id))
    }
  }

  const handleSelectNotification = (id: number) => {
    setSelectedNotifications((prev) => (prev.includes(id) ? prev.filter((nId) => nId !== id) : [...prev, id]))
  }

  // Fixed: Only mark selected notifications as read
  const handleMarkSelectedAsRead = () => {
    if (selectedCount === 0) return
    setNotifications((prev) =>
      prev.map((n) => (selectedNotifications.includes(n.id) ? { ...n, read: true } : n))
    )
    setSelectedNotifications([])
  }

  // Mark all notifications as read
  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setSelectedNotifications([])
  }

  // Toggle individual notification read status
  const handleToggleRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    )
  }

  const handleDeleteNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    setSelectedNotifications((prev) => prev.filter((nId) => nId !== id))
  }

  const handleBulkDelete = () => {
    if (selectedCount === 0) return
    setNotifications((prev) => prev.filter((n) => !selectedNotifications.includes(n.id)))
    setSelectedNotifications([])
  }

  // Get notification icon and color
  const getNotificationIcon = (type: NotificationType) => {
    const config = notificationTypes[type]
    const Icon = config.icon
    return <Icon className="w-5 h-5" />
  }

  const getNotificationBadgeColor = (type: NotificationType) => {
    const colorMap: Record<string, string> = {
      emerald: 'bg-emerald-500',
      orange: 'bg-orange-500',
      blue: 'bg-blue-500',
      gray: 'bg-gray-500'
    }
    return colorMap[notificationTypes[type].color]
  }

  const getPriorityBadge = (priority: NotificationPriority) => {
    if (priority === 'low') return null
    const config = priorityConfig[priority]
    const colorMap: Record<string, string> = {
      red: 'bg-red-100 text-red-800 border-red-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
    return (
      <Badge variant="outline" className={`text-xs ${colorMap[config.color]}`}>
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-8 h-8 text-emerald-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-600">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        {/* Action Bar */}
        <div className="p-6 border-b space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              onClick={handleMarkSelectedAsRead} 
              variant="default" 
              className="bg-emerald-500 hover:bg-emerald-600"
              disabled={selectedCount === 0}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark Selected as Read {selectedCount > 0 && `(${selectedCount})`}
            </Button>
            <Button 
              onClick={handleMarkAllAsRead} 
              variant="outline"
              disabled={unreadCount === 0}
            >
              <Mail className="w-4 h-4 mr-2" />
              Mark All as Read
            </Button>
            {selectedCount > 0 && (
              <Button onClick={handleBulkDelete} variant="destructive" size="default">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({selectedCount})
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unread">Unread Only</SelectItem>
                <SelectItem value="read">Read Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="order">Orders</SelectItem>
                <SelectItem value="stock_alert">Stock Alerts</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Notifications List */}
        <div className="p-6">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No notifications found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="w-12 px-4 py-3 text-left">
                        <Checkbox
                          checked={selectedNotifications.length === currentNotifications.length && currentNotifications.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Notification
                      </th>
                      <th className="w-48 px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentNotifications.map((notification) => {
                      const TypeIcon = notificationTypes[notification.type].icon
                      return (
                        <tr 
                          key={notification.id} 
                          className={`hover:bg-gray-50 transition-colors ${
                            notification.read ? 'bg-gray-50/50 opacity-75' : 'bg-white'
                          }`}
                        >
                          <td className="px-4 py-4">
                            <Checkbox
                              checked={selectedNotifications.includes(notification.id)}
                              onCheckedChange={() => handleSelectNotification(notification.id)}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              {/* Unread Indicator */}
                              {!notification.read && (
                                <div className="flex-shrink-0 w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
                              )}
                              
                              {/* Avatar */}
                              <div className="relative flex-shrink-0">
                                <Image
                                  src={notification.avatar || "/placeholder.svg"}
                                  alt={notification.user}
                                  width={40}
                                  height={40}
                                  className="rounded-full"
                                />
                                <div className={`absolute -bottom-1 -right-1 ${getNotificationBadgeColor(notification.type)} rounded-full p-1`}>
                                  {getNotificationIcon(notification.type)}
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${notification.read ? 'text-gray-600' : 'text-gray-900 font-medium'} mb-1`}>
                                  <span className="font-semibold">{notification.user}</span> {notification.message}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className={`text-xs ${getNotificationBadgeColor(notification.type)} text-white`}>
                                    {notificationTypes[notification.type].label}
                                  </Badge>
                                  {getPriorityBadge(notification.priority)}
                                  <span className="text-xs text-gray-500">
                                    {getRelativeTime(notification.time)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              {/* Toggle Read/Unread */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleRead(notification.id)}
                                title={notification.read ? "Mark as unread" : "Mark as read"}
                                className="h-8 w-8 p-0"
                              >
                                {notification.read ? (
                                  <Mail className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <Eye className="w-4 h-4 text-emerald-600" />
                                )}
                              </Button>

                              {/* Action Link */}
                              {notification.actionUrl && (
                                <Link href={notification.actionUrl}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    title="View details"
                                  >
                                    <ExternalLink className="w-4 h-4 text-blue-600" />
                                  </Button>
                                </Link>
                              )}

                              {/* Delete */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteNotification(notification.id)}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                title="Delete notification"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <PaginationControl
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  totalItems={filteredNotifications.length}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
