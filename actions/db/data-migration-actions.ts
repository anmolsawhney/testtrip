"use server";

/**
 * @description
 * Server action for performing a one-time data migration from the old 'matches'
 * system to the new 'follows' system in TripRizz.
 * This action converts existing 'accepted' matches into mutual 'accepted' follows.
 *
 * Key features:
 * - Fetches all accepted matches.
 * - Inserts corresponding mutual follow records into the follows table.
 * - Uses 'ON CONFLICT DO NOTHING' to handle potential duplicates or re-runs safely.
 * - Provides logging for progress and errors.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions (matchesTable, followsTable).
 * - "@/types": ActionState type definition.
 * - "drizzle-orm": For database query functions (eq).
 *
 * @notes
 * - This action is designed to be run MANUALLY ONCE after the deployment of the follow feature.
 * - It does not delete data from the `matches` table; that should be done separately after successful migration.
 * - Ensure database backups are taken before running this migration.
 */

import { db } from "@/db/db";
import { matchesTable, followsTable } from "@/db/schema";
import { ActionState } from "@/types";
import { eq } from "drizzle-orm";

/**
 * Migrates existing accepted matches to the new follows system.
 * Fetches all matches with status 'accepted' and creates two corresponding
 * 'accepted' follow records for each match (one in each direction).
 *
 * @returns {Promise<ActionState<void>>} ActionState indicating success or failure of the migration.
 */
export async function migrateMatchesToFollowsAction(): Promise<ActionState<void>> {
  console.log("[Data Migration] Starting migration from matches to follows...");
  try {
    // 1. Fetch all accepted matches
    const acceptedMatches = await db.query.matches.findMany({
      where: eq(matchesTable.status, "accepted"),
    });

    console.log(
      `[Data Migration] Found ${acceptedMatches.length} accepted matches to migrate.`
    );

    if (acceptedMatches.length === 0) {
      console.log("[Data Migration] No accepted matches found. Migration skipped.");
      return {
        isSuccess: true,
        message: "No accepted matches to migrate.",
        data: undefined,
      };
    }

    // 2. Prepare follow records for insertion
    const followsToInsert: {
      followerId: string;
      followingId: string;
      status: "accepted";
    }[] = [];

    acceptedMatches.forEach((match) => {
      // Insert follow: userId1 -> userId2
      followsToInsert.push({
        followerId: match.userId1,
        followingId: match.userId2,
        status: "accepted",
      });
      // Insert follow: userId2 -> userId1
      followsToInsert.push({
        followerId: match.userId2,
        followingId: match.userId1,
        status: "accepted",
      });
    });

    console.log(
      `[Data Migration] Prepared ${followsToInsert.length} follow records for insertion.`
    );

    // 3. Insert follow records in batch with ON CONFLICT DO NOTHING
    if (followsToInsert.length > 0) {
      // Use db.insert with .values() for batch insert and add onConflictDoNothing()
      const insertResult = await db
        .insert(followsTable)
        .values(followsToInsert)
        .onConflictDoNothing(); // Ignore conflicts (e.g., if migration runs twice or follow already exists)

      // Note: insertResult for onConflictDoNothing might not return detailed info easily across all drivers.
      // We log the attempt count. Success is assumed if no error is thrown.
      console.log(
        `[Data Migration] Attempted to insert ${followsToInsert.length} follow records. Conflicts were ignored.`
      );
    }

    console.log(
      "[Data Migration] Migration from matches to follows completed successfully."
    );
    return {
      isSuccess: true,
      message: "Matches successfully migrated to follows.",
      data: undefined,
    };
  } catch (error) {
    console.error("Error during matches to follows migration:", error);
    return {
      isSuccess: false,
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during migration.",
    };
  }
}