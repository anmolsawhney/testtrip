/**
 * @description
 * Server actions for managing trip photo database records in TripRizz.
 * Provides functionality for creating, retrieving, and managing photo metadata associated with trips.
 * Includes the action for uploading multiple photos, coordinating storage and DB operations.
 * Actual file upload/deletion is handled by storage actions.
 * Integrates with Activity Feed.
 * Uses `isTripEffectivelyCompleted` for consistent permission checks.
 * UPDATED: `getTripPhotosAction` now uses an `innerJoin` to filter out photos from soft-deleted users.
 *
 * Key features:
 * - Create Photo Record: Adds a photo metadata entry after storage upload.
 * - Upload Multiple Photos (Batch): Handles storage upload and DB record creation for multiple files.
 * - Get Photos: Retrieves photo records for a trip, including uploader info, and filters out content from deleted users.
 * - Get User Photos: Retrieves all photos uploaded by a specific user.
 * - Update Photo Caption: Allows users to edit photo captions.
 * - Delete Photo Record: Removes photo metadata (requires separate storage deletion).
 * - Activity Feed Integration: Logs 'new_photo' events.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions.
 * - "@/types": ActionState type definition.
 * - "drizzle-orm": For database operations.
 * - "./activity-feed-actions": For creating activity feed events.
 * - "@/actions/storage/trip-photos-storage-actions": For handling file storage uploads/deletions.
 * - "@clerk/nextjs/server": For authentication.
 * - "@/lib/trip-utils": For `isTripEffectivelyCompleted` helper.
 */
"use server";

import { db } from "@/db/db";
import {
  tripPhotosTable,
  InsertTripPhoto,
  SelectTripPhoto,
  itinerariesTable,
  tripMembersTable,
  profilesTable,
  SelectProfile,
} from "@/db/schema";
import { ActionState } from "@/types";
import { and, desc, eq, sql, like, not } from "drizzle-orm";
import { createActivityEventAction } from "./activity-feed-actions";
// Import the specific storage action function needed (upload ONLY, not banner)
import {
    uploadPhotoAction as uploadToStorageAction, // Use the single photo uploader
    deletePhotoAction as deleteFromStorageAction // Need delete for rollback
} from "@/actions/storage/trip-photos-storage-actions";
import { auth } from "@clerk/nextjs/server"; // Import auth
import { isTripEffectivelyCompleted } from "@/lib/trip-utils"; // Import the helper

/**
 * Adds a photo record to the database after successful storage upload.
 * Performs permission checks (must be member, trip completed for non-owners).
 * Also creates an activity feed event.
 * This is intended to be called internally by the batch upload action.
 *
 * @param data - Data for the new photo (`InsertTripPhoto`). Must include photoUrl.
 * @returns Promise resolving to `ActionState` with the created `SelectTripPhoto` or an error.
 */
export async function createTripPhotoRecordAction(
  data: InsertTripPhoto
): Promise<ActionState<SelectTripPhoto>> {
  try {
    if (!data.tripId || !data.userId || !data.photoUrl) {
      return { isSuccess: false, message: "Missing required fields: tripId, userId, photoUrl" };
    }

    const trip = await db.query.itineraries.findFirst({ where: eq(itinerariesTable.id, data.tripId), columns: { status: true, creatorId: true, tripType: true, endDate: true } }); // Added endDate
    if (!trip) return { isSuccess: false, message: "Trip not found" };

    const isMember = await db.query.tripMembers.findFirst({ where: and( eq(tripMembersTable.tripId, data.tripId), eq(tripMembersTable.userId, data.userId) ), columns: { id: true } });
    if (!isMember) return { isSuccess: false, message: "You must be a member to upload photos" };

    const isOwner = trip.creatorId === data.userId;
    const isEffectivelyCompleted = isTripEffectivelyCompleted(trip);
    const canUpload = isOwner || (isEffectivelyCompleted && (trip.tripType === "group" || trip.tripType === "women_only"));

    if (!canUpload) return { isSuccess: false, message: "Photos can only be uploaded by the owner, or by members of completed group/women-only trips." };

    const [newPhoto] = await db.insert(tripPhotosTable).values({ ...data, caption: data.caption?.trim() || null }).returning();
    if (!newPhoto) throw new Error("Photo record creation failed.");

    // Add to itinerary photos array if not already present
    const currentTrip = await db.query.itineraries.findFirst({ where: eq(itinerariesTable.id, data.tripId), columns: { photos: true } });
    const existingPhotos = currentTrip?.photos ?? [];
    if (data.photoUrl && !existingPhotos.includes(data.photoUrl)) {
      await db.update(itinerariesTable).set({ photos: [...existingPhotos, data.photoUrl], updatedAt: new Date() }).where(eq(itinerariesTable.id, data.tripId));
    }

    // Create activity feed event after successful DB insert and photos array update
    await createActivityEventAction({ userId: newPhoto.userId, eventType: 'new_photo', relatedId: newPhoto.id, eventData: { tripId: newPhoto.tripId, photoUrl: newPhoto.photoUrl } }); // Include photoUrl in eventData


    console.log(`[Action createTripPhotoRecord] Added photo record ${newPhoto.id}`);
    return { isSuccess: true, message: "Trip photo record created successfully", data: newPhoto };
  } catch (error) {
    console.error("[Action createTripPhotoRecord] Error:", error);
    return { isSuccess: false, message: error instanceof Error ? error.message : "Failed to create trip photo record" };
  }
}

