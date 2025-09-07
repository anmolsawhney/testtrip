/**
 * @description
 * Skeleton component for the Follow Requests page.
 * Displays placeholder UI elements while follow request data is loading.
 * Mimics the layout of the incoming and outgoing request sections.
 * Marked as `async` to comply with "use server" requirements.
 *
 * @dependencies
 * - @/components/ui/skeleton: Shadcn Skeleton component for placeholders.
 */
"use server" // Requires the function to be async

import { Skeleton } from "@/components/ui/skeleton"

// Add async keyword here
export default async function FollowRequestSkeleton() {
  return (
    <div className="space-y-8">
      {/* Incoming Requests Skeleton */}
      <div>
        <Skeleton className="mb-4 h-6 w-48" /> {/* Title skeleton */}
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div
              key={`incoming-skel-${i}`}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-4">
                <Skeleton className="size-12 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20" /> {/* Reject Button Skeleton */}
                <Skeleton className="h-9 w-20" /> {/* Accept Button Skeleton */}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Outgoing Requests Skeleton */}
      <div>
        <Skeleton className="mb-4 h-6 w-48" /> {/* Title skeleton */}
        <div className="space-y-4">
          {[...Array(1)].map((_, i) => (
            <div
              key={`outgoing-skel-${i}`}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-4">
                <Skeleton className="size-12 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-9 w-20" /> {/* Cancel Button Skeleton */}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
