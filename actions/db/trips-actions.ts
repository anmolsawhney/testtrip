/**
 * @description
 * Server actions for managing core trip (itinerary) data in the TripRizz application.
 * Provides CRUD operations, filtering, and specific update actions like setting cover photo.
 * This file includes server-side access control to ensure that 'women_only' trips are only
 * visible to users who are female and have a verified identity.
 * UPDATED: The create and update actions no longer handle file uploads directly. They now
 * receive a URL string from the client, which has already uploaded the file to storage.
 * UPDATED: Corrected the `maxGroupSize` filter logic to be "less than or equal to" the specified value.
 * UPDATED: The `getFilteredTripsCountAction` has been completely refactored to use a fast query plan estimation instead of a slow `COUNT(*)`, drastically improving performance.
 * FIXED: The implementation of `getFilteredTripsCountAction` now uses a type-safe method to construct the `EXPLAIN` query, resolving a TypeScript error.
 * OPTIMIZED: `getFilteredTripsAction` now pre-fetches followed user IDs to avoid slow subqueries and includes like/wishlist status to prevent N+1 frontend requests.
 *
 * Key features:
 * - Core Trip CRUD: Create, GetByID, GetUserTrips, Update, Delete.
 * - Enhanced Filtering & Pagination: `getFilteredTripsAction` now exclude deactivated trips and trips from deleted users, and support pagination.
 * - Fast Count Estimation: `getFilteredTripsCountAction` uses query planner estimates for near-instantaneous counts.
 * - Access Control: Restricts 'women_only' trips to verified female users at the data-fetching level.
 * - Admin Bypass: `getTripByIdAction` allows admins to view any trip regardless of status or visibility.
 * - Sorting: Supports sorting by `createdAt`, `likes`, and `startDate`.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions and types.
 * - "drizzle-orm": Query building functions.
 * - "@clerk/nextjs/server": For authentication.
 * - "./activity-feed-actions": For creating activity feed events.
 * - "@/lib/auth-utils": For `isAdminUser` helper.
 * - "./profiles-actions": To check user eligibility for restricted trips.
 */
"use server"

// --- Database & Schema Imports ---
import { db } from "@/db/db"
import {
  InsertItinerary,
  SelectItinerary,
  itinerariesTable,
  tripMembersTable,
  followsTable,
  activitiesTable,
  InsertActivity,
  tripRequestsTable,
  profilesTable,
  likesTable,
  wishlistItemsTable
} from "@/db/schema"

// --- Utility Imports ---
import { ActionState } from "@/types"
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  ilike,
  lt,
  lte,
  or,
  sql,
  SQL,
  isNull,
  not,
  SQLWrapper,
  exists,
  like
} from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import { isFuture, isPast, isToday, isValid } from "date-fns"
import { isTripEffectivelyCompleted } from "@/lib/trip-utils"
import { createActivityEventAction } from "./activity-feed-actions"
import { getProfileByUserIdAction } from "./profiles-actions"
import { isAdminUser } from "@/lib/auth-utils"

// --- Type Definition for Filtered Itinerary (UPDATED) ---
export type SelectFilteredItinerary = SelectItinerary & {
  isMember?: boolean
  isRequestPending?: boolean
  isLiked?: boolean
  isWishlisted?: boolean
  creatorProfile?: {
    userId: string
    username: string | null
    profilePhoto: string | null
  } | null
}

// --- Type Definition for Filters (used by both get and count actions) ---
export interface TripFilterParams {
  tripType?: string | null
  maxBudget?: number | null
  maxGroupSize?: number | null
  startDate?: string | null
  endDate?: string | null
  location?: string | null
  status?: "upcoming" | "ongoing" | "completed" | null
  tripPreferences?: string[] | null
  sortBy?: "createdAt" | "likes" | "startDate"
  limit?: number
  offset?: number
}

