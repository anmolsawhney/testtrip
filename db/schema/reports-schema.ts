/**
 * @description
 * Defines the database schema for the 'reports' table in TripRizz.
 * This table stores user-submitted reports regarding other users or content.
 *
 * Key features:
 * - Tracks reporter and reported users.
 * - Uses enums for report reasons and status workflow.
 * - Allows optional detailed description and admin notes.
 * - Foreign keys link to profiles, handling user deletion appropriately.
 * - Includes standard audit timestamps.
 * - Indexes for efficient querying by status and reported user.
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition primitives (pgTable, uuid, text, timestamp).
 * - "./profiles-schema": For referencing the profilesTable.
 * - "./enums": For referencing shared enums (reportReasonEnum, reportStatusEnum).
 *
 * @notes
 * - Relations for this table are defined centrally in `db/schema/relations.ts`.
 */

import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core"
import { profilesTable } from "./profiles-schema"
import { reportReasonEnum, reportStatusEnum } from "./enums"

export const reportsTable = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => profilesTable.userId, {
        onDelete: "set null",
        onUpdate: "cascade"
      }),
    reportedId: text("reported_id")
      .notNull()
      .references(() => profilesTable.userId, {
        onDelete: "cascade",
        onUpdate: "cascade"
      }),
    reason: reportReasonEnum("reason").notNull(),
    description: text("description"),
    status: reportStatusEnum("status").default("pending").notNull(),
    adminNotes: text("admin_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => {
    return {
      statusIdx: index("reports_status_idx").on(table.status),
      reportedIdx: index("reports_reported_idx").on(table.reportedId)
    }
  }
)

export type InsertReport = typeof reportsTable.$inferInsert
export type SelectReport = typeof reportsTable.$inferSelect
