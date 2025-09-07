/**
 * @description
 * Modal component for trip filtering on the TripRizz homepage.
 * Displays comprehensive filter options and manages filter state.
 * Uses Flaticon icons.
 *
 * v2 Updates:
 * - Uses single slider for max group size.
 * - Status filter uses upcoming/ongoing/completed.
 * - Location uses autocomplete.
 * - Fetches real trip count based on filters.
 * v3 Updates:
 * - "Clear All" now immediately applies cleared filters and closes the modal.
 * - Corrected Activities/Interests filter to use the 'preference' URL parameter consistently.
 * UPDATED: Replaced categorical budget with a numerical slider for maxBudget.
 * UPDATED: Fetches user profile to conditionally pass data to child filter components.
 *
 * Key features:
 * - Full-screen modal with filter categories
 * - URL synchronization for filter state
 * - Real-time trip count update based on filters
 * - Sorting options for the trip feed.
 * - Recent searches and saved filters (localStorage)
 * - Filter tags for active filters
 * - Clear all and Show results actions
 *
 * @dependencies
 * - "react": For component rendering and state
 * - "next/navigation": For URL parameter handling
 * - "@/components/ui/*": Shadcn UI components
 * - Flaticon CSS: For icons
 * - "@/lib/hooks/use-toast": For user feedback
 * - "./filter-categories": Filter category components
 * - "@/actions/db/trips-actions": For fetching trip count.
 * - "@/actions/db/profiles-actions": For fetching user profile. // NEW
 * - @clerk/nextjs: For getting viewerId
 * - "@/types": For `SelectProfile` type. // NEW
 */

"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useToast } from "@/lib/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import {
  TripTypeFilter,
  BudgetFilter,
  GroupSizeFilter,
  DateRangeFilter,
  LocationFilter,
  ActivitiesFilter,
  StatusFilter,
  SortByFilter
} from "./filter-categories"
import { getFilteredTripsCountAction } from "@/actions/db/trips-actions"
import { getProfileByUserIdAction } from "@/actions/db/profiles-actions" // Import profile action
import { useAuth } from "@clerk/nextjs"
import { SelectProfile } from "@/types" // Import type

interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
}

// Updated Filter state interface
interface FilterState {
  tripType: string | null
  maxBudget: number | null
  maxGroupSize: number | null
  startDate: string | null
  endDate: string | null
  location: string | null
  activities: string[]
  status: "upcoming" | "ongoing" | "completed" | null
  sortBy: "createdAt" | "likes" | "startDate" | null
}

// Saved filter interface
interface SavedFilter {
  id: string
  name: string
  state: FilterState
}

