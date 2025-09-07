/**
 * @description
 * Server actions for managing trip reviews in the TripRizz application.
 * Provides functions for creating, retrieving, and managing reviews. Ensures users are
 * members of completed trips before allowing review submission and prevents duplicates.
 * UPDATED: `getTripReviewsAction` now uses an `innerJoin` to filter out reviews from soft-deleted users.
 *
 * Key features:
 * - Create Review: Adds a new review with validation (rating, content, membership, *effective* completion status).
 * - Get Reviews: Retrieves reviews for a trip, optionally joining with reviewer profile data, and filters out content from deleted users.
 * - Get Recent Public Reviews: Retrieves recent reviews for public trips for the activity feed.
 * - Check Review Status: Checks if a user has already reviewed a specific trip.
 * - Update Review: Allows a user to update their own existing review.
 * - Delete Review: Allows a user to delete their own existing review.
 * - Activity Feed Integration: Logs 'new_review' events.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions (tripReviewsTable, itinerariesTable, tripMembersTable, profilesTable).
 * - "@/types": Definition for the `ActionState` return type.
 * - "drizzle-orm": Core Drizzle ORM functions for query building (eq, and, desc, etc.).
 * - "./activity-feed-actions": For creating activity feed events.
 * - "@/lib/trip-utils": For `isTripEffectivelyCompleted` helper.
 *
 * @notes
 * - All functions are server actions (`"use server"`).
 * - Uses `ActionState` for consistent return structure (success/error status, message, data).
 * - Includes authorization checks (e.g., only members can review, only owner can update/delete own review).
 * - Handles potential errors during database operations gracefully.
 */
"use server";

import { db } from "@/db/db";
import {
  tripReviewsTable,
  InsertTripReview,
  SelectTripReview,
  itinerariesTable, // Used to check trip status
  tripMembersTable,  // Used to check membership
  profilesTable,     // Used to join reviewer info
  SelectProfile      // Type for reviewer profile
} from "@/db/schema";
import { ActionState } from "@/types";
import { and, like, eq, desc, gte, not } from "drizzle-orm"; // Import gte if needed later for date filtering
import { createActivityEventAction } from "./activity-feed-actions"; // Added for Step 11
import { isTripEffectivelyCompleted } from "@/lib/trip-utils"; // Import the helper

/**
 * Creates a new review for a completed trip.
 * Validates trip status, user membership, and prevents duplicate reviews.
 * Also creates an activity feed event for the new review.
 *
 * @param data - The review data containing tripId, userId, rating, and content.
 * @returns ActionState containing the created review or an error message.
 */
export async function createTripReviewAction(
  data: InsertTripReview
): Promise<ActionState<SelectTripReview>> {
  try {
    // 1. Validate required fields
    if (!data.tripId || !data.userId || data.rating == null || !data.content?.trim()) { // Check rating for null/undefined explicitly
      return {
        isSuccess: false,
        message: "Missing required fields: tripId, userId, rating, or content.",
      };
    }

    // 2. Validate rating range (1-5)
    if (data.rating < 1 || data.rating > 5) {
      return {
        isSuccess: false,
        message: "Rating must be between 1 and 5.",
      };
    }

    // 3. Check if the trip exists and is EFFECTIVELY completed
    const trip = await db.query.itineraries.findFirst({
      where: eq(itinerariesTable.id, data.tripId),
      // Fetch necessary fields for the helper function
      columns: { status: true, endDate: true }
    });

    if (!trip) {
      return { isSuccess: false, message: "Trip not found." };
    }
    // --- Use Helper Function ---
    if (!isTripEffectivelyCompleted(trip)) {
    // --- End Helper Function ---
      return {
        isSuccess: false,
        message: "Reviews can only be added to completed trips.",
      };
    }

    // 4. Check if user is a member of the trip
    const isMember = await db.query.tripMembers.findFirst({
      where: and(
        eq(tripMembersTable.tripId, data.tripId),
        eq(tripMembersTable.userId, data.userId)
      ),
    });

    if (!isMember) {
      return {
        isSuccess: false,
        message: "You must be a member of this trip to add a review.",
      };
    }

    // 5. Check if user has already reviewed this trip
    const existingReview = await db.query.tripReviews.findFirst({
      where: and(
        eq(tripReviewsTable.tripId, data.tripId),
        eq(tripReviewsTable.userId, data.userId)
      ),
    });

    if (existingReview) {
      return {
        isSuccess: false,
        message: "You have already reviewed this trip.",
      };
    }

    // 6. Create the review
    // Trim content before insertion
    const reviewDataToInsert = {
        ...data,
        content: data.content.trim()
    };
    const [newReview] = await db
      .insert(tripReviewsTable)
      .values(reviewDataToInsert)
      .returning();

    // --- Step 11: Create Activity Feed Event ---
    if (newReview) {
        await createActivityEventAction({
            userId: newReview.userId,
            eventType: 'new_review',
            relatedId: newReview.id,
            // targetUserId: null, // No specific target user for a review
            eventData: { // Add tripId for context
                tripId: newReview.tripId,
                rating: newReview.rating,
                // reviewSnippet: newReview.content.substring(0, 100) // Optional snippet
            }
        });
        console.log(`[Action createTripReview] Created 'new_review' activity event for review ${newReview.id}`);
    }
    // --- End Step 11 ---


    // Return success state with the created review data
    return {
      isSuccess: true,
      message: "Review submitted successfully.",
      data: newReview,
    };

  } catch (error) {
    // Handle unexpected errors
    console.error("Error creating trip review:", error);
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to submit review.",
    };
  }
}

