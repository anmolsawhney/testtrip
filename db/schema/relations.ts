/**
 * @description
 * Defines all Drizzle ORM relations for the application schemas.
 * Centralizing relations in this single file is a best practice to avoid circular
 * dependency issues between schema files that reference each other.
 * UPDATED: Added explicit `relationName` to all forum-related relationships to resolve ambiguity and fix runtime query errors.
 *
 * @dependencies
 * - drizzle-orm: For the `relations` helper function.
 * - All schema table files.
 */

import { relations } from "drizzle-orm"
import {
  profilesTable,
  itinerariesTable,
  matchesTable,
  tripRequestsTable,
  tripMembersTable,
  activitiesTable,
  chatMessagesTable,
  tripPhotosTable,
  tripReviewsTable,
  followsTable,
  likesTable,
  wishlistItemsTable,
  activityFeedEventsTable,
  activityFeedLikesTable,
  activityFeedCommentsTable,
  activityFeedCommentLikesTable,
  directMessageConversationsTable,
  directMessagesTable,
  blocksTable,
  reportsTable,
  postsTable,
  commentsTable,
  votesTable
} from "./"

// --- Forum Relations ---

export const postsRelations = relations(postsTable, ({ one, many }) => ({
  author: one(profilesTable, {
    fields: [postsTable.userId],
    references: [profilesTable.userId]
  }),
  comments: many(commentsTable, { relationName: "PostComments" }),
  votes: many(votesTable, { relationName: "PostVotes" })
}))

export const commentsRelations = relations(commentsTable, ({ one, many }) => ({
  author: one(profilesTable, {
    fields: [commentsTable.userId],
    references: [profilesTable.userId]
  }),
  post: one(postsTable, {
    fields: [commentsTable.postId],
    references: [postsTable.id],
    relationName: "PostComments"
  }),
  parentComment: one(commentsTable, {
    fields: [commentsTable.parentId],
    references: [commentsTable.id],
    relationName: "replies"
  }),
  replies: many(commentsTable, {
    relationName: "replies"
  }),
  votes: many(votesTable, { relationName: "CommentVotes" })
}))

export const votesRelations = relations(votesTable, ({ one }) => ({
  user: one(profilesTable, {
    fields: [votesTable.userId],
    references: [profilesTable.userId]
  }),
  post: one(postsTable, {
    fields: [votesTable.postId],
    references: [postsTable.id],
    relationName: "PostVotes"
  }),
  comment: one(commentsTable, {
    fields: [votesTable.commentId],
    references: [commentsTable.id],
    relationName: "CommentVotes"
  })
}))

// --- Existing App Relations ---

export const profilesRelations = relations(profilesTable, ({ many }) => ({
  createdItineraries: many(itinerariesTable, { relationName: "trip_creator" }),
  memberships: many(tripMembersTable, { relationName: "trip_member_to_user" }),
  uploadedPhotos: many(tripPhotosTable, { relationName: "photo_uploader" }),
  reviewsWritten: many(tripReviewsTable, { relationName: "review_author" }),
  following: many(followsTable, { relationName: "user_followers" }),
  followers: many(followsTable, { relationName: "user_following" }),
  likesGiven: many(likesTable, { relationName: "user_likes" }),
  wishlistItems: many(wishlistItemsTable, { relationName: "user_wishlist" }),
  reportsSubmitted: many(reportsTable, { relationName: "report_reporter" }),
  reportsReceived: many(reportsTable, { relationName: "report_reported" }),
  activityEvents: many(activityFeedEventsTable, {
    relationName: "activity_user"
  }),
  targetedActivityEvents: many(activityFeedEventsTable, {
    relationName: "activity_target_user"
  }),
  dmConversationsAsUser1: many(directMessageConversationsTable, {
    relationName: "dm_user1"
  }),
  dmConversationsAsUser2: many(directMessageConversationsTable, {
    relationName: "dm_user2"
  }),
  messagesSent: many(directMessagesTable, { relationName: "dm_sender" }),
  blocksInitiated: many(blocksTable, { relationName: "block_blocker" }),
  blocksReceived: many(blocksTable, { relationName: "block_blocked" }),
  matchesAsUser1: many(matchesTable, { relationName: "match_user1" }),
  matchesAsUser2: many(matchesTable, { relationName: "match_user2" }),
  tripRequestsMade: many(tripRequestsTable, { relationName: "trip_requester" }),
  posts: many(postsTable)
}))

