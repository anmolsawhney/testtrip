/**
 * @description
 * This server component provides a skeleton loading state for the forum's post feed.
 * It mimics the layout of the `PostItem` component to create a smooth loading experience
 * while the initial data is being fetched.
 *
 * Key features:
 * - Renders a series of placeholder cards.
 * - Each card mimics the structure of a real `PostItem` with vote buttons, author info, and content lines.
 *
 * @dependencies
 * - @/components/ui/skeleton: The base skeleton component from Shadcn.
 *
 * @notes
 * - This is a server component as it requires no client-side interactivity.
 * - It is used as a fallback in a React Suspense boundary on the main forum page.
 */
"use server"

import { Skeleton } from "@/components/ui/skeleton"

export default async function PostFeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-card flex rounded-lg border shadow-sm">
          {/* Vote Section Skeleton */}
          <div className="bg-muted/50 flex flex-col items-center gap-2 p-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 w-6 rounded" />
            <Skeleton className="size-8 rounded-full" />
          </div>
          {/* Content Section Skeleton */}
          <div className="flex-1 space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
            <Skeleton className="h-5 w-3/4 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <Skeleton className="h-8 w-32 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