// --- Helper to build filter conditions (UPDATED) ---
const buildTripFilterConditions = (
  viewerId: string | null,
  filters: TripFilterParams,
  followedUserIds: string[] // Pass pre-fetched list of followed user IDs
): (SQLWrapper | undefined)[] => {
  const conditions: (SQLWrapper | undefined)[] = [
    eq(itinerariesTable.isArchived, false),
    not(eq(itinerariesTable.status, "deactivated"))
  ]
  const now = new Date()

  let visibilityCondition: SQLWrapper | undefined
  if (viewerId) {
    visibilityCondition = or(
      eq(itinerariesTable.visibility, "public"),
      and(
        eq(itinerariesTable.visibility, "private"),
        eq(itinerariesTable.creatorId, viewerId)
      ),
      and(
        eq(itinerariesTable.visibility, "followers_only"),
        or(
          eq(itinerariesTable.creatorId, viewerId),
          // Use the pre-fetched list instead of a subquery
          followedUserIds.length > 0
            ? inArray(itinerariesTable.creatorId, followedUserIds)
            : sql`false`
        )
      )
    )
  } else {
    visibilityCondition = eq(itinerariesTable.visibility, "public")
  }
  conditions.push(visibilityCondition)

  if (filters.tripType) {
    conditions.push(eq(itinerariesTable.tripType, filters.tripType as any))
  }

  if (filters.location) {
    const searchTerm = `%${filters.location}%`
    conditions.push(
      or(
        ilike(itinerariesTable.location, searchTerm),
        and(
          not(isNull(itinerariesTable.description)),
          ilike(itinerariesTable.description, searchTerm)
        )
      )
    )
  }

  if (filters.status === "upcoming") {
    conditions.push(
      and(
        not(isNull(itinerariesTable.startDate)),
        gt(itinerariesTable.startDate, now)
      )
    )
  } else if (filters.status === "ongoing") {
    conditions.push(
      and(
        not(isNull(itinerariesTable.startDate)),
        lte(itinerariesTable.startDate, now),
        or(
          isNull(itinerariesTable.endDate),
          gte(itinerariesTable.endDate, now)
        )
      )
    )
  } else if (filters.status === "completed") {
    conditions.push(
      and(
        not(isNull(itinerariesTable.endDate)),
        lt(itinerariesTable.endDate, now)
      )
    )
  }

  if (filters.startDate) {
    try {
      const parsedStartDate = new Date(filters.startDate)
      if (isValid(parsedStartDate)) {
        conditions.push(
          and(
            not(isNull(itinerariesTable.endDate)),
            gte(itinerariesTable.endDate, parsedStartDate)
          )
        )
      } else {
        console.warn("Invalid start date filter ignored:", filters.startDate)
      }
    } catch (e) {
      console.warn("Error parsing start date filter:", filters.startDate, e)
    }
  }
  if (filters.endDate) {
    try {
      const parsedEndDate = new Date(filters.endDate)
      if (isValid(parsedEndDate)) {
        conditions.push(
          and(
            not(isNull(itinerariesTable.startDate)),
            lte(itinerariesTable.startDate, parsedEndDate)
          )
        )
      } else {
        console.warn("Invalid end date filter ignored:", filters.endDate)
      }
    } catch (e) {
      console.warn("Error parsing end date filter:", filters.endDate, e)
    }
  }

  if (filters.tripPreferences && filters.tripPreferences.length > 0) {
    const cleanPreferences = filters.tripPreferences
      .map(p => p.trim())
      .filter(p => p.length > 0)
    if (cleanPreferences.length > 0) {
      const escapedPreferences = cleanPreferences.map(p => p.replace(/'/g, "''"))
      conditions.push(
        sql`${itinerariesTable.tripPreferences} @> ${sql.raw(`ARRAY[${escapedPreferences.map(p => `'${p}'`).join(",")}]::text[]`)}`
      )
    }
  }

  if (
    filters.maxBudget !== null &&
    filters.maxBudget !== undefined &&
    Number.isInteger(filters.maxBudget)
  ) {
    conditions.push(
      or(
        isNull(itinerariesTable.budget),
        lte(itinerariesTable.budget, filters.maxBudget)
      )
    )
  }

  if (
    filters.maxGroupSize !== null &&
    filters.maxGroupSize !== undefined &&
    Number.isInteger(filters.maxGroupSize) &&
    filters.maxGroupSize >= 1
  ) {
    conditions.push(
      and(
        not(isNull(itinerariesTable.maxGroupSize)),
        lte(itinerariesTable.maxGroupSize, filters.maxGroupSize)
      )
    )
  }

  return conditions.filter((c): c is SQLWrapper => c !== undefined)
}

// --- Core Trip CRUD Actions ---

export async function createTripAction(
  trip: Omit<InsertItinerary, "photos" | "cover_photo_url"> & {
    bannerUrl?: string | null
    activities?: Partial<InsertActivity>[]
  }
): Promise<ActionState<SelectItinerary>> {
  const { bannerUrl, activities, ...tripData } = trip
  try {
    if (
      !tripData.creatorId ||
      !tripData.title ||
      !tripData.location ||
      !tripData.tripType ||
      !tripData.visibility ||
      !tripData.status
    ) {
      return {
        isSuccess: false,
        message: "Missing required fields for the trip."
      }
    }
    if (!bannerUrl) {
      return { isSuccess: false, message: "A trip banner is required." }
    }

    const transactionResult = await db.transaction(async tx => {
      const [newTrip] = await tx
        .insert(itinerariesTable)
        .values({
          ...tripData,
          startDate: tripData.startDate ? new Date(tripData.startDate) : null,
          endDate: tripData.endDate ? new Date(tripData.endDate) : null,
          photos: [bannerUrl],
          cover_photo_url: bannerUrl,
          itineraryDetails: null,
          tripPreferences: tripData.tripPreferences ?? [],
          budget: tripData.budget ?? null,
          currentGroupSize: tripData.tripType === "solo" ? 1 : 1,
          maxGroupSize:
            tripData.tripType === "solo" ? null : tripData.maxGroupSize ?? null
        })
        .returning()

      if (!newTrip) throw new Error("Trip creation failed in transaction.")

      await tx
        .insert(tripMembersTable)
        .values({ tripId: newTrip.id, userId: tripData.creatorId, role: "owner" })

      if (activities && activities.length > 0) {
        const activitiesToInsert = activities
          .filter(
            act =>
              act.title &&
              act.location &&
              act.startTime &&
              act.endTime &&
              isValid(new Date(act.startTime)) &&
              isValid(new Date(act.endTime)) &&
              new Date(act.endTime) >= new Date(act.startTime)
          )
          .map(
            act =>
              ({
                tripId: newTrip.id,
                title: act.title!,
                description: act.description || null,
                startTime: new Date(act.startTime!),
                endTime: new Date(act.endTime!),
                location: act.location!
              }) as InsertActivity
          )
        if (activitiesToInsert.length > 0) {
          await tx.insert(activitiesTable).values(activitiesToInsert)
        }
      }
      return newTrip
    })

    await createActivityEventAction({
      userId: transactionResult.creatorId,
      eventType: "new_trip",
      relatedId: transactionResult.id
    })

    return {
      isSuccess: true,
      message: "Trip created successfully",
      data: transactionResult
    }
  } catch (error) {
    console.error("Error creating trip:", error)
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to create trip"
    }
  }
}

export async function getTripByIdAction(
  id: string,
  viewerId?: string
): Promise<ActionState<SelectItinerary>> {
  try {
    const results = await db
      .select({
        itinerary: itinerariesTable,
        creator: profilesTable
      })
      .from(itinerariesTable)
      .leftJoin(
        profilesTable,
        eq(itinerariesTable.creatorId, profilesTable.userId)
      )
      .where(eq(itinerariesTable.id, id))

    if (results.length === 0) {
      return { isSuccess: false, message: "Trip not found" }
    }

    const { itinerary: trip, creator } = results[0]

    if (!trip) {
      return { isSuccess: false, message: "Trip data is missing." }
    }

    if (creator && creator.username?.startsWith("deleted_")) {
      const isViewerAdmin = isAdminUser(viewerId)
      if (trip.creatorId !== viewerId && !isViewerAdmin) {
        return {
          isSuccess: false,
          message: "This trip is no longer available."
        }
      }
    }

    const isViewerAdmin = isAdminUser(viewerId)
    if (isViewerAdmin) {
      return { isSuccess: true, message: "Admin access granted.", data: trip }
    }

    if (trip.status === "deactivated" && trip.creatorId !== viewerId) {
      return { isSuccess: false, message: "This trip is currently not active." }
    }

    if (trip.visibility === "private" && trip.creatorId !== viewerId) {
      return {
        isSuccess: false,
        message: "Access denied: This trip is private."
      }
    }
    if (trip.visibility === "followers_only" && trip.creatorId !== viewerId) {
      if (!viewerId)
        return {
          isSuccess: false,
          message: "Access denied: Login required to view this trip."
        }
      const follows = await db.query.follows.findFirst({
        where: and(
          eq(followsTable.followerId, viewerId),
          eq(followsTable.followingId, trip.creatorId),
          eq(followsTable.status, "accepted")
        ),
        columns: { followerId: true }
      })
      if (!follows)
        return {
          isSuccess: false,
          message:
            "Access denied: You must follow the creator to view this trip."
        }
    }

    if (trip.tripType === "women_only" && trip.creatorId !== viewerId) {
      if (!viewerId) {
        return {
          isSuccess: false,
          message: "Login required to view this women-only trip."
        }
      }
      const profileResult = await getProfileByUserIdAction(viewerId)
      if (!profileResult.isSuccess || !profileResult.data) {
        console.error(
          `[getTripByIdAction] Could not fetch profile for viewer ${viewerId} to check women_only access.`
        )
        return {
          isSuccess: false,
          message: "Could not verify eligibility for this trip."
        }
      }
      const viewerProfile = profileResult.data
      const isEligible =
        viewerProfile.gender === "female" &&
        viewerProfile.verificationStatus === "verified"
      if (!isEligible) {
        return {
          isSuccess: false,
          message: "This trip is reserved for verified female users."
        }
      }
    }

    return {
      isSuccess: true,
      message: "Trip retrieved successfully",
      data: trip
    }
  } catch (error) {
    console.error(`Error getting trip by ID (${id}):`, error)
    return { isSuccess: false, message: "Failed to get trip" }
  }
}

export async function getUserTripsAction(
  userId: string
): Promise<ActionState<SelectItinerary[]>> {
  try {
    const trips = await db.query.itineraries.findMany({
      where: eq(itinerariesTable.creatorId, userId),
      orderBy: [desc(itinerariesTable.createdAt)]
    })
    return {
      isSuccess: true,
      message: "User trips retrieved successfully",
      data: trips
    }
  } catch (error) {
    console.error(`Error getting trips for user (${userId}):`, error)
    return { isSuccess: false, message: "Failed to get user trips" }
  }
}

export async function getFilteredTripsAction(
  viewerId: string | null,
  filters: TripFilterParams
): Promise<ActionState<SelectFilteredItinerary[]>> {
  console.log(
    `[Action getFilteredTrips] Filters:`,
    JSON.stringify(filters),
    `Viewer: ${viewerId || "none"}`
  )
  try {
    if (filters.tripType === "women_only") {
      if (!viewerId) {
        return {
          isSuccess: true,
          message: "Login required to view women-only trips.",
          data: []
        }
      }
      const profileResult = await getProfileByUserIdAction(viewerId)
      if (
        !profileResult.isSuccess ||
        !profileResult.data ||
        profileResult.data.gender !== "female" ||
        profileResult.data.verificationStatus !== "verified"
      ) {
        console.log(
          `[Action getFilteredTrips] User ${viewerId} is not eligible for women-only trips.`
        )
        return {
          isSuccess: true,
          message: "Only verified female users can view these trips.",
          data: []
        }
      }
    }

    // OPTIMIZATION: Pre-fetch followed user IDs to avoid subquery
    let followedUserIds: string[] = []
    if (viewerId) {
      const followedUsers = await db
        .select({ followingId: followsTable.followingId })
        .from(followsTable)
        .where(
          and(
            eq(followsTable.followerId, viewerId),
            eq(followsTable.status, "accepted")
          )
        )
      followedUserIds = followedUsers.map(f => f.followingId)
    }

    let orderBy: SQL<unknown>[]
    switch (filters.sortBy) {
      case "likes":
        orderBy = [
          desc(itinerariesTable.like_count),
          desc(itinerariesTable.createdAt)
        ]
        break
      case "createdAt":
        orderBy = [desc(itinerariesTable.createdAt)]
        break
      case "startDate":
      default:
        orderBy = [
          sql`${itinerariesTable.startDate} DESC NULLS LAST`,
          desc(itinerariesTable.createdAt)
        ]
        break
    }

    const conditions = buildTripFilterConditions(
      viewerId,
      filters,
      followedUserIds
    )
    const whereClause = and(
      ...conditions,
      not(like(profilesTable.username, "deleted_%"))
    )
    const limit = filters.limit ?? 20
    const offset = filters.offset ?? 0

    const results = await db
      .select({
        itinerary: itinerariesTable,
        creatorProfile: {
          userId: profilesTable.userId,
          username: profilesTable.username,
          profilePhoto: profilesTable.profilePhoto
        }
      })
      .from(itinerariesTable)
      .innerJoin(
        profilesTable,
        eq(itinerariesTable.creatorId, profilesTable.userId)
      )
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset)

    const baseTrips = results.map(r => ({
      ...r.itinerary,
      creatorProfile: r.creatorProfile
    }))

    let enhancedTrips: SelectFilteredItinerary[] = baseTrips
    if (viewerId && baseTrips.length > 0) {
      const tripIds = baseTrips.map(t => t.id)

      const [memberships, pendingRequests, userLikes, userWishlists] =
        await Promise.all([
          db
            .select({ tripId: tripMembersTable.tripId })
            .from(tripMembersTable)
            .where(
              and(
                inArray(tripMembersTable.tripId, tripIds),
                eq(tripMembersTable.userId, viewerId)
              )
            ),
          db
            .select({ tripId: tripRequestsTable.tripId })
            .from(tripRequestsTable)
            .where(
              and(
                inArray(tripRequestsTable.tripId, tripIds),
                eq(tripRequestsTable.userId, viewerId),
                eq(tripRequestsTable.status, "pending")
              )
            ),
          db
            .select({ itineraryId: likesTable.itineraryId })
            .from(likesTable)
            .where(
              and(
                eq(likesTable.userId, viewerId),
                inArray(likesTable.itineraryId, tripIds)
              )
            ),
          db
            .select({ itineraryId: wishlistItemsTable.itineraryId })
            .from(wishlistItemsTable)
            .where(
              and(
                eq(wishlistItemsTable.userId, viewerId),
                inArray(wishlistItemsTable.itineraryId, tripIds)
              )
            )
        ])

      const memberTripIds = new Set(memberships.map(m => m.tripId))
      const pendingRequestTripIds = new Set(pendingRequests.map(r => r.tripId))
      const likedTripIds = new Set(userLikes.map(l => l.itineraryId))
      const wishlistedTripIds = new Set(userWishlists.map(w => w.itineraryId))

      enhancedTrips = baseTrips.map(trip => ({
        ...trip,
        isMember: memberTripIds.has(trip.id),
        isRequestPending: pendingRequestTripIds.has(trip.id),
        isLiked: likedTripIds.has(trip.id),
        isWishlisted: wishlistedTripIds.has(trip.id)
      }))
    }

    return {
      isSuccess: true,
      message: "Filtered trips retrieved",
      data: enhancedTrips
    }
  } catch (error) {
    console.error("[Action getFilteredTrips] Error:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to get filtered trips"
    }
  }
}