export const itinerariesRelations = relations(
  itinerariesTable,
  ({ one, many }) => ({
    creator: one(profilesTable, {
      fields: [itinerariesTable.creatorId],
      references: [profilesTable.userId],
      relationName: "trip_creator"
    }),
    requests: many(tripRequestsTable, {
      relationName: "trip_requests_to_itinerary"
    }),
    members: many(tripMembersTable, {
      relationName: "trip_members_to_itinerary"
    }),
    tripPhotos: many(tripPhotosTable, {
      relationName: "trip_photos_to_itinerary"
    }),
    reviews: many(tripReviewsTable, {
      relationName: "trip_reviews_to_itinerary"
    }),
    likes: many(likesTable, {
      relationName: "likes_to_itinerary"
    }),
    wishlistItems: many(wishlistItemsTable, {
      relationName: "wishlist_items_to_itinerary"
    }),
    activities: many(activitiesTable, {
      relationName: "activities_to_itinerary"
    })
  })
)

export const tripRequestsRelations = relations(
  tripRequestsTable,
  ({ one }) => ({
    trip: one(itinerariesTable, {
      fields: [tripRequestsTable.tripId],
      references: [itinerariesTable.id],
      relationName: "trip_requests_to_itinerary"
    }),
    requester: one(profilesTable, {
      fields: [tripRequestsTable.userId],
      references: [profilesTable.userId],
      relationName: "trip_requester"
    })
  })
)

export const matchesRelations = relations(matchesTable, ({ one }) => ({
  user1: one(profilesTable, {
    fields: [matchesTable.userId1],
    references: [profilesTable.userId],
    relationName: "match_user1"
  }),
  user2: one(profilesTable, {
    fields: [matchesTable.userId2],
    references: [profilesTable.userId],
    relationName: "match_user2"
  }),
  initiator: one(profilesTable, {
    fields: [matchesTable.initiatedBy],
    references: [profilesTable.userId],
    relationName: "match_initiator"
  })
}))

export const tripMembersRelations = relations(tripMembersTable, ({ one }) => ({
  trip: one(itinerariesTable, {
    fields: [tripMembersTable.tripId],
    references: [itinerariesTable.id],
    relationName: "trip_members_to_itinerary"
  }),
  user: one(profilesTable, {
    fields: [tripMembersTable.userId],
    references: [profilesTable.userId],
    relationName: "trip_member_to_user"
  })
}))

export const activitiesRelations = relations(activitiesTable, ({ one }) => ({
  trip: one(itinerariesTable, {
    fields: [activitiesTable.tripId],
    references: [itinerariesTable.id],
    relationName: "activities_to_itinerary"
  })
}))

export const chatMessagesRelations = relations(
  chatMessagesTable,
  ({ one }) => ({
    trip: one(itinerariesTable, {
      fields: [chatMessagesTable.tripId],
      references: [itinerariesTable.id],
      relationName: "chat_messages_to_itinerary"
    }),
    sender: one(profilesTable, {
      fields: [chatMessagesTable.senderId],
      references: [profilesTable.userId],
      relationName: "chat_message_sender"
    })
  })
)

export const tripPhotosRelations = relations(tripPhotosTable, ({ one }) => ({
  trip: one(itinerariesTable, {
    fields: [tripPhotosTable.tripId],
    references: [itinerariesTable.id],
    relationName: "trip_photos_to_itinerary"
  }),
  uploader: one(profilesTable, {
    fields: [tripPhotosTable.userId],
    references: [profilesTable.userId],
    relationName: "photo_uploader"
  })
}))

export const tripReviewsRelations = relations(tripReviewsTable, ({ one }) => ({
  trip: one(itinerariesTable, {
    fields: [tripReviewsTable.tripId],
    references: [itinerariesTable.id],
    relationName: "trip_reviews_to_itinerary"
  }),
  author: one(profilesTable, {
    fields: [tripReviewsTable.userId],
    references: [profilesTable.userId],
    relationName: "review_author"
  })
}))

export const followsRelations = relations(followsTable, ({ one }) => ({
  follower: one(profilesTable, {
    fields: [followsTable.followerId],
    references: [profilesTable.userId],
    relationName: "user_followers"
  }),
  following: one(profilesTable, {
    fields: [followsTable.followingId],
    references: [profilesTable.userId],
    relationName: "user_following"
  })
}))

export const likesRelations = relations(likesTable, ({ one }) => ({
  user: one(profilesTable, {
    fields: [likesTable.userId],
    references: [profilesTable.userId],
    relationName: "user_likes"
  }),
  itinerary: one(itinerariesTable, {
    fields: [likesTable.itineraryId],
    references: [itinerariesTable.id],
    relationName: "likes_to_itinerary"
  })
}))

