/**
 * @description
 * Client component to display and manage comments for a specific activity feed event.
 * It fetches and displays existing comments and provides a form to add new ones.
 * Users can edit and delete their own comments.
 * UPDATED: Replaced all instances of `displayName` with `username`.
 * UPDATED: Refactored all forms (new comment, reply, edit) to use `react-hook-form` and `zod` for robust validation and inline error messages.
 *
 * Key features:
 * - Fetches top-level comments for a specific event ID on mount.
 * - Displays a list of comments with user avatars, usernames, and timestamps.
 * - Each comment has a Like button, Reply button, and shows reply/like counts.
 * - Handles on-demand fetching and display of replies for a threaded experience.
 * - Allows authors to edit and delete their own comments with proper validation.
 *
 * @dependencies
 * - react, @clerk/nextjs, lucide-react, next/link
 * - react-hook-form, zod, @hookform/resolvers/zod
 * - @/components/ui/*
 * - @/lib/hooks/use-toast
 * - @/actions/db/activity-feed-comments-actions
 * - @/actions/db/activity-feed-comment-likes-actions
 */
"use client"

import React, { useState, useEffect } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2,
  Send,
  MoreHorizontal,
  Edit,
  Trash2,
  Heart,
  MessageSquare
} from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage
} from "@/components/ui/form"
import { useToast } from "@/lib/hooks/use-toast"
import {
  getCommentsForActivityEventAction,
  createCommentOnActivityEventAction,
  updateCommentAction,
  deleteCommentAction,
  getCommentRepliesAction,
  CommentWithUser
} from "@/actions/db/activity-feed-comments-actions"
import { toggleLikeOnCommentAction } from "@/actions/db/activity-feed-comment-likes-actions"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface CommentSectionProps {
  eventId: string
  onCommentAdded: () => void
  onCommentDeleted: () => void
}

interface ReplyFormProps {
  eventId: string
  parentCommentId: string
  onReplyPosted: (newReply: CommentWithUser) => void
  onCancel: () => void
}

// Zod schema for comment/reply validation
const commentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty.")
    .max(1000, "Comment cannot exceed 1000 characters.")
})

const formatTimeAgo = (date: Date | string | null | undefined): string => {
  if (!date) return ""
  try {
    const dateObj = date instanceof Date ? date : new Date(date)
    if (isNaN(dateObj.getTime())) return ""
    const now = new Date()
    const seconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)

    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  } catch (e) {
    console.error("Error formatting date:", e)
    return ""
  }
}

function ReplyForm({
  eventId,
  parentCommentId,
  onReplyPosted,
  onCancel
}: ReplyFormProps) {
  const { user } = useUser()
  const { toast } = useToast()

  const form = useForm<z.infer<typeof commentSchema>>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" }
  })
  const { isSubmitting } = form.formState

  const handlePostReply = async (values: z.infer<typeof commentSchema>) => {
    const result = await createCommentOnActivityEventAction(
      eventId,
      values.content,
      parentCommentId
    )
    if (result.isSuccess) {
      onReplyPosted(result.data)
      form.reset()
      onCancel()
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive"
      })
    }
  }

  return (
    <div className="flex items-start gap-2 pt-2">
      <Avatar className="size-8">
        <AvatarImage src={user?.imageUrl} />
        <AvatarFallback>{user?.firstName?.charAt(0)}</AvatarFallback>
      </Avatar>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handlePostReply)} className="flex-1">
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Write a reply..."
                    className="bg-white text-sm"
                    rows={1}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1 size-4 animate-spin" />}
              Reply
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