/**
 * Retrieves reviews for a specific trip, optionally joining with reviewer profile information.
 *
 * @param tripId - The ID of the trip to get reviews for.
 * @param includeReviewerInfo - If true, joins with the profiles table to include reviewer details.
 * @returns ActionState containing an array of reviews (potentially with reviewer info) or an error message.
 */
export async function getTripReviewsAction(
    tripId: string,
    includeReviewerInfo: boolean = false
): Promise<ActionState<(SelectTripReview & { reviewer?: SelectProfile | null })[]>> { // Adjusted return type
    try {
        let reviews: (SelectTripReview & { reviewer?: SelectProfile | null })[];

        if (includeReviewerInfo) {
            // Query reviews and INNER JOIN with profiles table to filter deleted users
            const results = await db
                .select({
                    review: tripReviewsTable, // Select the entire review object
                    reviewer: profilesTable   // Select the entire profile object
                })
                .from(tripReviewsTable)
                .innerJoin(profilesTable, and(
                  eq(tripReviewsTable.userId, profilesTable.userId),
                  not(like(profilesTable.username, "deleted_%"))
                ))
                .where(eq(tripReviewsTable.tripId, tripId))
                .orderBy(desc(tripReviewsTable.createdAt)); // Order newest first

            // Map the results to the desired structure
            reviews = results.map(r => ({
                ...r.review, // Spread the review data
                reviewer: r.reviewer // Assign the fetched profile (or null)
            }));

        } else {
            // Fetch only reviews without joining profile data
            reviews = await db
                .select()
                .from(tripReviewsTable)
                .where(eq(tripReviewsTable.tripId, tripId))
                .orderBy(desc(tripReviewsTable.createdAt));
        }

        // Return success state with the fetched reviews
        return {
            isSuccess: true,
            message: "Trip reviews fetched successfully.",
            data: reviews
        };

    } catch (error) {
        // Handle unexpected errors during fetch
        console.error("Error fetching trip reviews:", error);
        return {
            isSuccess: false,
            message: "Error fetching trip reviews."
        };
    }
}


/**
 * Retrieves recent reviews from public trips, intended for the activity feed.
 * Includes reviewer profile and basic trip details.
 *
 * @param limit - Maximum number of reviews to fetch (default: 20).
 * @param offset - Offset for pagination (default: 0).
 * @returns ActionState containing an array of recent reviews with extra context.
 */
export async function getRecentPublicReviewsAction(
    limit: number = 20,
    offset: number = 0
): Promise<ActionState<(SelectTripReview & { reviewer?: SelectProfile | null, trip?: { id: string, title: string } | null })[]>> {
    try {
        // Query reviews, join with profiles, and join with itineraries, filtering for public trips
        const results = await db
            .select({
                review: tripReviewsTable, // Select the entire review object
                reviewer: profilesTable,   // Select the entire reviewer profile object
                trip: {                  // Select specific trip fields
                    id: itinerariesTable.id,
                    title: itinerariesTable.title
                }
            })
            .from(tripReviewsTable)
            .leftJoin(profilesTable, eq(tripReviewsTable.userId, profilesTable.userId))
            .innerJoin(itinerariesTable, eq(tripReviewsTable.tripId, itinerariesTable.id)) // INNER JOIN to filter by trip properties
            .where(and( // Ensure trip is public and not archived
                eq(itinerariesTable.visibility, 'public'),
                eq(itinerariesTable.isArchived, false)
            ))
            .orderBy(desc(tripReviewsTable.createdAt)) // Order by review creation time, newest first
            .limit(limit)
            .offset(offset);

        // Map the results to the desired structure
        const reviewsWithContext = results.map(r => ({
            ...r.review,     // Spread the review data
            reviewer: r.reviewer, // Assign the fetched profile (or null)
            trip: r.trip        // Assign the fetched trip info (or null if INNER JOIN didn't match somehow, though unlikely)
        }));

        // Return success state with the fetched reviews
        return {
            isSuccess: true,
            message: "Recent public trip reviews fetched successfully.",
            data: reviewsWithContext
        };

    } catch (error) {
        // Handle unexpected errors during fetch
        console.error("Error fetching recent public trip reviews:", error);
        return {
            isSuccess: false,
            message: "Error fetching recent public trip reviews."
        };
    }
}



