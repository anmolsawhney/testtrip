/**
 * @description
 * Client-side component that renders a button to open the trip filters modal.
 * Displays the number of active filters when applicable. It is now responsive,
 * hiding the text label on very small screens.
 *
 * Key features:
 * - Filter button with icon and text.
 * - Responsive text label that hides on xs screens.
 * - Badge showing number of active filters.
 * - Triggers filter modal opening.
 *
 * @dependencies
 * - "react": For component rendering and state.
 * - Flaticon CSS: For icons.
 * - "@/components/ui/button": For base button component.
 * - "@/components/ui/badge": For filter count display.
 * - "next/navigation": For reading URL params.
 * - "./filter-modal": The modal component to open.
 */

"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { FilterModal } from "./filter-modal"
import { cn } from "@/lib/utils"

interface FilterButtonProps {
  className?: string
}

export function FilterButton({ className }: FilterButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeFilterCount, setActiveFilterCount] = useState(0)
  const searchParams = useSearchParams()

  useEffect(() => {
    let count = 0
    searchParams.forEach((value, key) => {
      // Count each parameter that is a filter parameter
      if (
        [
          "tripType",
          "maxBudget",
          "maxGroupSize",
          "startDate",
          "endDate",
          "location",
          "status",
          "sortBy"
        ].includes(key)
      ) {
        count++
      }
      // 'preference' can have multiple values, count each one
      if (key === "preference") {
        count++
      }
    })
    setActiveFilterCount(count)
  }, [searchParams])

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2",
          className
        )}
        onClick={() => setIsModalOpen(true)}
      >
        <i className="fi fi-rr-settings-sliders text-base"></i>
        {/* Responsive text label */}
        <span className="hidden sm:inline">Filters</span>
        {activeFilterCount > 0 && (
          <Badge
            variant="secondary"
            className="flex size-5 items-center justify-center rounded-full p-0"
          >
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      <FilterModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
