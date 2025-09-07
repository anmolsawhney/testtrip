/**
 * @description
 * Skeleton component for the Direct Message Chat Interface page (/chat/[conversationId]).
 * Provides a visual placeholder while initial messages and participant data are loading.
 * Mimics the chat layout including header, message bubbles, and input area.
 * UPDATED: The layout is now fully responsive, using a flexible height (`h-full`) to match the parent container.
 *
 * @dependencies
 * - @/components/ui/skeleton: Shadcn Skeleton component.
 */
"use server"

import { Skeleton } from "@/components/ui/skeleton"

export default async function ChatInterfaceSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-lg border bg-white">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4 border-b p-4">
        <Skeleton className="size-10 rounded-full" /> {/* Avatar */}
        <div className="space-y-1">
          <Skeleton className="h-5 w-32" /> {/* Name */}
          <Skeleton className="h-3 w-20" /> {/* Status */}
        </div>
        <Skeleton className="ml-auto size-8 rounded-md" /> {/* Action Button */}
      </div>

      {/* Message List Skeleton */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Message from other */}
        <div className="flex items-end gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-16 w-2/3 rounded-lg" />
        </div>
        {/* Message from self */}
        <div className="flex items-end justify-end gap-2">
          <Skeleton className="h-12 w-1/2 rounded-lg" />
          <Skeleton className="size-8 rounded-full" />
        </div>
        {/* Message from other */}
        <div className="flex items-end gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-10 w-3/4 rounded-lg" />
        </div>
      </div>

      {/* Input Area Skeleton */}
      <div className="flex items-center gap-2 border-t p-4">
        <Skeleton className="h-10 flex-1 rounded-md" /> {/* Textarea */}
        <Skeleton className="h-10 w-20 rounded-md" /> {/* Send Button */}
      </div>
    </div>
  )
}