function CommentItem({
  comment,
  currentUserId,
  eventId,
  onCommentDeleted,
  onReplyPosted,
  isReply = false
}: {
  comment: CommentWithUser
  currentUserId: string | null
  eventId: string
  onCommentDeleted: () => void
  onReplyPosted: (parentCommentId: string, newReply: CommentWithUser) => void
  isReply?: boolean
}) {
  const { toast } = useToast()
  const [isLiked, setIsLiked] = useState(comment.isLikedByCurrentUser)
  const [likeCount, setLikeCount] = useState(comment.likeCount)
  const [isLiking, setIsLiking] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null
  )
  const [isReplying, setIsReplying] = useState(false)

  const editForm = useForm<z.infer<typeof commentSchema>>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: comment.content }
  })

  const { isSubmitting: isUpdating } = editForm.formState

  const handleToggleLike = async () => {
    if (isLiking) return
    setIsLiking(true)
    const originalLikedState = isLiked
    const originalLikeCount = likeCount
    setIsLiked(!isLiked)
    setLikeCount(prev => (isLiked ? prev - 1 : prev + 1))
    const result = await toggleLikeOnCommentAction(comment.id)
    if (!result.isSuccess) {
      setIsLiked(originalLikedState)
      setLikeCount(originalLikeCount)
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive"
      })
    }
    setIsLiking(false)
  }

  const handleSaveEdit = async (values: z.infer<typeof commentSchema>) => {
    const result = await updateCommentAction(comment.id, values.content)
    if (result.isSuccess) {
      comment.content = values.content
      comment.updatedAt = new Date()
      setEditingCommentId(null)
      toast({ title: "Success", description: "Comment updated." })
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive"
      })
    }
  }

  const handleDeleteConfirm = async () => {
    setIsDeleting(true)
    const result = await deleteCommentAction(comment.id)
    if (result.isSuccess) {
      onCommentDeleted()
      toast({ title: "Success", description: "Comment deleted." })
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive"
      })
    }
    setIsDeleting(false)
    setDeletingCommentId(null)
  }

  return (
    <>
      <div className={cn("flex items-start gap-2 text-sm", isReply && "mt-2")}>
        <Link href={`/profile/${comment.userId}`}>
          <Avatar className={cn("size-8")}>
            <AvatarImage src={comment.user?.profilePhoto ?? undefined} />
            <AvatarFallback>{comment.user?.username?.charAt(0)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1">
          <div className="rounded-md bg-gray-100 px-3 py-2">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <Link
                  href={`/profile/${comment.userId}`}
                  className="font-semibold hover:underline"
                >
                  {comment.user?.username}
                </Link>
                {comment.updatedAt > comment.createdAt && (
                  <span className="text-muted-foreground text-[10px] italic">
                    (edited)
                  </span>
                )}
              </div>
              {comment.userId === currentUserId && !editingCommentId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-6">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditingCommentId(comment.id)
                        editForm.setValue("content", comment.content)
                      }}
                    >
                      <Edit className="mr-2 size-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setDeletingCommentId(comment.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {editingCommentId === comment.id ? (
              <Form {...editForm}>
                <form
                  onSubmit={editForm.handleSubmit(handleSaveEdit)}
                  className="mt-2"
                >
                  <FormField
                    control={editForm.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea {...field} className="bg-white text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => setEditingCommentId(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={isUpdating}>
                      {isUpdating && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Save
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <p>{comment.content}</p>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 pt-1 text-xs">
            <span className="text-muted-foreground">
              {formatTimeAgo(comment.createdAt)}
            </span>
            <button
              onClick={handleToggleLike}
              className="font-semibold hover:underline"
              disabled={isLiking}
            >
              {isLiked ? "Unlike" : "Like"}
            </button>
            {!isReply && (
              <button
                className="font-semibold hover:underline"
                onClick={() => setIsReplying(prev => !prev)}
              >
                Reply
              </button>
            )}
            {likeCount > 0 && (
              <div className="text-muted-foreground flex items-center gap-1">
                <Heart className="size-3 text-red-500" /> {likeCount}
              </div>
            )}
          </div>
          {isReplying && !isReply && (
            <ReplyForm
              eventId={eventId}
              parentCommentId={comment.id}
              onReplyPosted={newReply => {
                onReplyPosted(comment.id, newReply)
                setIsReplying(false)
              }}
              onCancel={() => setIsReplying(false)}
            />
          )}
        </div>
      </div>
      <AlertDialog
        open={!!deletingCommentId}
        onOpenChange={() => setDeletingCommentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              comment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function CommentSection({
  eventId,
  onCommentAdded,
  onCommentDeleted
}: CommentSectionProps) {
  const { userId } = useAuth()
  const { user } = useUser()
  const [comments, setComments] = useState<CommentWithUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [visibleReplies, setVisibleReplies] = useState<
    Record<string, CommentWithUser[]>
  >({})
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set())

  const mainCommentForm = useForm<z.infer<typeof commentSchema>>({
    resolver: zodResolver(commentSchema),
    defaultValues: { content: "" }
  })
  const { isSubmitting: isPosting } = mainCommentForm.formState

  useEffect(() => {
    const fetchComments = async () => {
      setIsLoading(true)
      const result = await getCommentsForActivityEventAction(eventId)
      if (result.isSuccess) {
        setComments(result.data)
      }
      setIsLoading(false)
    }
    fetchComments()
  }, [eventId])

  const handlePostComment = async (values: z.infer<typeof commentSchema>) => {
    if (!userId) return
    const result = await createCommentOnActivityEventAction(
      eventId,
      values.content
    )
    if (result.isSuccess) {
      setComments(prev => [result.data, ...prev])
      mainCommentForm.reset()
      onCommentAdded()
    }
  }

  const handleViewReplies = async (parentCommentId: string) => {
    if (visibleReplies[parentCommentId]) {
      setVisibleReplies(prev => {
        const newVisible = { ...prev }
        delete newVisible[parentCommentId]
        return newVisible
      })
      return
    }

    setLoadingReplies(prev => new Set(prev).add(parentCommentId))
    const result = await getCommentRepliesAction(parentCommentId)
    if (result.isSuccess) {
      setVisibleReplies(prev => ({ ...prev, [parentCommentId]: result.data }))
    }
    setLoadingReplies(prev => {
      const newSet = new Set(prev)
      newSet.delete(parentCommentId)
      return newSet
    })
  }

  const handleReplyPosted = (
    parentCommentId: string,
    newReply: CommentWithUser
  ) => {
    setComments(prev =>
      prev.map(c =>
        c.id === parentCommentId ? { ...c, replyCount: c.replyCount + 1 } : c
      )
    )
    setVisibleReplies(prev => ({
      ...prev,
      [parentCommentId]: [...(prev[parentCommentId] || []), newReply]
    }))
  }

  const handleCommentDeleted = (
    commentId: string,
    parentId?: string | null
  ) => {
    if (parentId) {
      setVisibleReplies(prev => ({
        ...prev,
        [parentId]: (prev[parentId] || []).filter(
          reply => reply.id !== commentId
        )
      }))
      setComments(prev =>
        prev.map(c =>
          c.id === parentId ? { ...c, replyCount: c.replyCount - 1 } : c
        )
      )
    } else {
      setComments(prev => prev.filter(c => c.id !== commentId))
    }
    onCommentDeleted()
  }

  return (
    <div className="border-t bg-gray-50/50 px-3 py-4">
      <div className="flex items-start gap-2">
        <Avatar className="size-8">
          <AvatarImage src={user?.imageUrl} />
          <AvatarFallback>{user?.firstName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <Form {...mainCommentForm}>
          <form
            onSubmit={mainCommentForm.handleSubmit(handlePostComment)}
            className="flex-1"
          >
            <FormField
              control={mainCommentForm.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Add a comment..."
                      className="text-sm"
                      rows={1}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          mainCommentForm.handleSubmit(handlePostComment)()
                        }
                      }}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="mt-2 flex justify-end">
              <Button type="submit" size="sm" disabled={isPosting}>
                {isPosting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                <span className="ml-1">Post</span>
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading comments...</p>
        ) : comments.length > 0 ? (
          comments.map(comment => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                currentUserId={userId || null}
                eventId={eventId}
                onCommentDeleted={() => handleCommentDeleted(comment.id)}
                onReplyPosted={handleReplyPosted}
              />
              <div className="ml-10">
                {comment.replyCount > 0 && !visibleReplies[comment.id] && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => handleViewReplies(comment.id)}
                    disabled={loadingReplies.has(comment.id)}
                  >
                    {loadingReplies.has(comment.id) ? (
                      <>
                        <Loader2 className="mr-1 size-3 animate-spin" />{" "}
                        Loading...
                      </>
                    ) : (
                      `View ${comment.replyCount} replies`
                    )}
                  </Button>
                )}
                {visibleReplies[comment.id] && (
                  <>
                    {visibleReplies[comment.id].map(reply => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        currentUserId={userId || null}
                        eventId={eventId}
                        onCommentDeleted={() =>
                          handleCommentDeleted(reply.id, comment.id)
                        }
                        onReplyPosted={() => {}}
                        isReply={true}
                      />
                    ))}
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => handleViewReplies(comment.id)}
                    >
                      Hide replies
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No comments yet.
          </p>
        )}
      </div>
    </div>
  )
}
