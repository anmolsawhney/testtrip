"use client"

/**
 * @description
 * Horizontal scrollable category filters similar to Airbnb's category bar.
 * Allows users to filter trips by activity or location type.
 * Updated to use the new purple color scheme.
 *
 * Key features:
 * - Horizontal scrolling for mobile devices
 * - Icon + text for each category with vibrant styling
 * - Active state for the currently selected filter
 * - Smooth animations on hover/selection
 *
 * @dependencies
 * - "lucide-react": For category icons
 * - "next/navigation": For managing URL parameters
 * - "react": For state management
 * - "@/lib/utils": For utility functions
 *
 * @notes
 * - Uses CSS scroll snap for better mobile scrolling experience
 * - Categories are rendered dynamically from a predefined array
 * - Selected category is maintained in URL parameters
 * - No scroll bar but maintains horizontal scroll functionality
 * - Updated to use the new purple color scheme for active state
 */

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Palmtree,
  Mountain,
  Building2,
  Tent,
  Plane,
  Camera,
  Utensils,
  Bike,
  Waves,
  Home,
  TreePine,
  LucideIcon
} from "lucide-react"

interface Category {
  id: string
  name: string
  icon: LucideIcon
}

const categories: Category[] = []

export function CategoryFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeCategory, setActiveCategory] = useState<string | null>(
    searchParams.get("category")
  )

  const handleCategoryClick = (categoryId: string) => {
    // If already active, deselect it
    if (activeCategory === categoryId) {
      setActiveCategory(null)
      const params = new URLSearchParams(searchParams)
      params.delete("category")
      router.push(`/?${params.toString()}`, { scroll: false })
    } else {
      setActiveCategory(categoryId)
      const params = new URLSearchParams(searchParams)
      params.set("category", categoryId)
      router.push(`/?${params.toString()}`, { scroll: false })
    }
  }

  // Update active category when URL changes
  useEffect(() => {
    setActiveCategory(searchParams.get("category"))
  }, [searchParams])

  return (
    <div className="scrollbar-hide glass flex w-full snap-x space-x-6 overflow-x-auto rounded-lg p-4">
      {categories.map(category => (
        <button
          key={category.id}
          onClick={() => handleCategoryClick(category.id)}
          className={cn(
            "flex snap-start flex-col items-center space-y-2 transition-all duration-200 ease-out hover:opacity-100",
            activeCategory === category.id
              ? "scale-110 opacity-100"
              : "opacity-70 hover:scale-105"
          )}
        >
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-full",
              activeCategory === category.id
                ? "bg-gradient-1 text-white"
                : "bg-gray-100"
            )}
          >
            <category.icon className="size-6" />
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
