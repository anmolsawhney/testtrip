/**
 * @description
 * Defines the database schema for the 'blocks' table in TripRizz.
 * This table stores records of users blocking other users, supporting different block types.
 *
 * Key features:
 * - Tracks the user initiating the block (`blocker_id`) and the user being blocked (`blocked_id`).
 * - Uses an enum (`block_type`) to specify the scope of the block (e.g., 'dm', 'profile').
 * - Composite primary key ensures a user can only block another user once per block type.
 * - Foreign key constraints linking to the profiles table, ensuring data integrity upon user deletion.
 * - Standard audit timestamp (`created_at`).
 *
 * @dependencies
 * - "drizzle-orm/pg-core": For schema definition primitives.
 * - "./profiles-schema": For referencing the profiles table.
 * - "./enums": For referencing the blockTypeEnum.
 *
 * @notes
 * - Relations for this table are defined centrally in `db/schema/relations.ts`.
 */

import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core"
import { profilesTable } from "./profiles-schema"
import { blockTypeEnum } from "./enums"

export const blocksTable = pgTable(
  "blocks",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    type: blockTypeEnum("type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => {
    return {
      pk: primaryKey({
        columns: [table.blockerId, table.blockedId, table.type]
      })
    }
  }
)

export type InsertBlock = typeof blocksTable.$inferInsert
export type SelectBlock = typeof blocksTable.$inferSelect
