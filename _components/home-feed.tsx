/**
 * @description
 * Client-side component that fetches and displays trips based on filter parameters using infinite scrolling.
 * It fetches an initial batch of trips and then loads more as the user scrolls down the page.
 * Renders trip cards or appropriate loading/error/empty states.
 * FIXED: Corrected the initialization of the `useRef` hook for the IntersectionObserver to resolve a TypeScript error.
 * UPDATED: Passes the new `isLiked` and `isWishlisted` props to the `TripCard` component to prevent N+1 data fetching on the client.
 *
 * Key features:
 * - Implements infinite scrolling using `IntersectionObserver` for efficient data loading.
 * - Fetches filtered trips in batches from the API endpoint.
 * - Handles initial loading, subsequent loading ("load more"), error, and empty states gracefully.
 * - Renders trip data using the reusable `TripCard` component.
 *
 * @dependencies
 * - react: For hooks, state management, and refs.
 * - next/navigation: For routing.
 * - @/app/_components/trip-card: For rendering individual trips.
 * - @/components/ui/skeleton: For loading states.
 * - @/components/ui/button: For UI elements.
 * - @/actions/db/trips-actions: For `SelectFilteredItinerary` type.
 *
 * @notes
 * - This component is client-side to handle the fetch lifecycle and user interaction.
 * - The actual database query is performed in the server-side API route it calls.
 */
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { TripCard } from "./trip-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { SelectFilteredItinerary } from "@/actions/db/trips-actions"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 9 // Number of trips to fetch per batch

interface TripFilters {
  tripType: string | null
  maxBudget: number | null
  minGroupSize: number | null
  maxGroupSize: number | null
  startDate: string | null
  endDate: string | null
  location: string | null
  tripPreferences: string[]
  status: "upcoming" | "ongoing" | "completed" | null
  visibility: string | null
  sortBy?: "createdAt" | "likes" | "startDate"
}

interface HomeFeedProps {
  filters: TripFilters
  userId: string | null | undefined
}

export function HomeFeed({ filters, userId }: HomeFeedProps) {
  const [trips, setTrips] = useState<SelectFilteredItinerary[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true) // For initial page load
  const [loadingMore, setLoadingMore] = useState(false) // For subsequent infinite scroll loads
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const observer = useRef<IntersectionObserver | null>(null)
  const loaderRef = useCallback(
    (node: HTMLDivElement) => {
      if (loading) return
      if (observer.current) observer.current.disconnect()
      observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setOffset(prevOffset => prevOffset + PAGE_SIZE)
        }
      })
      if (node) observer.current.observe(node)
    },
    [loading, hasMore, loadingMore]
  )

  const fetchPage = useCallback(
    async (currentOffset: number) => {
      if (currentOffset === 0) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }
      setError(null)

      try {
        const params = new URLSearchParams()
        if (filters.tripType) params.set("tripType", filters.tripType)
        if (filters.maxBudget)
          params.set("maxBudget", filters.maxBudget.toString())
        if (filters.maxGroupSize !== null)
          params.set("maxGroupSize", filters.maxGroupSize.toString())
        if (filters.startDate) params.set("startDate", filters.startDate)
        if (filters.endDate) params.set("endDate", filters.endDate)
        if (filters.location) params.set("location", filters.location)
        if (filters.status) params.set("status", filters.status)
        if (filters.sortBy) params.set("sortBy", filters.sortBy)
        filters.tripPreferences.forEach(pref =>
          params.append("preference", pref)
        )
        params.set("limit", String(PAGE_SIZE))
        params.set("offset", String(currentOffset))

        const response = await fetch(
          `/api/trips/filterered?${params.toString()}`
        )
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Failed to parse error response" }))
          throw new Error(
            errorData.error || `HTTP error! status: ${response.status}`
          )
        }

        const data = await response.json()
        const newTrips = data.data || []

        if (currentOffset === 0) {
          setTrips(newTrips)
        } else {
          setTrips(prev => [...prev, ...newTrips])
        }

        setHasMore(newTrips.length === PAGE_SIZE)
      } catch (err) {
        console.error("[HomeFeed] Error fetching filtered trips:", err)
        setError(err instanceof Error ? err.message : "Could not load trips")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(filters)]
  )

  useEffect(() => {
    setTrips([])
    setOffset(0)
    setHasMore(true)
    fetchPage(0)
  }, [fetchPage])

  useEffect(() => {
    if (offset > 0) {
      fetchPage(offset)
    }
  }, [offset, fetchPage])

  const handleViewTrip = (tripId: string) => {
    router.push(`/trips/${tripId}`)
  }
  const handleJoinTrip = (tripId: string) => {
    router.push(`/trips/${tripId}?action=join`)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <div className="py-12 text-center">
        <h2 className="mb-2 text-xl font-semibold text-red-600">
          Error Loading Trips
        </h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => fetchPage(0)} variant="outline">
          Try Again
        </Button>
      </div>
    )
  }
  if (trips.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="mb-4 size-12 text-gray-300"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
        <h2 className="mb-2 text-xl font-semibold text-gray-700">
          No Trips Found
        </h2>
        <p className="text-muted-foreground mb-6 max-w-sm">
          No trips match your current filters. Try adjusting your search or
          create a new adventure!
        </p>
        <div className="flex gap-4">
          <Link
            href="/trips/new"
            className={cn(
              buttonVariants({ className: "bg-gradient-1 text-white" })
            )}
          >
            Create a Trip
          </Link>
        </div>
      </div>
    )
  }
  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
        {trips.map(trip => (
          <TripCard
            key={trip.id}
            trip={trip}
            userId={userId}
            onView={handleViewTrip}
            onJoin={handleJoinTrip}
            isMember={trip.isMember}
            isRequestPending={trip.isRequestPending}
            isLiked={trip.isLiked}
            isWishlisted={trip.isWishlisted}
          />
        ))}
        {loadingMore &&
          Array.from({ length: 3 }).map((_, index) => (
            <CardSkeleton key={`loader-${index}`} />
          ))}
      </div>
      <div ref={loaderRef} className="h-10 w-full">
        {!hasMore && trips.length > 0 && (
          <p className="py-8 text-center text-sm text-gray-500">
            No more trips to load.
          </p>
        )}
      </div>
    </>
  )
}

const CardSkeleton = () => (
  <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
    <Skeleton className="relative h-48 w-full shrink-0" />
    <div className="flex flex-1 flex-col justify-between p-4">
      <div className="mb-3 space-y-2">
        <Skeleton className="h-4 w-3/4" /> <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <div className="mt-auto flex gap-2 pt-2">
        <Skeleton className="h-9 flex-1 rounded-md" />
      </div>
    </div>
  </div>
)