/**
 * Checks if a specific user has already submitted a review for a given trip.
 *
 * @param tripId - The ID of the trip.
 * @param userId - The ID of the user.
 * @returns ActionState containing a boolean indicating if a review exists, or an error message.
 */
export async function hasUserReviewedTripAction(
  tripId: string,
  userId: string
): Promise<ActionState<boolean>> {
  try {
    // Attempt to find a review matching the tripId and userId
    const review = await db.query.tripReviews.findFirst({
      where: and(
        eq(tripReviewsTable.tripId, tripId),
        eq(tripReviewsTable.userId, userId)
      ),
      columns: { // Only need the ID to check for existence, improving efficiency
          id: true
      }
    });

    // Return success state with boolean indicating if review was found
    return {
      isSuccess: true,
      message: "Review check completed.",
      data: !!review, // Convert the result (review object or undefined) to boolean
    };
  } catch (error) {
    // Handle unexpected errors during the check
    console.error("Error checking if user has reviewed trip:", error);
    return {
      isSuccess: false,
      message: "Failed to check review status.",
    };
  }
}

/**
 * Updates an existing trip review. Only the user who wrote the review can update it.
 *
 * @param reviewId - The ID of the review to update.
 * @param userId - The ID of the user attempting the update (for permission check).
 * @param data - The updated review data (rating and content).
 * @returns ActionState containing the updated review data or an error message.
 */
export async function updateTripReviewAction(
  reviewId: string,
  userId: string,
  data: { rating: number; content: string }
): Promise<ActionState<SelectTripReview>> {
  try {
    // 1. Validate input data
    if (data.rating == null || !data.content?.trim()) { // Check rating explicitly for null/undefined
      return { isSuccess: false, message: "Rating and content are required." };
    }
    if (data.rating < 1 || data.rating > 5) {
      return { isSuccess: false, message: "Rating must be between 1 and 5." };
    }

    // 2. Find the existing review
    const review = await db.query.tripReviews.findFirst({
      where: eq(tripReviewsTable.id, reviewId),
    });

    if (!review) {
      return { isSuccess: false, message: "Review not found." };
    }

    // 3. Check ownership/permission
    if (review.userId !== userId) {
      return { isSuccess: false, message: "You can only update your own reviews." };
    }

    // 4. Update the review in the database
    const [updatedReview] = await db
      .update(tripReviewsTable)
      .set({
        rating: data.rating,
        content: data.content.trim(), // Trim content before saving
        updatedAt: new Date(), // Update the timestamp
      })
      .where(eq(tripReviewsTable.id, reviewId))
      .returning(); // Return the updated record

    // Return success state with the updated review data
    return {
      isSuccess: true,
      message: "Review updated successfully.",
      data: updatedReview,
    };
  } catch (error) {
    // Handle unexpected errors during update
    console.error("Error updating trip review:", error);
    return { isSuccess: false, message: "Failed to update review." };
  }
}

/**
 * Deletes a trip review. Only the user who wrote the review can delete it.
 *
 * @param reviewId - The ID of the review to delete.
 * @param userId - The ID of the user attempting the deletion (for permission check).
 * @returns ActionState indicating success or failure, with no data on success.
 */
export async function deleteTripReviewAction(
  reviewId: string,
  userId: string
): Promise<ActionState<void>> {
  try {
    // 1. Find the review to check ownership
    const review = await db.query.tripReviews.findFirst({
      where: eq(tripReviewsTable.id, reviewId),
       columns: { userId: true } // Only need userId for check
    });

    if (!review) {
      return { isSuccess: false, message: "Review not found." };
    }

    // 2. Check ownership/permission
    if (review.userId !== userId) {
      return { isSuccess: false, message: "You can only delete your own reviews." };
    }

    // 3. Delete the review from the database
    await db.delete(tripReviewsTable).where(eq(tripReviewsTable.id, reviewId));

    // Return success state
    return {
      isSuccess: true,
      message: "Review deleted successfully.",
      data: undefined, // No data to return on successful deletion
    };
  } catch (error) {
    // Handle unexpected errors during deletion
    console.error("Error deleting trip review:", error);
    return { isSuccess: false, message: "Failed to delete review." };
  }
}