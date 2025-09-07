/**
 * @description
 * Central export file for all database schema TABLE DEFINITIONS and shared enums.
 * This file should NOT export relation definitions to avoid circular dependencies.
 * Other modules should import tables and relations directly from their source files.
 */

// --- Enums ---
export * from "./enums"

// --- Table Schemas ---
export * from "./profiles-schema"
export * from "./itineraries-schema"
export * from "./matches-schema"
export * from "./trip-members-schema"
export * from "./activities-schema"
export * from "./chat-schema"
export * from "./trip-photos-schema"
export * from "./trip-reviews-schema"
export * from "./follows-schema"
export * from "./likes-schema"
export * from "./wishlist-items-schema"
export * from "./activity-feed-events-schema"
export * from "./activity-feed-likes-schema"
export * from "./activity-feed-comments-schema"
export * from "./activity-feed-comment-likes-schema"
export * from "./direct-messages-schema"
export * from "./blocks-schema"
export * from "./reports-schema"
export * from "./posts-schema"
export * from "./comments-schema"
export * from "./votes-schema"
