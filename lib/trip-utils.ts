/**
 * @description
 * This file contains shared utility functions related to trip logic.
 * Centralizing this logic ensures consistency across the application.
 *
 * Key features:
 * - isTripEffectivelyCompleted: A helper to determine if a trip is considered
 *   completed based on its status or end date.
 *
 * @dependencies
 * - date-fns: For date comparison (`isPast`).
 * - @/db/schema: For the `SelectItinerary` type.
 */

import { isPast } from "date-fns"
import type { SelectItinerary } from "@/db/schema"

/**
 * Checks if a trip is effectively completed.
 * A trip is considered completed if its status is 'completed' or 'cancelled',
 * OR if its end date is in the past.
 * @param trip - An object containing the trip's status and endDate.
 * @returns boolean - True if the trip is completed, false otherwise.
 */
export function isTripEffectivelyCompleted(
  trip: Pick<SelectItinerary, "status" | "endDate">
): boolean {
  // A trip explicitly marked as 'completed' or 'cancelled' is always considered completed.
  if (trip.status === "completed" || trip.status === "cancelled") {
    return true
  }
  // If the trip has an end date and that date is in the past, it's also considered completed.
  if (trip.endDate && isPast(new Date(trip.endDate))) {
    return true
  }
  // Otherwise, the trip is still ongoing or upcoming.
  return false
}
