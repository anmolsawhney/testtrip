"use server" // Can be server component

/**
 * @description
 * Skeleton component for the Chat page (/chat).
 * Provides a visual placeholder while conversation data is loading.
 * Mimics the layout including tabs (Chats, Requests, Group Chats) and list item skeletons.
 *
 * @dependencies
 * - @/components/ui/skeleton: Shadcn Skeleton component.
 */

import { Skeleton } from "@/components/ui/skeleton"

export default async function ChatPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Tabs Skeleton - Adjusted width for three tabs */}
      <div className="flex justify-center">
        <Skeleton className="h-10 w-full max-w-md rounded-md" />{" "}
        {/* Wider skeleton for 3 tabs */}
      </div>

      {/* List Item Skeletons */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`chat-skel-${i}`}
            className="flex items-center space-x-4 rounded-lg border p-4"
          >
            <Skeleton className="size-12 rounded-full" /> {/* Avatar */}
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" /> {/* Name */}
              <Skeleton className="h-4 w-3/4" /> {/* Last message */}
            </div>
            <Skeleton className="h-4 w-16" /> {/* Timestamp */}
          </div>
        ))}
      </div>
    </div>
  )
}
