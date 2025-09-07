/**
 * @description
 * Client-side component for filtering trips by type on the TripRizz homepage.
 * It's now fully responsive, showing icons with text labels below them on mobile screens
 * and icons with text on the side on larger screens to improve clarity.
 * The "Hotspots" feature has been removed as it is not yet implemented.
 * UPDATED: The layout is now a vertical stack on mobile to show both icon and text, switching to horizontal on larger screens.
 *
 * Key features:
 * - Interactive tabs for trip type filtering.
 * - Conditionally shows "Women Only" tab for female users.
 * - Responsive design: Shows icon and text stacked on mobile, and side-by-side on larger screens.
 * - Updates URL parameters ('tripType') for shareable filtered views.
 *
 * @dependencies
 * - "@/components/ui/tabs": Shadcn UI tabs component.
 * - "next/navigation": For URL parameter management.
 * - "react": For state and hooks.
 * - Flaticon CSS: For icons.
 * - "@/types": For SelectProfile type.
 * - "@/lib/utils": For cn utility.
 */

"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { SelectProfile } from "@/types" // Import profile type
import { cn } from "@/lib/utils"

// Define allowed values for trip type filter state
type TripTypeFilterValue = "all" | "solo" | "group" | "women_only" // Removed 'hotspots'

interface TripTypeFilterProps {
  profile: SelectProfile | null // Receive user profile data
}

export function TripTypeFilter({ profile }: TripTypeFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const showWomenOnlyTab = profile?.gender === "female"

  const getInitialValue = (): TripTypeFilterValue => {
    const param = searchParams.get("tripType")
    if (
      param === "solo" ||
      param === "group" ||
      (param === "women_only" && showWomenOnlyTab)
    ) {
      return param as TripTypeFilterValue
    }
    return "all"
  }

  const [value, setValue] = useState<TripTypeFilterValue>(getInitialValue())

  const handleValueChange = (newValue: string) => {
    if (
      newValue === "all" ||
      newValue === "solo" ||
      newValue === "group" ||
      (newValue === "women_only" && showWomenOnlyTab)
    ) {
      const validValue = newValue as TripTypeFilterValue
      setValue(validValue)

      const params = new URLSearchParams(searchParams)
      if (validValue === "all") {
        params.delete("tripType")
      } else {
        params.set("tripType", validValue)
      }

      const newUrl = `/?${params.toString()}`
      router.push(newUrl, { scroll: false })
    }
  }

  useEffect(() => {
    const currentVal = getInitialValue()
    if (currentVal !== value) {
      setValue(currentVal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, showWomenOnlyTab])

  // Count how many tabs will be visible
  const tabCount = 3 + (showWomenOnlyTab ? 1 : 0) // Base (All, Solo, Group) + WomenOnly

  return (
    <Tabs
      value={value}
      onValueChange={handleValueChange}
      className="w-full justify-center"
    >
      <TabsList
        className={cn(
          "glass mx-auto grid h-auto w-full max-w-md rounded-full p-1 transition-all duration-300 sm:h-12 sm:max-w-lg", // Adjusted for mobile height
          tabCount === 4 ? "grid-cols-4" : "grid-cols-3" // Dynamically set grid columns
        )}
      >
        <TabsTrigger
          value="all"
          className="flex h-auto flex-col items-center justify-center gap-1 rounded-full p-2 text-xs font-medium transition-colors data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white sm:h-10 sm:flex-row sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          <i className="fi fi-rr-globe"></i>
          <span className="whitespace-nowrap">All Trips</span>
        </TabsTrigger>
        <TabsTrigger
          value="solo"
          className="flex h-auto flex-col items-center justify-center gap-1 rounded-full p-2 text-xs font-medium transition-colors data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white sm:h-10 sm:flex-row sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          <i className="fi fi-rr-person-luggage text-base"></i>
          <span className="whitespace-nowrap">Solo</span>
        </TabsTrigger>
        <TabsTrigger
          value="group"
          className="flex h-auto flex-col items-center justify-center gap-1 rounded-full p-2 text-xs font-medium transition-colors data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white sm:h-10 sm:flex-row sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm"
        >
          <i className="fi fi-rr-passenger-plane text-base"></i>
          <span className="whitespace-nowrap">Group</span>
        </TabsTrigger>
        {showWomenOnlyTab && (
          <TabsTrigger
            value="women_only"
            className="flex h-auto flex-col items-center justify-center gap-1 rounded-full p-2 text-xs font-medium transition-colors data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white sm:h-10 sm:flex-row sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm"
          >
            <i className="fi fi-rr-woman-head text-base"></i>
            <span className="whitespace-nowrap">Women Only</span>
          </TabsTrigger>
        )}
      </TabsList>
    </Tabs>
  )
}
