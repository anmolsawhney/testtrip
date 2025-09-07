"use server"

/**
 * @description
 * Contains server actions for managing activities within trip itineraries in the TripRizz database.
 * Provides CRUD operations for activities, tied to specific trips.
 *
 * Key features:
 * - Create: Adds a new activity to a trip
 * - Read: Retrieves activities by trip ID
 *
 * @dependencies
 * - "@/db/db": Database connection
 * - "@/db/schema": Schema definitions (activitiesTable)
 * - "@/types": ActionState type
 * - "drizzle-orm": Query builder
 *
 * @notes
 * - All actions are server-side only and async as required by Next.js Server Actions
 * - Dates are expected as Date objects from the client; Drizzle handles timestamp conversion
 * - Ensures tripId association and data validation
 */

import { db } from "@/db/db"
import { ActionState } from "@/types"
import { eq, asc } from "drizzle-orm" // Added asc for ordering
import { activitiesTable, InsertActivity, SelectActivity } from "@/db/schema"

/**
 * Creates a new activity for a trip
 * @param data - The activity data to insert
 * @returns ActionState with the created activity or error
 */
export async function createActivityAction(
  data: InsertActivity
): Promise<ActionState<SelectActivity>> {
  try {
    // Validate required fields
    if (!data.tripId || !data.title || !data.location || !data.startTime || !data.endTime) {
      return {
        isSuccess: false,
        message: "Missing required fields: tripId, title, location, startTime, or endTime",
      }
    }

    if (new Date(data.endTime) <= new Date(data.startTime)) {
      return { isSuccess: false, message: "End time must be after start time" }
    }

    const [newActivity] = await db
      .insert(activitiesTable)
      .values({
        ...data,
        // Ensure dates are Date objects if coming as strings
        startTime: data.startTime instanceof Date ? data.startTime : new Date(data.startTime),
        endTime: data.endTime instanceof Date ? data.endTime : new Date(data.endTime),
      })
      .returning()

    return {
      isSuccess: true,
      message: "Activity created successfully",
      data: newActivity,
    }
  } catch (error) {
    console.error("Error creating activity:", error)
    return { isSuccess: false, message: "Failed to create activity" }
  }
}

/**
 * Retrieves all activities for a given trip
 * @param tripId - The ID of the trip
 * @returns ActionState with the list of activities or error
 */
export async function getActivitiesByTripIdAction(
  tripId: string
): Promise<ActionState<SelectActivity[]>> {
  console.log(`[Action getActivitiesByTripId] Attempting to fetch activities for tripId: ${tripId}`); // Log entry
  try {
    if (!tripId) {
        console.warn("[Action getActivitiesByTripId] No tripId provided.");
        return { isSuccess: false, message: "Trip ID is required." };
    }
    const activities = await db.query.activities.findMany({
      where: eq(activitiesTable.tripId, tripId),
      orderBy: [asc(activitiesTable.startTime)], // Order chronologically
    });

    console.log(`[Action getActivitiesByTripId] Found ${activities.length} activities for tripId: ${tripId}`);
    // Log the actual data found (optional, can be large)
    // console.log("[Action getActivitiesByTripId] Activities data:", JSON.stringify(activities, null, 2));

    return {
      isSuccess: true,
      message: "Activities retrieved successfully",
      data: activities,
    };
  } catch (error) {
    console.error(`[Action getActivitiesByTripId] Error getting activities for trip ID ${tripId}:`, error);
    return { isSuccess: false, message: "Failed to get activities" };
  }
}