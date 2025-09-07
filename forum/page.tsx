/**
 * @description
 * This server component serves as the main page for the Riffle forum. It handles
 * user authentication and orchestrates the fetching and display of the post feed.
 * UPDATED: The "Create Post" button now uses the app's primary gradient style for consistency.
 *
 * Key features:
 * - Ensures the user is authenticated before allowing access.
 * - Uses React Suspense to show a loading skeleton while initial data is being fetched.
 * - Delegates data fetching to a dedicated async component (`PostFeedFetcher`).
 * - Provides the main layout and title for the forum feed page.
 *
 * @dependencies
 * - react: For `Suspense`.
 * - @clerk/nextjs/server: For `auth()` to handle user authentication.
 * - next/navigation: For `redirect`.
 * - @/actions/db/posts-actions: For fetching posts.
 * - @/types: For the `PostWithAuthorAndVote` type.
 * - ./_components/post-feed: The client component that renders the interactive feed.
 * - ./_components/post-feed-skeleton: The skeleton component for the loading state.
 */
"use server"

import { Suspense } from "react"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { getPostsAction } from "@/actions/db/posts-actions"
import type { PostWithAuthorAndVote } from "@/types"
import PostFeed from "./_components/post-feed"
import PostFeedSkeleton from "./_components/post-feed-skeleton"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"

const INITIAL_POST_LIMIT = 10

/**
 * An async server component responsible for fetching the initial batch of posts.
 * This component's execution is awaited within the Suspense boundary, allowing the
 * main page to render instantly while data is fetched.
 * @returns {Promise<JSX.Element>} The `PostFeed` client component hydrated with initial data.
 */
async function PostFeedFetcher() {
  const result = await getPostsAction({
    sortBy: "score", // Default sort by score (trending)
    limit: INITIAL_POST_LIMIT,
    offset: 0
  })

  const initialPosts: PostWithAuthorAndVote[] = []
  if (result.isSuccess) {
    initialPosts.push(...result.data)
  } else {
    // Silently log the error on the server. The client component will show an empty state.
    console.error(
      "[PostFeedFetcher] Failed to load initial posts:",
      result.message
    )
  }

  return (
    <PostFeed
      initialPosts={initialPosts}
      initialHasMore={initialPosts.length === INITIAL_POST_LIMIT}
    />
  )
}

export default async function ForumPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect("/login?redirect_url=/forum")
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 pb-8 pt-24">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Forum</h1>
        <Button asChild className="bg-gradient-1 text-white hover:opacity-90">
          <Link href="/posts/new">
            <Plus className="mr-2 size-4" />
            Create Post
          </Link>
        </Button>
      </div>

      <Suspense fallback={<PostFeedSkeleton />}>
        <PostFeedFetcher />
      </Suspense>
    </div>
  )
}
