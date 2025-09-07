"use client"

/**
 * @description
 * Horizontal scrollable category filters similar to Airbnb's category bar.
 * Allows users to filter trips by activity or location type.
 * Updated to use the new purple color scheme and Flaticon icons.
 * **DEPRECATED**: Category filtering is now primarily on the home page (`/`).
 *
 * Key features:
 * - Horizontal scrolling for mobile devices
 * - Icon + text for each category with vibrant styling
 * - Active state for the currently selected filter
 * - Smooth animations on hover/selection
 *
 * @dependencies
 * - Flaticon CSS: For category icons
 * - "next/navigation": For managing URL parameters
 * - "react": For state management
 * - "@/lib/utils": For utility functions
 *
 * @notes
 * - This component is deprecated. Use home page filtering instead.
 * - Uses CSS scroll snap for better mobile scrolling experience
 * - Categories are rendered dynamically from a predefined array
 * - Selected category is maintained in URL parameters
 * - No scroll bar but maintains horizontal scroll functionality
 * - Updated to use the new purple color scheme for active state
 */

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
// Removed Lucide imports

interface Category {
  id: string
  name: string
  iconClass: string // Use class name string instead of component type
}

// Updated categories with Flaticon classes (Assuming same categories as discover)
const categories: Category[] = [
  { id: "beach", name: "Beaches", iconClass: "fi fi-rr-umbrella-beach" },
  { id: "mountains", name: "Mountains", iconClass: "fi fi-rr-mountains" },
  { id: "cities", name: "Cities", iconClass: "fi fi-rr-city" },
  { id: "camping", name: "Camping", iconClass: "fi fi-rr-campground" },
  { id: "trending", name: "Trending", iconClass: "fi fi-rr-plane-alt" },
  { id: "photography", name: "Photo Ops", iconClass: "fi fi-rr-camera" },
  { id: "foodie", name: "Foodie", iconClass: "fi fi-rr-restaurant" },
  { id: "adventure", name: "Adventure", iconClass: "fi fi-rr-biking" },
  { id: "water", name: "Water Fun", iconClass: "fi fi-rr-water" },
  { id: "cabins", name: "Cabins", iconClass: "fi fi-rr-home" },
  { id: "nature", name: "Nature", iconClass: "fi fi-rr-tree" }
]

export function CategoryFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeCategory, setActiveCategory] = useState<string | null>(
    searchParams.get("category")
  )
  console.warn("CategoryFilters component in /matches is deprecated.") // Added warning

  const handleCategoryClick = (categoryId: string) => {
    // If already active, deselect it
    if (activeCategory === categoryId) {
      setActiveCategory(null)
      const params = new URLSearchParams(searchParams)
      params.delete("category")
      router.push(`/?${params.toString()}`, { scroll: false }) // Redirect to home
    } else {
      setActiveCategory(categoryId)
      const params = new URLSearchParams(searchParams)
      params.set("category", categoryId)
      router.push(`/?${params.toString()}`, { scroll: false }) // Redirect to home
    }
  }

  // Update active category when URL changes
  useEffect(() => {
    setActiveCategory(searchParams.get("category"))
  }, [searchParams])

  // Don't render if categories array is empty
  if (categories.length === 0) {
    console.log("[CategoryFilters] No categories defined, skipping render.")
    return null
  }

  return (
    <div className="scrollbar-hide glass flex w-full snap-x space-x-6 overflow-x-auto rounded-lg p-4">
      {categories.map(category => (
        <button
          key={category.id}
          onClick={() => handleCategoryClick(category.id)}
          className={cn(
            "flex shrink-0 snap-start flex-col items-center space-y-1 transition-all duration-200 ease-out hover:opacity-100", // Added shrink-0
            activeCategory === category.id
              ? "scale-110 opacity-100"
              : "opacity-70 hover:scale-105"
          )}
        >
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-full", // Adjusted size
              activeCategory === category.id
                ? "bg-gradient-1 text-white"
                : "bg-gray-100 text-gray-700" // Ensure icon color contrast
            )}
          >
            {/* Use <i> tag with class name */}
            <i className={`${category.iconClass} text-xl`}></i>
          </div>
          <span className="whitespace-nowrap text-xs font-medium">
            {category.name}
          </span>
        </button>
      ))}

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
