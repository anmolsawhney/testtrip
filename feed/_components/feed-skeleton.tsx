/**
 * @description
 * Skeleton component for the Activity Feed page. Displays placeholder UI elements
 * while the feed data is loading, providing a better user experience.
 * Mimics the new social media post layout of the feed cards.
 *
 * @dependencies
 * - @/components/ui/skeleton: Shadcn Skeleton component for placeholders.
 * - @/components/ui/card: For card structure.
 */
"use server" // Can be a server component as it doesn't need client-side interactivity

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default async function FeedSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter Tabs Skeleton */}
      <div className="flex justify-center">
        <Skeleton className="h-10 w-1/2 max-w-xs rounded-full" />
      </div>

      {/* Activity Card Skeletons */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={`skel-${i}`} className="overflow-hidden">
            {/* Header Skeleton */}
            <CardHeader className="flex flex-row items-center space-x-3 p-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </CardHeader>
            {/* Content Skeleton */}
            <CardContent className="space-y-2 px-3 pb-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              {/* Simulate a potential image */}
              <Skeleton className="mt-2 h-40 w-full rounded-md" />
            </CardContent>
            {/* Optional Footer Skeleton */}
            {/* <CardFooter className="border-t p-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-20" />
            </CardFooter> */}
          </Card>
        ))}
      </div>

      {/* Load More Button Skeleton (Optional) */}
      <div className="flex justify-center pt-4">
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  )
}
