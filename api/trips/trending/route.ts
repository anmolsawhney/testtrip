/**
 * @description
 * API route for fetching trending trips, now with comprehensive filtering and pagination support.
 * Processes query parameters to filter trips by various criteria.
 * CORRECTED: Removed the erroneous `activities` key from the filters object to match the server action's expected type.
 * UPDATED: Now parses `limit` and `offset` from the query parameters to support pagination.
 *
 * Key features:
 * - Supports all filter parameters from the trip schema.
 * - Handles complex filter combinations and pagination.
 * - Returns filtered and sorted trip data including user status flags.
 * - Provides appropriate error responses.
 *
 * @dependencies
 * - "@/actions/db/trips-actions": For database trip queries (`getFilteredTripsAction`).
 * - "@clerk/nextjs": For user authentication (`auth`).
 * - "next/server": For response formatting (`NextRequest`, `NextResponse`).
 *
 * @notes
 * - Returns consistent JSON response format.
 */

import { getFilteredTripsAction } from "@/actions/db/trips-actions"
import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    const searchParams = request.nextUrl.searchParams

    const minSize = searchParams.get("minGroupSize")
      ? parseInt(searchParams.get("minGroupSize")!)
      : null
    const maxSize = searchParams.get("maxGroupSize")
      ? parseInt(searchParams.get("maxGroupSize")!)
      : null

    const rawStatus = searchParams.get("status")
    const validStatus: "completed" | "upcoming" | "ongoing" | undefined =
      rawStatus === "completed" ||
      rawStatus === "upcoming" ||
      rawStatus === "ongoing"
        ? rawStatus
        : undefined

    const filters = {
      tripType: searchParams.get("tripType"),
      maxBudget: searchParams.get("maxBudget")
        ? parseInt(searchParams.get("maxBudget")!)
        : null,
      minGroupSize: minSize, // This filter is not used by getFilteredTripsAction, but kept for compatibility
      maxGroupSize: maxSize,
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      location: searchParams.get("location"),
      status: validStatus,
      tripPreferences: searchParams.getAll("preference") || [],
      sortBy:
        (searchParams.get("sortBy") as "createdAt" | "likes" | "startDate") ||
        undefined,
      limit: searchParams.has("limit")
        ? parseInt(searchParams.get("limit")!)
        : undefined,
      offset: searchParams.has("offset")
        ? parseInt(searchParams.get("offset")!)
        : undefined
    }

    const tripsResult = await getFilteredTripsAction(userId || null, filters)

    if (!tripsResult.isSuccess) {
      return NextResponse.json({ error: tripsResult.message }, { status: 400 })
    }

    return NextResponse.json({
      data: tripsResult.data || [],
      message: "Filtered trips retrieved successfully"
    })
  } catch (error) {
    console.error("Error fetching filtered trips:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
