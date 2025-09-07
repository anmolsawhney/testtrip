/**
 * @description
 * This client component renders the main interactive feed for the forum. It displays
 * an initial set of posts and implements infinite scrolling to fetch more posts as
 * the user scrolls down the page.
 *
 * Key features:
 * - Renders a list of `PostItem` components.
 * - Implements infinite scrolling using `IntersectionObserver` for efficient data loading.
 * - Fetches subsequent pages of posts by calling the `getPostsAction` server action.
 * - Manages loading states for both initial load and subsequent fetches.
 * - Displays a message when the user has reached the end of the feed.
 *
 * @dependencies
 * - react: For state management (`useState`, `useEffect`, `useRef`, `useCallback`).
 * - @/actions/db/posts-actions: The server action for fetching posts.
 * - @/types: For the `PostWithAuthorAndVote` type.
 * - @/components/shared/post-item: The component for rendering a single post.
 * - @/components/ui/skeleton: For displaying loading placeholders.
 *
 * @notes
 * - The component is responsible for all client-side state related to the post feed.
 * - `IntersectionObserver` is a performant way to handle "is in view" checks for triggering actions.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { getPostsAction } from "@/actions/db/posts-actions"
import PostItem from "@/components/shared/post-item"
import { Skeleton } from "@/components/ui/skeleton"
import type { PostWithAuthorAndVote } from "@/types"

const POST_LIMIT_PER_PAGE = 10

interface PostFeedProps {
  initialPosts: PostWithAuthorAndVote[]
  initialHasMore: boolean
}

export default function PostFeed({
  initialPosts,
  initialHasMore
}: PostFeedProps) {
  const [posts, setPosts] = useState(initialPosts)
  const [offset, setOffset] = useState(initialPosts.length)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoading, setIsLoading] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  /**
   * Fetches the next page of posts from the server and appends them to the current list.
   */
  const loadMorePosts = useCallback(async () => {
    // Prevent fetching if already loading or no more posts are available.
    if (isLoading || !hasMore) return

    setIsLoading(true)
    const result = await getPostsAction({
      sortBy: "score",
      limit: POST_LIMIT_PER_PAGE,
      offset
    })

    if (result.isSuccess && result.data.length > 0) {
      setPosts(prevPosts => [...prevPosts, ...result.data])
      setOffset(prevOffset => prevOffset + result.data.length)
      // If the number of posts fetched is less than the limit, we've reached the end.
      setHasMore(result.data.length === POST_LIMIT_PER_PAGE)
    } else {
      // Stop trying to fetch more if the action fails or returns no data.
      setHasMore(false)
    }
    setIsLoading(false)
  }, [offset, hasMore, isLoading])

  /**
   * Sets up the IntersectionObserver to watch the loader element at the bottom of the feed.
   */
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        // If the loader element is intersecting (visible), load more posts.
        if (entries[0].isIntersecting) {
          loadMorePosts()
        }
      },
      { threshold: 1.0 } // Trigger when the element is fully in view.
    )

    const loaderElement = loaderRef.current
    if (loaderElement) {
      observer.observe(loaderElement)
    }

    // Cleanup function to disconnect the observer when the component unmounts.
    return () => {
      if (loaderElement) {
        observer.unobserve(loaderElement)
      }
    }
  }, [loadMorePosts])

  return (
    <div className="space-y-4">
      {posts.map(post => (
        <PostItem key={post.id} post={post} commentCount={post.commentCount} />
      ))}

      {/* Loading skeletons for when fetching the next page */}
      {isLoading &&
        Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card flex rounded-lg border shadow-sm">
            <div className="bg-muted/50 flex flex-col items-center gap-2 p-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-6 rounded" />
              <Skeleton className="size-8 rounded-full" />
            </div>
            <div className="flex-1 space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
              <Skeleton className="h-5 w-3/4 rounded" />
              <Skeleton className="h-4 w-full rounded" />
            </div>
          </div>
        ))}

      {/* Loader element to trigger infinite scroll */}
      <div ref={loaderRef} />

      {!hasMore && posts.length > 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">
          You've reached the end!
        </p>
      )}
    </div>
  )
}
