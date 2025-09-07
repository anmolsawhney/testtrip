/**
 * @description
 * Client component to display and manage incoming follow requests.
 * Lists users who have requested to follow the current user.
 * Provides buttons to accept or reject each request.
 * Handles loading states and feedback for actions.
 * UPDATED: Replaced `displayName` with `username`.
 *
 * @dependencies
 * - react: For state management (useState).
 * - next/navigation: For router refresh after actions.
 * - @/actions/db/follow-actions: Server actions for accepting/rejecting requests.
 * - @/types: For FollowRequest type definition.
 * - @/components/ui/*: UI components (Button, Card, Avatar).
 * - lucide-react: For icons (Check, X, Loader2).
 * - @/lib/hooks/use-toast: For displaying notifications.
 */
"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FollowRequest } from "@/types"
import {
  acceptFollowRequestAction,
  rejectFollowRequestAction
} from "@/actions/db/follow-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, X, Loader2 } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"

interface IncomingRequestsProps {
  requests: FollowRequest[]
  currentUserId: string
}

export default function IncomingRequests({
  requests,
  currentUserId
}: IncomingRequestsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null
  )
  const [isPending, startTransition] = useTransition()

  const handleRequestAction = async (
    actionType: "accept" | "reject",
    followerId: string,
    requestId: string
  ) => {
    setProcessingRequestId(requestId)

    const action =
      actionType === "accept"
        ? acceptFollowRequestAction
        : rejectFollowRequestAction

    try {
      const result = await action(followerId, currentUserId)

      if (result.isSuccess) {
        toast({
          title: `Request ${actionType === "accept" ? "Accepted" : "Rejected"}`,
          description: result.message
        })
        startTransition(() => {
          router.refresh()
        })
      } else {
        throw new Error(result.message)
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : `Failed to ${actionType} request.`,
        variant: "destructive"
      })
    } finally {
      setProcessingRequestId(null)
    }
  }

  if (requests.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No incoming follow requests.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map(req => {
        const isLoading = processingRequestId === req.followerId
        return (
          <Card key={req.followerId} className="p-4">
            <CardContent className="flex items-center justify-between p-0">
              <div className="flex items-center gap-4">
                <Avatar className="size-12">
                  <AvatarImage
                    src={req.profile?.profilePhoto ?? undefined}
                    alt={req.profile?.username ?? "User"}
                  />
                  <AvatarFallback>
                    {req.profile?.username?.charAt(0)?.toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">
                    {req.profile?.username ?? "User"}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Requested to follow you
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleRequestAction(
                      "reject",
                      req.followerId,
                      req.followerId
                    )
                  }
                  disabled={isLoading}
                  aria-label={`Reject request from ${req.profile?.username ?? "User"}`}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() =>
                    handleRequestAction(
                      "accept",
                      req.followerId,
                      req.followerId
                    )
                  }
                  disabled={isLoading}
                  className="bg-gradient-1 text-white"
                  aria-label={`Accept request from ${req.profile?.username ?? "User"}`}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