export const wishlistItemsRelations = relations(
  wishlistItemsTable,
  ({ one }) => ({
    user: one(profilesTable, {
      fields: [wishlistItemsTable.userId],
      references: [profilesTable.userId],
      relationName: "user_wishlist"
    }),
    itinerary: one(itinerariesTable, {
      fields: [wishlistItemsTable.itineraryId],
      references: [itinerariesTable.id],
      relationName: "wishlist_items_to_itinerary"
    })
  })
)

export const activityFeedEventsRelations = relations(
  activityFeedEventsTable,
  ({ one }) => ({
    user: one(profilesTable, {
      fields: [activityFeedEventsTable.userId],
      references: [profilesTable.userId],
      relationName: "activity_user"
    }),
    targetUser: one(profilesTable, {
      fields: [activityFeedEventsTable.targetUserId],
      references: [profilesTable.userId],
      relationName: "activity_target_user"
    })
  })
)

export const activityFeedLikesRelations = relations(
  activityFeedLikesTable,
  ({ one }) => ({
    user: one(profilesTable, {
      fields: [activityFeedLikesTable.userId],
      references: [profilesTable.userId],
      relationName: "activity_like_user"
    }),
    event: one(activityFeedEventsTable, {
      fields: [activityFeedLikesTable.eventId],
      references: [activityFeedEventsTable.id],
      relationName: "activity_like_event"
    })
  })
)

export const activityFeedCommentsRelations = relations(
  activityFeedCommentsTable,
  ({ one, many }) => ({
    event: one(activityFeedEventsTable, {
      fields: [activityFeedCommentsTable.eventId],
      references: [activityFeedEventsTable.id],
      relationName: "activity_comment_event"
    }),
    user: one(profilesTable, {
      fields: [activityFeedCommentsTable.userId],
      references: [profilesTable.userId],
      relationName: "activity_comment_user"
    }),
    parentComment: one(activityFeedCommentsTable, {
      fields: [activityFeedCommentsTable.parentCommentId],
      references: [activityFeedCommentsTable.id],
      relationName: "comment_replies"
    }),
    replies: many(activityFeedCommentsTable, {
      relationName: "comment_replies"
    })
  })
)

export const activityFeedCommentLikesRelations = relations(
  activityFeedCommentLikesTable,
  ({ one }) => ({
    user: one(profilesTable, {
      fields: [activityFeedCommentLikesTable.userId],
      references: [profilesTable.userId],
      relationName: "activity_comment_like_user"
    }),
    comment: one(activityFeedCommentsTable, {
      fields: [activityFeedCommentLikesTable.commentId],
      references: [activityFeedCommentsTable.id],
      relationName: "activity_comment_like_comment"
    })
  })
)

export const directMessagesRelations = relations(
  directMessagesTable,
  ({ one }) => ({
    conversation: one(directMessageConversationsTable, {
      fields: [directMessagesTable.conversationId],
      references: [directMessageConversationsTable.id],
      relationName: "messages_to_conversation"
    }),
    sender: one(profilesTable, {
      fields: [directMessagesTable.senderId],
      references: [profilesTable.userId],
      relationName: "dm_sender"
    })
  })
)

export const directMessageConversationsRelations = relations(
  directMessageConversationsTable,
  ({ one, many }) => ({
    user1: one(profilesTable, {
      fields: [directMessageConversationsTable.user1Id],
      references: [profilesTable.userId],
      relationName: "dm_user1"
    }),
    user2: one(profilesTable, {
      fields: [directMessageConversationsTable.user2Id],
      references: [profilesTable.userId],
      relationName: "dm_user2"
    }),
    lastMessage: one(directMessagesTable, {
      fields: [directMessageConversationsTable.lastMessageId],
      references: [directMessagesTable.id],
      relationName: "conversation_last_message"
    }),
    messages: many(directMessagesTable, {
      relationName: "messages_to_conversation"
    })
  })
)

export const blocksRelations = relations(blocksTable, ({ one }) => ({
  blocker: one(profilesTable, {
    fields: [blocksTable.blockerId],
    references: [profilesTable.userId],
    relationName: "block_blocker"
  }),
  blocked: one(profilesTable, {
    fields: [blocksTable.blockedId],
    references: [profilesTable.userId],
    relationName: "block_blocked"
  })
}))

export const reportsRelations = relations(reportsTable, ({ one }) => ({
  reporter: one(profilesTable, {
    fields: [reportsTable.reporterId],
    references: [profilesTable.userId],
    relationName: "report_reporter"
  }),
  reported: one(profilesTable, {
    fields: [reportsTable.reportedId],
    references: [profilesTable.userId],
    relationName: "report_reported"
  })
}))