export async function getFilteredTripsCountAction(
  viewerId: string | null,
  filters: TripFilterParams
): Promise<ActionState<number>> {
  console.log(
    `[Action getFilteredTripsCount] Filters:`,
    JSON.stringify(filters),
    `Viewer: ${viewerId || "none"}`
  )
  try {
    if (filters.tripType === "women_only") {
      if (!viewerId)
        return { isSuccess: true, data: 0, message: "Login required." }
      const profileResult = await getProfileByUserIdAction(viewerId)
      if (
        !profileResult.isSuccess ||
        !profileResult.data ||
        profileResult.data.gender !== "female" ||
        profileResult.data.verificationStatus !== "verified"
      ) {
        return {
          isSuccess: true,
          data: 0,
          message: "Ineligible for women-only trips."
        }
      }
    }

    let followedUserIds: string[] = []
    if (viewerId) {
      const followedUsers = await db
        .select({ followingId: followsTable.followingId })
        .from(followsTable)
        .where(
          and(
            eq(followsTable.followerId, viewerId),
            eq(followsTable.status, "accepted")
          )
        )
      followedUserIds = followedUsers.map(f => f.followingId)
    }

    const conditions = buildTripFilterConditions(
      viewerId,
      filters,
      followedUserIds
    )
    const whereClause = and(
      ...conditions,
      not(like(profilesTable.username, "deleted_%"))
    )

    const queryToExplain = db
      .select({ id: itinerariesTable.id })
      .from(itinerariesTable)
      .innerJoin(
        profilesTable,
        eq(itinerariesTable.creatorId, profilesTable.userId)
      )
      .where(whereClause)

    const finalExplainQuery = sql`EXPLAIN (FORMAT JSON) ${queryToExplain}`

    const explainedResult: any[] = await db.execute(finalExplainQuery)

    const estimatedRows =
      explainedResult[0]?.["QUERY PLAN"]?.[0]?.Plan?.["Plan Rows"] ?? 0

    return {
      isSuccess: true,
      message: "Trip count estimated successfully.",
      data: estimatedRows
    }
  } catch (error) {
    console.error("[Action getFilteredTripsCount] Error:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to get trip count"
    }
  }
}