export function FilterModal({ isOpen, onClose }: FilterModalProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { userId } = useAuth()
  const [userProfile, setUserProfile] = useState<SelectProfile | null>(null) // State for user profile

  const getInitialState = useCallback((): FilterState => {
    return {
      tripType: searchParams.get("tripType"),
      maxBudget: searchParams.get("maxBudget")
        ? parseInt(searchParams.get("maxBudget")!, 10)
        : null,
      maxGroupSize: searchParams.get("maxGroupSize")
        ? parseInt(searchParams.get("maxGroupSize")!, 10)
        : null,
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      location: searchParams.get("location"),
      activities: searchParams.getAll("preference"),
      status: searchParams.get("status") as FilterState["status"],
      sortBy: searchParams.get("sortBy") as FilterState["sortBy"]
    }
  }, [searchParams])

  const [filters, setFilters] = useState<FilterState>(getInitialState)
  const [tripCount, setTripCount] = useState<number | null>(null)
  const [isCounting, setIsCounting] = useState<boolean>(false)
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [recentSearches, setRecentSearches] = useState<FilterState[]>([])
  const [saveFilterName, setSaveFilterName] = useState("")
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const countDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch profile to check gender for women_only filter option
  useEffect(() => {
    if (userId) {
      getProfileByUserIdAction(userId).then(result => {
        if (result.isSuccess) {
          setUserProfile(result.data)
        }
      })
    }
  }, [userId])

  const fetchTripCount = useCallback(
    async (currentFilters: FilterState) => {
      setIsCounting(true)
      try {
        const actionFilters: import("@/actions/db/trips-actions").TripFilterParams =
          {
            tripType: currentFilters.tripType,
            maxBudget: currentFilters.maxBudget,
            maxGroupSize: currentFilters.maxGroupSize,
            startDate: currentFilters.startDate,
            endDate: currentFilters.endDate,
            location: currentFilters.location,
            status: currentFilters.status,
            tripPreferences: currentFilters.activities,
            sortBy: currentFilters.sortBy ?? undefined
          }

        const result = await getFilteredTripsCountAction(
          userId || null,
          actionFilters
        )
        if (result.isSuccess) {
          setTripCount(result.data)
        } else {
          console.error("Failed to fetch trip count:", result.message)
          setTripCount(null)
        }
      } catch (error) {
        console.error("Error calling trip count action:", error)
        setTripCount(null)
      } finally {
        setIsCounting(false)
      }
    },
    [userId]
  )

  useEffect(() => {
    if (countDebounceTimeoutRef.current)
      clearTimeout(countDebounceTimeoutRef.current)
    countDebounceTimeoutRef.current = setTimeout(() => {
      fetchTripCount(filters)
    }, 500)
    return () => {
      if (countDebounceTimeoutRef.current)
        clearTimeout(countDebounceTimeoutRef.current)
    }
  }, [filters, fetchTripCount])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedFiltersStr = localStorage.getItem("savedFilters")
      const recentSearchesStr = localStorage.getItem("recentSearches")
      if (savedFiltersStr) setSavedFilters(JSON.parse(savedFiltersStr))
      if (recentSearchesStr) setRecentSearches(JSON.parse(recentSearchesStr))
    }
  }, [])

  useEffect(() => {
    setFilters(getInitialState())
  }, [searchParams, getInitialState])

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleClearAll = () => {
    setFilters({
      tripType: null,
      maxBudget: null,
      maxGroupSize: null,
      startDate: null,
      endDate: null,
      location: null,
      activities: [],
      status: null,
      sortBy: null
    })
    router.push(`/`)
    onClose()
  }

  const applyFilters = () => {
    const params = new URLSearchParams()

    if (filters.tripType) params.set("tripType", filters.tripType)
    if (filters.maxBudget) params.set("maxBudget", filters.maxBudget.toString())
    if (filters.maxGroupSize !== null)
      params.set("maxGroupSize", filters.maxGroupSize.toString())
    if (filters.startDate) params.set("startDate", filters.startDate)
    if (filters.endDate) params.set("endDate", filters.endDate)
    if (filters.location) params.set("location", filters.location)
    if (filters.status) params.set("status", filters.status)
    if (filters.sortBy) params.set("sortBy", filters.sortBy)

    filters.activities.forEach(activity =>
      params.append("preference", activity)
    )

    saveToRecentSearches(filters)
    router.push(`/?${params.toString()}`)
    onClose()
  }

  const saveToRecentSearches = (filterState: FilterState) => {
    const hasActiveFilters = Object.values(filterState).some(
      value =>
        value !== null && (Array.isArray(value) ? value.length > 0 : true)
    )
    if (!hasActiveFilters) return
    const newRecentSearches = [
      filterState,
      ...recentSearches.filter(
        search => JSON.stringify(search) !== JSON.stringify(filterState)
      )
    ].slice(0, 5)
    setRecentSearches(newRecentSearches)
    localStorage.setItem("recentSearches", JSON.stringify(newRecentSearches))
  }

  const saveCurrentFilter = () => {
    if (!saveFilterName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name",
        variant: "destructive"
      })
      return
    }
    const newFilter: SavedFilter = {
      id: crypto.randomUUID(),
      name: saveFilterName,
      state: { ...filters }
    }
    const updatedSavedFilters = [...savedFilters, newFilter]
    setSavedFilters(updatedSavedFilters)
    localStorage.setItem("savedFilters", JSON.stringify(updatedSavedFilters))
    setShowSaveDialog(false)
    setSaveFilterName("")
    toast({ title: "Success", description: "Filter saved successfully" })
  }

  const applySavedFilter = (savedFilter: SavedFilter) => {
    setFilters(savedFilter.state)
  }

  const deleteSavedFilter = (id: string) => {
    const updatedFilters = savedFilters.filter(filter => filter.id !== id)
    setSavedFilters(updatedFilters)
    localStorage.setItem("savedFilters", JSON.stringify(updatedFilters))
    toast({ title: "Success", description: "Filter deleted successfully" })
  }

  const getActiveFilterTags = () => {
    const tags = []
    if (filters.tripType)
      tags.push({
        key: "tripType",
        value: filters.tripType,
        label: `Type: ${filters.tripType}`
      })
    if (filters.maxBudget)
      tags.push({
        key: "maxBudget",
        value: filters.maxBudget,
        label: `Budget: ≤ ₹${filters.maxBudget.toLocaleString()}`
      })
    if (filters.maxGroupSize !== null)
      tags.push({
        key: "maxGroupSize",
        value: filters.maxGroupSize,
        label: `Max Group: ${filters.maxGroupSize}`
      })
    if (filters.startDate)
      tags.push({
        key: "startDate",
        value: filters.startDate,
        label: `From: ${filters.startDate}`
      })
    if (filters.endDate)
      tags.push({
        key: "endDate",
        value: filters.endDate,
        label: `To: ${filters.endDate}`
      })
    if (filters.location)
      tags.push({
        key: "location",
        value: filters.location,
        label: `Location: ${filters.location}`
      })
    if (filters.status)
      tags.push({
        key: "status",
        value: filters.status,
        label: `Status: ${filters.status}`
      })
    if (filters.sortBy) {
      let label = "Newest"
      if (filters.sortBy === "likes") label = "Most Liked"
      if (filters.sortBy === "startDate") label = "Start Date"
      tags.push({
        key: "sortBy",
        value: filters.sortBy,
        label: `Sort: ${label}`
      })
    }

    filters.activities.forEach(activity =>
      tags.push({
        key: "preference",
        value: activity,
        label: `Pref: ${activity}`
      })
    )
    return tags
  }

  const removeFilter = (key: string, value?: any) => {
    if (key === "preference" && value) {
      setFilters(prev => ({
        ...prev,
        activities: prev.activities.filter(a => a !== value)
      }))
    } else if (key === "sortBy") {
      setFilters(prev => ({ ...prev, sortBy: null }))
    } else {
      setFilters(prev => ({ ...prev, [key as keyof FilterState]: null }))
    }
  }

  const activeFilterCount = getActiveFilterTags().length

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="flex size-full max-h-full max-w-full flex-col p-0 sm:h-[95vh] sm:max-h-[95vh] sm:w-[95vw] sm:max-w-2xl md:max-w-3xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="mr-2 size-7"
                onClick={onClose}
              >
                <i className="fi fi-rr-cross-small text-xl"></i>
                <span className="sr-only">Close</span>
              </Button>
              <DialogTitle className="text-lg font-semibold">
                Filters
              </DialogTitle>
            </div>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 pb-[100px] sm:px-6 sm:pb-[80px]">
            {/* Active filter tags */}
            {activeFilterCount > 0 && (
              <div className="my-4 flex flex-wrap gap-2">
                {getActiveFilterTags().map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-1 pl-2 pr-1"
                  >
                    <span className="text-xs">{tag.label}</span>
                    <button
                      className="text-muted-foreground ml-0.5 rounded-full p-0.5 hover:bg-gray-300 hover:text-gray-700"
                      onClick={() => removeFilter(tag.key, tag.value)}
                      aria-label={`Remove ${tag.label} filter`}
                    >
                      {" "}
                      <i className="fi fi-rr-cross-small flex items-center justify-center text-[10px]"></i>{" "}
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {/* Saved/Recent (No changes needed) */}
            {(savedFilters.length > 0 || recentSearches.length > 0) && (
              <div className="mb-6">
                <Tabs defaultValue="saved">
                  <TabsList className="w-full">
                    <TabsTrigger value="saved" className="w-1/2">
                      Saved Filters
                    </TabsTrigger>
                    <TabsTrigger value="recent" className="w-1/2">
                      Recent Searches
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="saved" className="mt-4">
                    {savedFilters.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {savedFilters.map(filter => (
                          <div
                            key={filter.id}
                            className="flex items-center justify-between rounded-md border p-2"
                          >
                            <span>{filter.name}</span>
                            <div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => applySavedFilter(filter)}
                              >
                                Apply
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive size-6"
                                onClick={() => deleteSavedFilter(filter.id)}
                              >
                                <i className="fi fi-rr-cross-small text-base"></i>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center text-sm">
                        No saved filters
                      </p>
                    )}
                  </TabsContent>
                  <TabsContent value="recent" className="mt-4">
                    {recentSearches.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {recentSearches.map((search, index) => {
                          const parts = []
                          if (search.tripType) parts.push(search.tripType)
                          if (search.location) parts.push(search.location)
                          if (search.maxBudget)
                            parts.push(`≤ ₹${search.maxBudget}`)
                          return (
                            <div
                              key={index}
                              className="flex cursor-pointer items-center gap-2 rounded-md border p-2 transition-colors hover:bg-gray-50"
                              onClick={() => setFilters(search)}
                            >
                              <i className="fi fi-rr-clock text-muted-foreground text-base"></i>
                              <span className="truncate text-sm">
                                {parts.join(" • ") || "All trips"}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center text-sm">
                        No recent searches
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Filter categories */}
            <div className="space-y-6 py-2">
              <SortByFilter
                value={filters.sortBy}
                onChange={value => handleFilterChange("sortBy", value)}
              />
              <LocationFilter
                value={filters.location}
                onChange={value => handleFilterChange("location", value)}
              />
              <DateRangeFilter
                startDate={filters.startDate}
                endDate={filters.endDate}
                onStartDateChange={value =>
                  handleFilterChange("startDate", value)
                }
                onEndDateChange={value => handleFilterChange("endDate", value)}
              />
              <TripTypeFilter
                value={filters.tripType}
                onChange={value => handleFilterChange("tripType", value)}
                profile={userProfile}
              />
              <BudgetFilter
                value={filters.maxBudget}
                onChange={value => handleFilterChange("maxBudget", value)}
              />
              <GroupSizeFilter
                value={filters.maxGroupSize}
                onChange={value => handleFilterChange("maxGroupSize", value)}
              />
              <ActivitiesFilter
                values={filters.activities}
                onChange={value => handleFilterChange("activities", value)}
              />
              <StatusFilter
                value={filters.status}
                onChange={value => handleFilterChange("status", value)}
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="absolute inset-x-0 bottom-0 border-t bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" onClick={handleClearAll} size="sm">
                {" "}
                Clear all{" "}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSaveDialog(true)}
                disabled={activeFilterCount === 0}
                size="sm"
              >
                {" "}
                <i className="fi fi-rr-disk mr-1 text-base"></i> Save{" "}
              </Button>
              <Button
                className="bg-gradient-1 flex-1 text-white sm:flex-none"
                onClick={applyFilters}
                size="default"
              >
                Show{" "}
                {isCounting ? (
                  <Loader2 className="ml-2 size-4 animate-spin" />
                ) : tripCount !== null ? (
                  `${tripCount} trip${tripCount !== 1 ? "s" : ""}`
                ) : (
                  "trips"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Save filter dialog (Unchanged) */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          {" "}
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            {" "}
            <h3 className="mb-4 text-lg font-medium">Save Filter Set</h3>{" "}
            <div className="space-y-4">
              {" "}
              <div>
                {" "}
                <Label htmlFor="filterName">Filter Name</Label>{" "}
                <Input
                  id="filterName"
                  value={saveFilterName}
                  onChange={e => setSaveFilterName(e.target.value)}
                  placeholder="e.g., Europe Budget Trips"
                  className="mt-1"
                />{" "}
              </div>{" "}
              <div className="flex justify-end gap-2">
                {" "}
                <Button
                  variant="outline"
                  onClick={() => setShowSaveDialog(false)}
                >
                  Cancel
                </Button>{" "}
                <Button onClick={saveCurrentFilter}>Save</Button>{" "}
              </div>{" "}
            </div>{" "}
          </div>{" "}
        </div>
      )}
    </Dialog>
  )
}