/**
 * Handles the upload of multiple trip photos, coordinating storage and database record creation.
 * Uses calculated completion status for permission checks.
 *
 * @param tripId - The ID of the trip.
 * @param userId - The ID of the user uploading.
 * @param files - An array of File objects to upload.
 * @param captions - Optional array of captions corresponding to the files array.
 * @returns ActionState containing arrays of successful uploads and failed files.
 */
export async function uploadMultipleTripPhotosAction(
  tripId: string,
  userId: string,
  files: File[],
  captions?: (string | null)[] // Optional captions per file
): Promise<
  ActionState<{
    successfulUploads: SelectTripPhoto[];
    failedFiles: { name: string; error: string }[];
  }>
> {
  const successfulUploads: SelectTripPhoto[] = [];
  const failedFiles: { name: string; error: string }[] = [];

  console.log(`[Action uploadMultiple] Starting batch upload for ${files.length} files. Trip: ${tripId}, User: ${userId}`);

  if (!files || files.length === 0) {
    return { isSuccess: false, message: "No files provided for upload." };
  }

  // Check permission ONCE before starting the loop
    const tripPerm = await db.query.itineraries.findFirst({ where: eq(itinerariesTable.id, tripId), columns: { status: true, creatorId: true, tripType: true, endDate: true } });
    if (!tripPerm) return { isSuccess: false, message: "Trip not found." };
    const isMemberPerm = await db.query.tripMembers.findFirst({ where: and( eq(tripMembersTable.tripId, tripId), eq(tripMembersTable.userId, userId) ), columns: { id: true } });
    if (!isMemberPerm) return { isSuccess: false, message: "User must be a member to upload." };
    const isOwnerPerm = tripPerm.creatorId === userId;
    const isEffectivelyCompletedPerm = isTripEffectivelyCompleted(tripPerm);
    const canUploadPerm = isOwnerPerm || (isEffectivelyCompletedPerm && (tripPerm.tripType === "group" || tripPerm.tripType === "women_only"));

    if (!canUploadPerm) {
        console.error("[Action uploadMultiple] Permission check failed.");
        return { isSuccess: false, message: "Upload permission denied based on trip status/role." };
    }
  // --- End Permission Check ---


  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const caption = captions?.[i] ?? null;
    let uploadedPath: string | null = null;
    console.log(`[Action uploadMultiple] Processing file ${i + 1}/${files.length}: ${file.name}`);

    try {
      // 1. Upload to Storage using the single storage action
      console.log(`[Action uploadMultiple] Calling storage upload for ${file.name}...`);
      const storageResult = await uploadToStorageAction(tripId, userId, file);

      if (!storageResult.isSuccess || !storageResult.data?.path || !storageResult.data?.publicUrl) {
        console.warn(`[Action uploadMultiple] Storage upload failed for ${file.name}: ${storageResult.message}`);
        throw new Error(storageResult.message || `Storage upload failed for ${file.name}`);
      }
      uploadedPath = storageResult.data.path;
      const publicUrl = storageResult.data.publicUrl;
      console.log(`[Action uploadMultiple] Storage upload successful. Path: ${uploadedPath}, URL: ${publicUrl}`);

      // 2. Create Database Record using the dedicated action (now in this file)
      const dbData: InsertTripPhoto = { tripId, userId, photoUrl: publicUrl, caption };
      console.log(`[Action uploadMultiple] Calling DB record creation for ${file.name}...`);
      const dbResult = await createTripPhotoRecordAction(dbData);

      if (!dbResult.isSuccess || !dbResult.data) {
        console.warn(`[Action uploadMultiple] DB record creation failed for ${file.name}: ${dbResult.message}`);
        if (uploadedPath) {
            console.warn(`[Action uploadMultiple] Rolling back storage for ${file.name} at path ${uploadedPath}`);
            await deleteFromStorageAction(uploadedPath);
        }
        throw new Error(dbResult.message || `Database record creation failed for ${file.name}`);
      }
      console.log(`[Action uploadMultiple] DB record created: ${dbResult.data.id}`);
      successfulUploads.push(dbResult.data);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown upload error";
      console.error(`[Action uploadMultiple] Error processing file ${file.name}: ${errorMessage}`);
      failedFiles.push({ name: file.name, error: errorMessage });
    }
  }

  console.log(`[Action uploadMultiple] Batch finished. Success: ${successfulUploads.length}, Failed: ${failedFiles.length}`);
  const overallSuccess = successfulUploads.length > 0;
  let overallMessage = "";
  if (successfulUploads.length === files.length) overallMessage = "All photos uploaded successfully.";
  else if (successfulUploads.length > 0) {
    overallMessage = `Uploaded ${successfulUploads.length}/${files.length} photos. Failed:`;
    failedFiles.forEach(f => overallMessage += `\n- ${f.name}: ${f.error}`);
  } else {
    overallMessage = `Upload failed. Errors:`;
    failedFiles.forEach(f => overallMessage += `\n- ${f.name}: ${f.error}`);
  }

  if (overallSuccess || successfulUploads.length > 0) {
    return { isSuccess: true, message: overallMessage, data: { successfulUploads, failedFiles } };
  } else {
    return { isSuccess: false, message: overallMessage };
  }
}