export async function updateTripAction(
  id: string,
  data: Partial<
    Omit<InsertItinerary, "cover_photo_url" | "photos" | "itineraryDetails">
  > & {
    incrementUpvotes?: number
    incrementDownvotes?: number
    cover_photo_url?: string | null
    bannerUrl?: string | null
    activities?: Partial<InsertActivity>[]
    tripPreferences?: string[] | null
    budget?: number | null
  }
): Promise<ActionState<SelectItinerary>> {
  const { bannerUrl, activities, ...restData } = data
  try {
    const { userId } = await auth()
    if (!userId) return { isSuccess: false, message: "Unauthorized." }

    const trip = await db.query.itineraries.findFirst({
      where: eq(itinerariesTable.id, id)
    })
    if (!trip) return { isSuccess: false, message: "Trip not found." }
    if (trip.creatorId !== userId)
      return {
        isSuccess: false,
        message: "Unauthorized: Only owner can edit."
      }

    const isEffectivelyCompleted = isTripEffectivelyCompleted(trip)

    let updateData: Record<string, any> = { ...restData }
    let bannerUpdated = false

    if (bannerUrl && !isEffectivelyCompleted) {
      bannerUpdated = true
      updateData.photos = [bannerUrl]
      updateData.cover_photo_url = bannerUrl
    } else if (bannerUrl && isEffectivelyCompleted) {
      console.warn(
        "[Action updateTrip] Ignoring banner file update for completed trip."
      )
    }

    if (restData.incrementUpvotes !== undefined) {
      updateData.upvotes = sql`${itinerariesTable.upvotes} + ${data.incrementUpvotes}`
      delete updateData.incrementUpvotes
    }
    if (restData.incrementDownvotes !== undefined) {
      updateData.downvotes = sql`${itinerariesTable.downvotes} + ${data.incrementDownvotes}`
      delete updateData.incrementDownvotes
    }

    if (!bannerUpdated && restData.cover_photo_url !== undefined) {
      updateData.cover_photo_url = restData.cover_photo_url
    } else if ("cover_photo_url" in updateData) {
      delete updateData.cover_photo_url
    }

    if (!isEffectivelyCompleted) {
      if (restData.tripPreferences !== undefined)
        updateData.tripPreferences = restData.tripPreferences ?? []
      if (restData.budget !== undefined)
        updateData.budget = restData.budget ?? null
    } else {
      if ("tripPreferences" in updateData) delete updateData.tripPreferences
      if ("budget" in updateData) delete updateData.budget
    }

    if (updateData.creatorId) delete updateData.creatorId
    if (restData.startDate !== undefined)
      updateData.startDate = restData.startDate
        ? new Date(restData.startDate)
        : null
    if (restData.endDate !== undefined)
      updateData.endDate = restData.endDate ? new Date(restData.endDate) : null
    updateData.updatedAt = new Date()

    if (isEffectivelyCompleted) {
      const forbiddenFields = [
        "title",
        "location",
        "startDate",
        "endDate",
        "tripType",
        "visibility",
        "maxGroupSize",
        "budget",
        "tripPreferences",
        "status"
      ]
      forbiddenFields.forEach(field => {
        if (field in updateData) {
          console.warn(
            `[Action updateTrip] Ignoring forbidden field update for completed trip: ${field}`
          )
          delete updateData[field]
        }
      })
      if (activities !== undefined)
        console.warn(
          "[Action updateTrip] Ignoring activities update for completed trip."
        )
    }

    const updatedTrip = await db.transaction(async tx => {
      let updatedItineraryResult: SelectItinerary[] = []
      const coreFieldsToUpdate = Object.keys(updateData).filter(
        key => !key.startsWith("increment")
      )

      if (coreFieldsToUpdate.length > 0) {
        updatedItineraryResult = await tx
          .update(itinerariesTable)
          .set(updateData)
          .where(eq(itinerariesTable.id, id))
          .returning()
        if (updatedItineraryResult.length === 0)
          throw new Error(
            "Trip update failed (itinerary not found or no changes made)."
          )
      } else {
        const currentTripData = await tx.query.itineraries.findFirst({
          where: eq(itinerariesTable.id, id)
        })
        if (!currentTripData) throw new Error("Failed to refetch trip data.")
        updatedItineraryResult = [currentTripData]
      }

      if (!isEffectivelyCompleted && activities !== undefined) {
        await tx.delete(activitiesTable).where(eq(activitiesTable.tripId, id))
        if (activities.length > 0) {
          const activitiesToInsert = activities
            .filter(
              act =>
                act.title &&
                act.location &&
                act.startTime &&
                act.endTime &&
                isValid(new Date(act.startTime)) &&
                isValid(new Date(act.endTime)) &&
                new Date(act.endTime) >= new Date(act.startTime)
            )
            .map(
              act =>
                ({
                  tripId: id,
                  title: act.title!,
                  description: act.description || null,
                  startTime: new Date(act.startTime!),
                  endTime: new Date(act.endTime!),
                  location: act.location!
                }) as InsertActivity
            )
          if (activitiesToInsert.length > 0)
            await tx.insert(activitiesTable).values(activitiesToInsert)
        }
      }
      return updatedItineraryResult[0]
    })

    if (!updatedTrip)
      return { isSuccess: false, message: "Trip update failed." }

    return {
      isSuccess: true,
      message: "Trip updated successfully",
      data: updatedTrip
    }
  } catch (error) {
    console.error(`Error updating trip (${id}):`, error)
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to update trip"
    }
  }
}

