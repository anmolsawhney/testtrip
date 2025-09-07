/**
 * @description
 * Contains server actions for managing trips in the TripRizz database.
 * Provides CRUD operations for itineraries and trip requests, ensuring data integrity and security.
 *
 * Key features:
 * - Create: Adds trips and trip join requests
 * - Read: Retrieves trips by ID, user, or group type
 * - Update: Modifies existing trip data
 * - Delete: Removes a trip
 *
 * @dependencies
 * - "@/db/db": Database connection
 * - "@/db/schema/itineraries-schema": Itinerary schema and types
 * - "@/db/schema/matches-schema": Trip request schema and types
 * - "@/types": ActionState type
 * - "drizzle-orm": Query builder
 *
 * @notes
 * - All actions are server-side only
 * - Dates are passed as Date objects; Drizzle handles conversion to timestamp
 * - Ensures creatorId is immutable for trips
 * - Added group-specific actions for Step 8
 */

"use server"

import { db } from "@/db/db"
import {
  InsertItinerary,
  SelectItinerary,
  itinerariesTable
} from "@/db/schema/itineraries-schema"
import {
  InsertTripRequest,
  SelectTripRequest,
  tripRequestsTable
} from "@/db/schema/matches-schema"
import { ActionState } from "@/types"
import { or, eq, not, and } from "drizzle-orm"

export async function createTripAction(
  data: InsertItinerary
): Promise<ActionState<SelectItinerary>> {
  try {
    if (!data.creatorId || !data.title || !data.location) {
      return { isSuccess: false, message: "Missing required fields: creatorId, title, or location" }
    }

    const insertData: InsertItinerary = {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null
    }

    const [newTrip] = await db
      .insert(itinerariesTable)
      .values(insertData)
      .returning()

    return {
      isSuccess: true,
      message: "Trip created successfully",
      data: newTrip
    }
  } catch (error) {
    console.error("Error creating trip:", error)
    return { isSuccess: false, message: "Failed to create trip" }
  }
}

export async function getTripByIdAction(
  tripId: string
): Promise<ActionState<SelectItinerary>> {
  try {
    const trip = await db.query.itineraries.findFirst({
      where: eq(itinerariesTable.id, tripId)
    })

    if (!trip) {
      return { isSuccess: false, message: "Trip not found" }
    }

    return {
      isSuccess: true,
      message: "Trip retrieved successfully",
      data: trip
    }
  } catch (error) {
    console.error("Error getting trip by ID:", error)
    return { isSuccess: false, message: "Failed to get trip" }
  }
}

export async function getUserTripsAction(
  userId: string
): Promise<ActionState<SelectItinerary[]>> {
  try {
    const trips = await db.query.itineraries.findMany({
      where: eq(itinerariesTable.creatorId, userId)
    })

    return {
      isSuccess: true,
      message: "Trips retrieved successfully",
      data: trips
    }
  } catch (error) {
    console.error("Error getting user trips:", error)
    return { isSuccess: false, message: "Failed to get trips" }
  }
}

export async function getGroupTripsAction(
  userId: string
): Promise<ActionState<SelectItinerary[]>> {
  try {
    const trips = await db.query.itineraries.findMany({
      where: and(
        not(eq(itinerariesTable.tripType, "solo")),
        not(eq(itinerariesTable.tripType, "women_only")),
        or(
          eq(itinerariesTable.visibility, "public"),
          eq(itinerariesTable.creatorId, userId)
        )
      )
    })

    return {
      isSuccess: true,
      message: "Group trips retrieved successfully",
      data: trips
    }
  } catch (error) {
    console.error("Error getting group trips:", error)
    return { isSuccess: false, message: "Failed to get group trips" }
  }
}

export async function updateTripAction(
  tripId: string,
  data: Partial<InsertItinerary>
): Promise<ActionState<SelectItinerary>> {
  try {
    if (data.creatorId) {
      delete data.creatorId
    }

    const updateData: Partial<InsertItinerary> = {
      ...data,
      updatedAt: new Date(),
      startDate: data.startDate !== undefined 
        ? (data.startDate ? new Date(data.startDate) : null) 
        : undefined,
      endDate: data.endDate !== undefined 
        ? (data.endDate ? new Date(data.endDate) : null) 
        : undefined
    }

    const [updatedTrip] = await db
      .update(itinerariesTable)
      .set(updateData)
      .where(eq(itinerariesTable.id, tripId))
      .returning()

    if (!updatedTrip) {
      return { isSuccess: false, message: "Trip not found to update" }
    }

    return {
      isSuccess: true,
      message: "Trip updated successfully",
      data: updatedTrip
    }
  } catch (error) {
    console.error("Error updating trip:", error)
    return { isSuccess: false, message: "Failed to update trip" }
  }
}

export async function deleteTripAction(
  tripId: string
): Promise<ActionState<void>> {
  try {
    await db.delete(itinerariesTable).where(eq(itinerariesTable.id, tripId))

    return {
      isSuccess: true,
      message: "Trip deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error("Error deleting trip:", error)
    return { isSuccess: false, message: "Failed to delete trip" }
  }
}

export async function createTripRequestAction(
  data: InsertTripRequest
): Promise<ActionState<SelectTripRequest>> {
  try {
    if (!data.tripId || !data.userId) {
      return { isSuccess: false, message: "Missing required fields: tripId or userId" }
    }

    // Check if request already exists
    const existingRequest = await db.query.tripRequests.findFirst({
      where: and(
        eq(tripRequestsTable.tripId, data.tripId),
        eq(tripRequestsTable.userId, data.userId)
      )
    })

    if (existingRequest) {
      return { isSuccess: false, message: "Join request already exists" }
    }

    const [newRequest] = await db
      .insert(tripRequestsTable)
      .values(data)
      .returning()

    return {
      isSuccess: true,
      message: "Trip join request created successfully",
      data: newRequest
    }
  } catch (error) {
    console.error("Error creating trip request:", error)
    return { isSuccess: false, message: "Failed to create trip request" }
  }
}