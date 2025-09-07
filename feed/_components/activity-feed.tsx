/**
 * @description
 * Client component that renders the main interactive Activity Feed.
 * It displays activities from followed users or the current user's own activities,
 * supports filtering between these views, and implements pagination ("Load More").
 * Passes the current filter down to ActivityCard to control UI elements.
 *
 * @dependencies
 * - react: For state management (useState, useEffect) and hooks.
 * - @/actions/db/activity-feed-actions: Server action to fetch feed data.
 * - @/types: For `FeedActivityItem` type definition.
 * - ./activity-card: Component to render individual feed items.
 * - @/components/ui/tabs: For filter tabs.
 * - @/components/ui/button: For "Load More" button.
 * - @/components/ui/skeleton: Used indirectly via ActivityCard or potential loading states.
 * - lucide-react: For icons (Loader2).
 *
 * @notes
 * - Fetches data client-side when filters change or "Load More" is clicked.
 * - Uses pagination to load data incrementally.
 * - Displays loading indicators during data fetching.
 * - Handles empty states for the feed.
 */
"use client"

import React, { useState, useEffect, useCallback, useTransition } from "react"
import { getActivityFeedAction } from "@/actions/db/activity-feed-actions"
import { FeedActivityItem } from "@/types"
import ActivityCard from "./activity-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Loader2, BellOff } from "lucide-react" // Added BellOff for empty state
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
const FEED_PAGE_LIMIT = 15 // Number of items to fetch per "Load More" click

interface ActivityFeedProps {
  initialActivities: FeedActivityItem[]
  userId: string
  initialHasMore: boolean // Whether there might be more data initially
}

export default function ActivityFeed({
  initialActivities,
  userId,
  initialHasMore
}: ActivityFeedProps) {
  const [activities, setActivities] =
    useState<FeedActivityItem[]>(initialActivities)
  const [filter, setFilter] = useState<"following" | "my_activity">("following")
  const [offset, setOffset] = useState<number>(initialActivities.length) // Start offset after initial load
  const [hasMore, setHasMore] = useState<boolean>(initialHasMore)
  const [isLoading, setIsLoading] = useState<boolean>(false) // For "Load More" loading state
  const [isFilterLoading, setIsFilterLoading] = useState<boolean>(false) // For filter change loading state
  const [isPending, startTransition] = useTransition() // For smoother UI updates on filter change

  // Function to fetch activities based on current filter and offset
  const fetchActivities = useCallback(
    async (
      currentFilter: "following" | "my_activity",
      currentOffset: number,
      replace: boolean = false
    ) => {
      console.log(
        `Fetching activities: Filter=${currentFilter}, Offset=${currentOffset}, Replace=${replace}`
      )
      // Set appropriate loading state
      if (replace) {
        setIsFilterLoading(true)
      } else {
        setIsLoading(true) // Loading more
      }

      // Define result variable outside try block so it's accessible in finally
      let fetchResult: any = { data: [] }

      try {
        const result = await getActivityFeedAction(
          currentFilter,
          FEED_PAGE_LIMIT,
          currentOffset
        )
        fetchResult = result // Store result for use in finally block

        if (result.isSuccess && result.data) {
          const newActivities = result.data
          console.log(`Fetched ${newActivities.length} new activities.`)
          startTransition(() => {
            setActivities(prev =>
              replace ? newActivities : [...prev, ...newActivities]
            )
            setOffset(currentOffset + newActivities.length)
            setHasMore(newActivities.length === FEED_PAGE_LIMIT) // Check if more might exist
          })
        } else {
          console.error("Failed to fetch activities:", result.message)
          setHasMore(false) // Assume no more data on error
          // Optionally show a toast or error message
        }
      } catch (error) {
        console.error("Error calling getActivityFeedAction:", error)
        setHasMore(false) // Assume no more data on error
      } finally {
        if (replace) {
          setIsFilterLoading(false)
        } else {
          setIsLoading(false)
        }
        // Use fetchResult instead of result
        console.log(
          `Fetch complete. New Offset: ${currentOffset + (fetchResult.data?.length ?? 0)}, HasMore: ${activities.length + (fetchResult.data?.length ?? 0) > 0 && (fetchResult.data?.length ?? 0) === FEED_PAGE_LIMIT}`
        )
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [userId]
  ) // Depend only on userId, filter/offset are passed as args

  // Handler for changing the filter tab
  const handleFilterChange = (newFilter: "following" | "my_activity") => {
    if (newFilter === filter || isFilterLoading) return // Prevent refetch if filter hasn't changed or already loading
    console.log("Filter changed to:", newFilter)
    setFilter(newFilter)
    setOffset(0) // Reset offset
    setActivities([]) // Clear existing activities immediately for filter change
    setHasMore(true) // Assume there might be data for the new filter
    fetchActivities(newFilter, 0, true) // Fetch new data, replacing current set
  }

  // Handler for the "Load More" button
  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      fetchActivities(filter, offset) // Fetch next page
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <Tabs
        value={filter}
        onValueChange={value =>
          handleFilterChange(value as "following" | "my_activity")
        }
        className="w-full justify-center"
      >
        <TabsList className="glass mx-auto grid w-full max-w-xs grid-cols-2 rounded-full p-1">
          <TabsTrigger
            value="following"
            className="data-[state=active]:bg-gradient-1 flex items-center gap-2 rounded-full transition-all duration-300 data-[state=active]:text-white"
            disabled={isFilterLoading}
          >
            Following
          </TabsTrigger>
          <TabsTrigger
            value="my_activity"
            className="data-[state=active]:bg-gradient-1 flex items-center gap-2 rounded-full transition-all duration-300 data-[state=active]:text-white"
            disabled={isFilterLoading}
          >
            My Activity
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Activity List */}
      {isFilterLoading ? (
        // Show skeleton cards while filter is changing
        <div className="space-y-4 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={`filter-skel-${i}`} className="p-4 opacity-50">
              <CardContent className="flex items-start space-x-4 p-0">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-3 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : activities.length === 0 ? (
        // Empty state message
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <BellOff className="mb-4 size-12 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700">
            {filter === "following"
              ? "No Activity From Following Yet"
              : "No Activity Yet"}
          </h2>
          <p className="mt-2 text-gray-500">
            {filter === "following"
              ? "Follow users to see their updates here."
              : "Your recent activities will appear here."}
          </p>
        </div>
      ) : (
        // Render activity cards
        <div className="space-y-4">
          {activities.map(activity => (
            <ActivityCard
              key={`${activity.event.id}-${activity.event.createdAt}`}
              activity={activity}
              filter={filter} // Pass the current filter to the card
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && !isFilterLoading && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleLoadMore}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
      {!hasMore && activities.length > 0 && !isFilterLoading && (
        <p className="text-muted-foreground pt-4 text-center text-sm">
          No more activities to load.
        </p>
      )}
    </div>
  )
}
