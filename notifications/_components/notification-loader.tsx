"use client"

import React, { useState, useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { markNotificationsAsReadAction } from "@/actions/db/notifications-actions"
import { NotificationsList } from "./notifications-list"
import { NotificationItem } from "../page"
import { useNotificationContext } from "@/lib/context/notification-context"

function NotificationsPageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  )
}

interface NotificationLoaderProps {
  userId: string
  initialNotifications: NotificationItem[]
}

export function NotificationLoader({
  userId,
  initialNotifications
}: NotificationLoaderProps) {
  const [notifications] = useState<NotificationItem[]>(initialNotifications)
  const { setUnreadCount, decrementCount } = useNotificationContext()

  useEffect(() => {
    let isMounted = true

    const markAsRead = async () => {
      try {
        await markNotificationsAsReadAction(userId)
        if (isMounted) {
          // After successfully marking as read on the server, update the client state.
          setUnreadCount(0)
        }
      } catch (error) {
        console.error("Failed to mark notifications as read on client:", error)
      }
    }

    // Only mark as read if there were initial notifications to clear.
    if (initialNotifications.length > 0) {
      markAsRead()
    } else {
      // If there are no initial notifications, ensure the count is 0.
      setUnreadCount(0)
    }

    return () => {
      isMounted = false
    }
  }, [userId, initialNotifications.length, setUnreadCount])

  return (
    <NotificationsList
      notifications={notifications}
      currentUserId={userId}
      onNotificationDismissed={decrementCount}
    />
  )
}
