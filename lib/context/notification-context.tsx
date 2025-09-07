"use client"

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback
} from "react"

/**
 * @description
 * Defines the shape of the Notification Context.
 * - unreadCount: The current number of unread notifications.
 * - setUnreadCount: Function to set the count to a specific number.
 * - decrementCount: Function to decrease the count by a given amount (default 1).
 */
interface NotificationContextType {
  unreadCount: number
  setUnreadCount: (count: number) => void
  decrementCount: (amount?: number) => void
}

// Create the context with an undefined default value.
const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
)

/**
 * @description
 * Custom hook to consume the NotificationContext.
 * Ensures that the hook is used within a component wrapped by NotificationProvider.
 * @returns The notification context values.
 * @throws Error if used outside of a NotificationProvider.
 */
export const useNotificationContext = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error(
      "useNotificationContext must be used within a NotificationProvider"
    )
  }
  return context
}

/**
 * @description
 * Props for the NotificationProvider component.
 */
interface NotificationProviderProps {
  children: ReactNode // The children components to be wrapped by the provider.
  initialCount: number // The initial unread count fetched from the server.
}

/**
 * @description
 * A client-side React Context Provider that manages the global state for the
 * unread notification count. It initializes the count with a server-fetched value
 * and provides functions to update it from any child component.
 *
 * @param {NotificationProviderProps} props - The component props.
 */
export const NotificationProvider = ({
  children,
  initialCount
}: NotificationProviderProps) => {
  // State to hold the unread notification count, initialized from server-fetched prop.
  const [unreadCount, setUnreadCount] = useState(initialCount)

  /**
   * @description
   * A memoized callback to decrement the unread count by a specified amount.
   * Ensures the count never goes below zero.
   * @param {number} [amount=1] - The number to decrement the count by.
   */
  const decrementCount = useCallback((amount = 1) => {
    setUnreadCount(prev => Math.max(0, prev - amount))
  }, [])

  // The value object provided to consuming components.
  const value = {
    unreadCount,
    setUnreadCount,
    decrementCount
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
