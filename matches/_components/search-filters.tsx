"use client"

/**
 * @description
 * Simplified search bar for TripRizz focused solely on location search.
 * Allows users to search trips by destination name.
 * **DEPRECATED**: Search functionality is now primarily on the home page (`/`).
 *
 * Key features:
 * - Clean, minimal search interface with glassmorphism effect
 * - Location-only search with prominent search button
 * - Responsive design that adapts to mobile and desktop
 * - Vibrant gradient search button with animation
 * - Uses Flaticon icons
 *
 * @dependencies
 * - Flaticon CSS: For icons (fi-rr-land-layer-location, fi-rr-search)
 * - "next/navigation": For managing URL parameters
 * - "@/components/ui/*": For UI components
 * - "framer-motion": For button animations
 * - "@/hooks/use-toast": For notifications
 * - "react": For state
 *
 * @notes
 * - This component is deprecated. Use home page search instead.
 * - Search parameters are maintained in URL
 * - Animates the search button on hover/tap
 */

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
// Removed MapPin, Search imports from lucide-react
import { motion } from "framer-motion"
import { useToast } from "@/hooks/use-toast"

export function SearchFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  console.warn("SearchFilters component in /matches is deprecated.") // Added warning

  const [location, setLocation] = useState(searchParams.get("location") || "")

  const handleSearch = () => {
    // Only navigate if location is not empty
    if (location.trim()) {
      const params = new URLSearchParams(searchParams)
      params.set("location", location)
      // Redirect to home page with search params
      router.push(`/?${params.toString()}`)
    } else {
      // Show a toast notification if the search field is empty
      toast({
        title: "Please enter a destination",
        description: "Enter a location to search for trips",
        variant: "destructive"
      })
    }
  }

  return (
    <Card className="glass flex items-center overflow-hidden border p-2 shadow-sm">
      {/* Location */}
      <div className="flex flex-1 items-center p-2">
        {/* Replaced MapPin icon */}
        <i className="fi fi-rr-land-layer-location mr-2 text-base text-gray-400"></i>
        <div className="w-full">
          <Input
            type="text"
            placeholder="Search destinations"
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="border-none shadow-none focus-visible:ring-0"
            onKeyDown={e => e.key === "Enter" && handleSearch()}
          />
        </div>
      </div>

      {/* Search button */}
      <div className="p-1">
        {" "}
        {/* Reduced padding slightly */}
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={handleSearch}
            className="bg-gradient-1 rounded-full text-white"
            size="icon"
          >
            {/* Replaced Search icon */}
            <i className="fi fi-rr-search text-base"></i>
          </Button>
        </motion.div>
      </div>
    </Card>
  )
}
