/**
 * @description
 * User profile schema with fields for basic info, verification, gender, travel preferences,
 * and personalized question answers.
 * UPDATED: Renamed `displayName` to `username` and set it as a unique identifier. Added `firstName` and `lastName`.
 * UPDATED: Added `verificationOutcomeNotifiedAt` and `verificationOutcomeDismissed` to support notifications for verification results.
 * UPDATED: Added `hasCompletedGuidedTour` flag to track user's completion of the onboarding tutorial.
 *
 * Key features:
 * - User identification and basic info (firstName, lastName, unique username).
 * - Verification status, document path, and selfie photo path.
 * - Gender fields (`gender`, `verifiedGender`).
 * - `profile_questions_completed` flag to track questionnaire completion.
 * - Social media handles and profile visibility.
 * - `last_checked_notifications_at` timestamp for notification system.
 * - Fields for tracking verification outcome notifications.
 * - `hasCompletedGuidedTour` flag for one-time onboarding tour.
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition and column types.
 * - "drizzle-orm": For sql utility.
 * - "./enums": For shared enums.
 *
 * @notes
 * - Relations for this table are defined in `db/schema/relations.ts`.
 */

import {
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  date
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import {
  verificationStatusEnum,
  budgetPreferenceEnum,
  genderEnum
} from "./enums"

export const profilesTable = pgTable("profiles", {
  userId: text("user_id").primaryKey().notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  username: varchar("username", { length: 30 }).notNull().unique(),
  bio: text("bio"),
  dateOfBirth: date("date_of_birth"),
  location: text("location"),
  verificationStatus: verificationStatusEnum("verification_status")
    .default("none")
    .notNull(),
  verificationDocument: text("verification_document"),
  selfiePhoto: text("selfie_photo"),
  gender: genderEnum("gender"),
  verifiedGender: genderEnum("verified_gender"),
  profilePhoto: text("profile_photo"),
  languagesSpoken: text("languages_spoken")
    .array()
    .default(sql`'{}'::text[]`),
  budgetPreference: budgetPreferenceEnum("budget_preference"),
  travelPreferences: text("travel_preferences")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  qTravelMood: text("q_travel_mood"),
  qNightOwl: text("q_night_owl"),
  qTravelAnthem: text("q_travel_anthem"),
  qTravelPlaylist: text("q_travel_playlist"),
  qMustPack: text("q_must_pack"),
  qBuddyVibe: text("q_buddy_vibe"),
  qPetPeeve: text("q_pet_peeve"),
  qGroupRole: text("q_group_role"),
  qGroupActivities: text("q_group_activities"),
  qUnwindMethod: text("q_unwind_method"),
  qFoodAdventure: text("q_food_adventure"),
  qTravelIck: text("q_travel_ick"),
  qBucketListGoal: text("q_bucket_list_goal"),
  qNextDestination: text("q_next_destination"),
  instagramHandle: varchar("instagram_handle", { length: 30 }),
  snapchatHandle: varchar("snapchat_handle", { length: 30 }),
  isPublic: boolean("is_public").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastCheckedNotificationsAt: timestamp("last_checked_notifications_at"),
  profileQuestionsCompleted: boolean("profile_questions_completed")
    .default(false)
    .notNull(),
  // Fields for verification outcome notifications
  verificationOutcomeNotifiedAt: timestamp("verification_outcome_notified_at"),
  verificationOutcomeDismissed: boolean("verification_outcome_dismissed")
    .default(false)
    .notNull(),
  // Field for one-time guided tour
  hasCompletedGuidedTour: boolean("has_completed_guided_tour")
    .default(false)
    .notNull()
})

export type InsertProfile = typeof profilesTable.$inferInsert
export type SelectProfile = typeof profilesTable.$inferSelect