/**
 * Retrieves photo records for a specific trip, ordered by creation date descending.
 * Includes joining with uploader profile data if requested.
 *
 * @param tripId - The ID of the trip whose photos to fetch.
 * @param includeUploader - Optional boolean to include uploader profile info. Default false.
 * @returns Promise resolving to `ActionState` with an array of photo objects including uploader info.
 */
export async function getTripPhotosAction(
  tripId: string,
  includeUploader: boolean = false
): Promise<ActionState<(SelectTripPhoto & { uploader?: SelectProfile | null })[]>> {
  try {
     if (!tripId) {
         return { isSuccess: false, message: "Trip ID is required." };
     }
     console.log(`[Action getTripPhotos] Fetching photos for trip ${tripId}. Include uploader: ${includeUploader}`);

    if (includeUploader) {
      const results = await db.select({ photo: tripPhotosTable, uploader: profilesTable })
        .from(tripPhotosTable)
        .innerJoin(profilesTable, and(
          eq(tripPhotosTable.userId, profilesTable.userId),
          not(like(profilesTable.username, "deleted_%"))
        ))
        .where(eq(tripPhotosTable.tripId, tripId))
        .orderBy(desc(tripPhotosTable.createdAt));
       console.log(`[Action getTripPhotos] Found ${results.length} photos with uploader info.`);
      const photosWithUploader = results.map((r) => ({ ...r.photo, uploader: r.uploader ?? null }));
      return { isSuccess: true, message: "Trip photos retrieved.", data: photosWithUploader };
    } else {
      const photos = await db.select().from(tripPhotosTable).where(eq(tripPhotosTable.tripId, tripId)).orderBy(desc(tripPhotosTable.createdAt));
      console.log(`[Action getTripPhotos] Found ${photos.length} photos without uploader info.`);
      return { isSuccess: true, message: "Trip photos retrieved.", data: photos };
    }
  } catch (error) {
    console.error(`Error getting photos for trip (${tripId}):`, error);
    return { isSuccess: false, message: "Failed to get trip photos" };
  }
}

/**
 * Retrieves all photo records uploaded by a specific user, ordered by creation date descending.
 * Optionally includes basic trip info (id, title) if `includeTripInfo` is true.
 *
 * @param userId - The ID of the user whose photos to fetch.
 * @param includeTripInfo - If true, joins with itineraries table for trip context.
 * @returns Promise resolving to `ActionState` with an array of photo objects (optionally with basic trip info).
 */
export async function getUserUploadedPhotosAction(
  userId: string,
  includeTripInfo: boolean = false // Default to false
): Promise<ActionState<(SelectTripPhoto & { trip?: { id: string, title: string } | null })[]>> {
  try {
    if (!userId) {
      return { isSuccess: false, message: "User ID is required." };
    }
     console.log(`[Action getUserUploadedPhotos] Fetching photos for user ${userId}. Include trip info: ${includeTripInfo}`);

    let photos: (SelectTripPhoto & { trip?: { id: string, title: string } | null })[];

    if (includeTripInfo) {
        const results = await db
            .select({
                photo: tripPhotosTable,
                trip: {
                    id: itinerariesTable.id,
                    title: itinerariesTable.title
                }
            })
            .from(tripPhotosTable)
            .leftJoin(itinerariesTable, eq(tripPhotosTable.tripId, itinerariesTable.id))
            .where(eq(tripPhotosTable.userId, userId))
            .orderBy(desc(tripPhotosTable.createdAt));
        photos = results.map(r => ({ ...r.photo, trip: r.trip ?? null }));
    } else {
        photos = await db
            .select()
            .from(tripPhotosTable)
            .where(eq(tripPhotosTable.userId, userId))
            .orderBy(desc(tripPhotosTable.createdAt));
    }

    console.log(`[Action getUserUploadedPhotos] Found ${photos.length} photos for user ${userId}.`);
    return { isSuccess: true, message: "User photos retrieved.", data: photos };

  } catch (error) {
    console.error(`Error getting photos for user (${userId}):`, error);
    return { isSuccess: false, message: "Failed to get user photos" };
  }
}


