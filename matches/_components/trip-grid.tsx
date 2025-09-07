"use client"

/**
 * @description
 * Displays a grid of trip cards in an Airbnb-style layout, now including interactive upvote, downvote, and share buttons.
 * Each card shows the trip image, location, dates, price, rating, and interactive options for user engagement.
 * **DEPRECATED**: Trip discovery functionality has moved to the home page (`/`).
 *
 * Key features:
 * - Responsive grid layout (1-4 columns based on screen size)
 * - Each trip card shows key information at a glance, plus interactive buttons
 * - Heart button for saving favorites, upvote/downvote/share buttons for engagement
 * - Rating display with stars
 * - Uses Flaticon icons
 *
 * @dependencies
 * - "@/db/schema/itineraries-schema": For trip data types
 * - Flaticon CSS: For icons (fi-rr-heart, fi-rr-star, fi-rr-arrow-up, fi-rr-arrow-down, fi-rr-share)
 * - "next/navigation": For navigation between pages
 * - "@/components/ui/*": For UI components
 * - "framer-motion": For button animations
 * - "@/lib/utils": For utility functions
 * - "react"
 *
 * @notes
 * - This component is deprecated. Use the home feed (`/`) instead.
 * - Uses CSS grid for responsive layout
 * - Handles missing images with placeholder
 * - Formats currency and dates consistently
 * - Buttons are stubs logging to console; full functionality requires server actions
 * - Edge cases: Disables buttons if data is invalid or missing
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
// Removed Lucide imports
import { Button } from "@/components/ui/button"
import { SelectItinerary } from "@/db/schema/itineraries-schema"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface TripGridProps {
  trips: SelectItinerary[]
}

export function TripGrid({ trips }: TripGridProps) {
  const router = useRouter()
  console.warn("TripGrid component in /matches is deprecated.") // Added warning

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {trips.map(trip => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  )
}

interface TripCardProps {
  trip: SelectItinerary
}

function TripCard({ trip }: TripCardProps) {
  const router = useRouter()
  const [isFavorite, setIsFavorite] = useState(false)

  // Format date for display
  const formatDate = (date: Date | string | null) => {
    // Accept string
    if (!date) return "Dates flexible"
    const dateObj = date instanceof Date ? date : new Date(date)
    if (isNaN(dateObj.getTime())) return "Invalid Date"
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    })
  }

  // Calculate duration based on start and end dates
  const getDuration = () => {
    if (!trip.startDate || !trip.endDate) return ""
    const start = new Date(trip.startDate)
    const end = new Date(trip.endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "" // Validate dates
    const days = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    )
    return `${days} night${days !== 1 ? "s" : ""}`
  }

  // Calculate distance based on trip ID to ensure consistency
  const getDistance = () => {
    // Use a consistent value derived from the trip ID
    const hash = trip.id.split("").reduce((acc, char) => {
      return acc + char.charCodeAt(0)
    }, 0)

    const distance = (hash % 200) + 20
    return `${distance} kilometres away`
  }

  // Use a fixed rating based on trip ID to prevent hydration mismatch
  const getRating = () => {
    // Use a hash of the trip ID to generate a consistent rating
    const hash = trip.id.split("").reduce((acc, char) => {
      return acc + char.charCodeAt(0)
    }, 0)

    // Generate a rating between 4.0 and 5.0 based on the hash
    const rating = 4 + (hash % 10) / 10
    return rating.toFixed(2)
  }

  // Generate consistent price based on trip ID
  const getPrice = () => {
    // Use a hash of the trip ID to generate a consistent price
    const hash = trip.id.split("").reduce((acc, char) => {
      return acc + char.charCodeAt(0)
    }, 0)

    return (hash % 10000) + 1000
  }

  const handleClick = () => {
    router.push(`/trips/${trip.id}`)
  }

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsFavorite(!isFavorite)
  }

  // Button handlers (stubs for now, logging actions)
  const handleUpvote = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    if (!trip.id) return
    console.log(`Upvote ${trip.id}`)
    // Add API call here in future
  }

  const handleDownvote = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    if (!trip.id) return
    console.log(`Downvote ${trip.id}`)
    // Add API call here in future
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    if (!trip.id) return
    console.log(`Share ${trip.id}`)
    // Add share logic here in future
  }

  // Button animation variants
  const buttonVariants = {
    rest: { scale: 1, opacity: 0.8 },
    hover: { scale: 1.1, opacity: 1 },
    tap: { scale: 0.95 }
  }

  return (
    <div className="group cursor-pointer" onClick={handleClick}>
      {/* Image container with favorite button */}
      <div className="relative mb-2 aspect-square overflow-hidden rounded-xl">
        {trip.photos && trip.photos.length > 0 ? (
          <img
            src={trip.photos[0]}
            alt={trip.title}
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gray-200">
            <span className="text-sm text-gray-500">No image</span>
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={handleFavorite}
          className="absolute right-3 top-3 rounded-full p-2 transition-colors hover:bg-gray-200/50"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {/* Replaced Heart icon */}
          <i
            className={cn(
              "fi fi-rr-heart text-lg",
              isFavorite ? "text-red-500" : "text-white"
            )}
            style={
              isFavorite
                ? ({
                    "--fi-rr-heart-fill": "currentColor"
                  } as React.CSSProperties)
                : {}
            }
          />
        </button>
      </div>

      {/* Trip details */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{trip.location}</h3>
          <div className="flex items-center">
            {/* Replaced Star icon */}
            <i className="fi fi-rr-star mr-1 text-base text-yellow-500 [--fi-rr-star-fill:currentColor]"></i>{" "}
            {/* Filled */}
            <span>{getRating()}</span>
          </div>
        </div>

        <p className="text-sm text-gray-500">{getDistance()}</p>

        <p className="text-sm text-gray-500">
          {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
        </p>

        <p className="pt-1">
          <span className="font-semibold">₹{getPrice()}</span> night
        </p>

        {/* Interactive Buttons for Trips */}
        <div className="mt-2 flex justify-between">
          <motion.button
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
            className="rounded-full p-2 hover:bg-gray-100"
            onClick={handleUpvote}
            aria-label="Upvote this trip"
          >
            {/* Replaced ArrowUp icon */}
            <i className="fi fi-rr-arrow-up text-base"></i>
          </motion.button>
          <motion.button
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
            className="rounded-full p-2 hover:bg-gray-100"
            onClick={handleDownvote}
            aria-label="Downvote this trip"
          >
            {/* Replaced ArrowDown icon */}
            <i className="fi fi-rr-arrow-down text-base"></i>
          </motion.button>
          <motion.button
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
            className="rounded-full p-2 hover:bg-gray-100"
            onClick={handleShare}
            aria-label="Share this trip"
          >
            {/* Replaced Share2 icon */}
            <i className="fi fi-rr-share text-base"></i>
          </motion.button>
        </div>
      </div>
    </div>
  )
}