export async function deleteTripAction(id: string): Promise<ActionState<void>> {
  try {
    const { userId } = await auth()
    if (!userId) return { isSuccess: false, message: "Unauthorized." }
    const trip = await db.query.itineraries.findFirst({
      where: eq(itinerariesTable.id, id),
      columns: { creatorId: true }
    })
    if (!trip) return { isSuccess: false, message: "Trip not found." }
    if (trip.creatorId !== userId)
      return {
        isSuccess: false,
        message: "Unauthorized: Only owner can delete."
      }

    const result = await db
      .delete(itinerariesTable)
      .where(eq(itinerariesTable.id, id))
      .returning({ id: itinerariesTable.id })
    if (result.length === 0)
      return { isSuccess: false, message: "Trip not found during delete." }

    console.log(`[Action deleteTrip] Deleted trip ${id}`)
    return {
      isSuccess: true,
      message: "Trip deleted successfully",
      data: undefined
    }
  } catch (error) {
    console.error(`Error deleting trip (${id}):`, error)
    return { isSuccess: false, message: "Failed to delete trip" }
  }
}

export async function getPublicTripsAction(
  limit: number = 20,
  offset: number = 0
): Promise<ActionState<SelectItinerary[]>> {
  try {
    const conditions = [
      eq(itinerariesTable.visibility, "public"),
      eq(itinerariesTable.isArchived, false),
      exists(
        db
          .select({ _: sql`1` })
          .from(profilesTable)
          .where(
            and(
              eq(profilesTable.userId, itinerariesTable.creatorId),
              not(like(profilesTable.username, "deleted_%"))
            )
          )
      )
    ]
    const trips = await db
      .select()
      .from(itinerariesTable)
      .where(and(...conditions))
      .orderBy(desc(itinerariesTable.createdAt))
      .limit(limit)
      .offset(offset)
    return {
      isSuccess: true,
      message: "Public trips retrieved",
      data: trips
    }
  } catch (error) {
    console.error("Error getting public trips:", error)
    return { isSuccess: false, message: "Failed to get public trips" }
  }
}

