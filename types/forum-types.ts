/**
 * @description
 * Defines types related to the Riffle forum application.
 * These types are used to structure data passed between server actions and client components.
 * UPDATED: Added `commentCount` to `PostWithAuthorAndVote` to support displaying the number of comments on the feed.
 */

import {
  SelectPost,
  SelectProfile,
  SelectVote,
  SelectComment
} from "@/db/schema"

/**
 * @interface PostWithAuthorAndVote
 * @description Extends the base Drizzle 'SelectPost' type.
 * It enriches the post data with the author's full profile, the current
 * logged-in user's vote on that post, and the total comment count.
 * This is the standard shape for post data used throughout the application UI.
 *
 * @property {SelectProfile} author - The complete profile object of the user who created the post.
 * @property {SelectVote | null} userVote - The vote object if the current user has voted on this post, otherwise null.
 * @property {number} commentCount - The total number of comments on the post.
 */
export interface PostWithAuthorAndVote extends SelectPost {
  author: SelectProfile
  userVote: SelectVote | null
  commentCount: number
}

/**
 * @interface CommentWithAuthorAndVote
 * @description Extends the base Drizzle 'SelectComment' type.
 * It enriches the comment data with the author's full profile and the current
 * logged-in user's vote on that comment. This is the standard shape for
 * comment data used throughout the application UI.
 *
 * @property {SelectProfile} author - The complete profile object of the user who created the comment.
 * @property {SelectVote | null} userVote - The vote object if the current user has voted on this comment, otherwise null.
 */
export interface CommentWithAuthorAndVote extends SelectComment {
  author: SelectProfile
  userVote: SelectVote | null
}
