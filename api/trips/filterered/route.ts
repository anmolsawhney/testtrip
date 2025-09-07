/**
 * @description
 * API route for fetching trips with comprehensive filtering and pagination support.
 * Processes query parameters to filter trips by various criteria including max budget, preferences, limit, and offset.
 * CORRECTED: Removed the erroneous `activities` key from the filters object to match the server action's expected type, fixing a runtime error.
 * UPDATED: Now parses `limit` and `offset` from the query parameters to support pagination.
 *
 * Key features:
 * - Supports all filter parameters from the trip schema.
 * - Handles complex filter combinations.
 * - Supports pagination via `limit` and `offset`.
 * - Returns filtered and sorted trip data.
 * - Provides appropriate error responses.
 *
 * @dependencies
 * - "@/actions/db/trips-actions": For database trip queries (`getFilteredTripsAction`).
 * - "@clerk/nextjs": For user authentication (`auth`).
 * - "next/server": For response formatting (`NextRequest`, `NextResponse`).
 *
 * @notes
 * - Returns consistent JSON response format.
 * - Includes authorization via Clerk.
 */

import { getFilteredTripsAction } from "@/actions/db/trips-actions"
import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    const searchParams = request.nextUrl.searchParams

    const rawStatus = searchParams.get("status")
    const validStatus: "completed" | "upcoming" | "ongoing" | undefined =
      rawStatus === "completed" ||
      rawStatus === "upcoming" ||
      rawStatus === "ongoing"
        ? rawStatus
        : undefined

    const rawSortBy = searchParams.get("sortBy")
    const validSortBy: "createdAt" | "likes" | "startDate" | undefined =
      rawSortBy === "createdAt" ||
      rawSortBy === "likes" ||
      rawSortBy === "startDate"
        ? rawSortBy
        : undefined

    const filters = {
      tripType: searchParams.get("tripType"),
      maxBudget: searchParams.get("maxBudget")
        ? parseInt(searchParams.get("maxBudget")!)
        : null,
      maxGroupSize: searchParams.get("maxGroupSize")
        ? parseInt(searchParams.get("maxGroupSize")!)
        : null,
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      location: searchParams.get("location"),
      status: validStatus,
      tripPreferences: searchParams.getAll("preference") || [],
      sortBy: validSortBy,
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