/**
 * Updates the caption of a specific trip photo. Requires user to be the photo owner.
 *
 * @param photoId - The ID of the photo to update.
 * @param userId - The ID of the user attempting the update (for authorization).
 * @param caption - The new caption string (will be trimmed).
 * @returns Promise resolving to `ActionState` with the updated `SelectTripPhoto` or an error.
 */
export async function updateTripPhotoCaptionAction(
  photoId: string,
  userId: string,
  caption: string
): Promise<ActionState<SelectTripPhoto>> {
  try {
    const photo = await db.query.tripPhotos.findFirst({ where: eq(tripPhotosTable.id, photoId), columns: { userId: true } });
    if (!photo) return { isSuccess: false, message: "Photo not found" };
    if (photo.userId !== userId) return { isSuccess: false, message: "You can only update your own photos" };

    const [updatedPhoto] = await db.update(tripPhotosTable).set({ caption: caption.trim() || null, updatedAt: new Date() }).where(eq(tripPhotosTable.id, photoId)).returning();
    if (!updatedPhoto) throw new Error("Failed to update caption.");

    console.log(`[Action updateCaption] Updated caption for photo ${photoId}`);
    return { isSuccess: true, message: "Photo caption updated successfully", data: updatedPhoto };
  } catch (error) {
    console.error(`Error updating caption for photo (${photoId}):`, error);
    return { isSuccess: false, message: "Failed to update photo caption" };
  }
}

/**
 * Deletes a trip photo record from the database.
 * Requires user to be the photo owner or the trip owner.
 * **Note: Does not delete the file from storage.** Storage deletion must be handled separately using the returned `photoUrl`.
 *
 * @param photoId - The ID of the photo record to delete.
 * @param userId - The ID of the user attempting deletion (for authorization).
 * @returns Promise resolving to `ActionState` indicating success or failure. Returns the `photoUrl` on success for separate storage cleanup.
 */
export async function deleteTripPhotoRecordAction( // Renamed to clarify it only handles DB record
  photoId: string,
  userId: string
): Promise<ActionState<{ photoUrl: string | null }>> {
  try {
    const photo = await db.query.tripPhotos.findFirst({ where: eq(tripPhotosTable.id, photoId), columns: { userId: true, tripId: true, photoUrl: true } });
    if (!photo) return { isSuccess: false, message: "Photo record not found" };

    const isPhotoOwner = photo.userId === userId;
    let isTripOwner = false;
    if (!isPhotoOwner) {
      const member = await db.query.tripMembers.findFirst({ where: and( eq(tripMembersTable.tripId, photo.tripId), eq(tripMembersTable.userId, userId), eq(tripMembersTable.role, "owner") ), columns: { id: true } });
      isTripOwner = !!member;
    }
    if (!isPhotoOwner && !isTripOwner) return { isSuccess: false, message: "Permission denied to delete photo record" };

    const deleteResult = await db.delete(tripPhotosTable).where(eq(tripPhotosTable.id, photoId)).returning({ id: tripPhotosTable.id });
    if (deleteResult.length === 0) throw new Error("Failed to delete photo record.");

    // Also remove from the itinerary's photos array
    const trip = await db.query.itineraries.findFirst({ where: eq(itinerariesTable.id, photo.tripId), columns: { photos: true } });
    if (trip && trip.photos && photo.photoUrl && trip.photos.includes(photo.photoUrl)) {
         const updatedPhotos = trip.photos.filter(url => url !== photo.photoUrl);
         await db.update(itinerariesTable).set({ photos: updatedPhotos, updatedAt: new Date() }).where(eq(itinerariesTable.id, photo.tripId));
    }

    console.log(`[Action deleteTripPhotoRecord] Deleted photo record ${photoId}`);
    return { isSuccess: true, message: "Trip photo record deleted.", data: { photoUrl: photo.photoUrl } };
  } catch (error) {
    console.error(`Error deleting trip photo record (${photoId}):`, error);
    return { isSuccess: false, message: error instanceof Error ? error.message : "Failed to delete trip photo record" };
  }
}