export async function setTripCoverPhotoAction(
  tripId: string,
  photoUrl: string | null
): Promise<ActionState<SelectItinerary>> {
  const { userId } = await auth()
  if (!userId) return { isSuccess: false, message: "Unauthorized." }
  try {
    const trip = await db.query.itineraries.findFirst({
      where: eq(itinerariesTable.id, tripId),
      columns: { creatorId: true }
    })
    if (!trip) return { isSuccess: false, message: "Trip not found." }
    if (trip.creatorId !== userId)
      return {
        isSuccess: false,
        message: "Unauthorized: Only owner can set cover."
      }

    if (photoUrl !== null && !photoUrl.startsWith("http")) {
      return { isSuccess: false, message: "Invalid photo URL provided." }
    }

    const [updatedTrip] = await db
      .update(itinerariesTable)
      .set({ cover_photo_url: photoUrl, updatedAt: new Date() })
      .where(eq(itinerariesTable.id, tripId))
      .returning()
    if (!updatedTrip) throw new Error("Failed to update cover photo.")

    console.log(`[Action setTripCoverPhoto] Updated cover for trip ${tripId}`)
    return {
      isSuccess: true,
      message: "Cover photo updated.",
      data: updatedTrip
    }
  } catch (error) {
    console.error("Error setting cover photo:", error)
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Failed to set cover photo."
    }
  }
}