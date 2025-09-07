/**
 * @description
 * Client component to display and manage outgoing follow requests.
 * Lists users the current user has requested to follow but who haven't accepted yet.
 * Provides a button to cancel each pending request.
 * Handles loading states and feedback for actions.
 * UPDATED: Replaced `displayName` with `username`.
 *
 * @dependencies
 * - react: For state management (useState).
 * - next/navigation: For router refresh after actions.
 * - @/actions/db/follow-actions: Server action for cancelling requests.
 * - @/types: For FollowRequest type definition.
 * - @/components/ui/*: UI components (Button, Card, Avatar).
 * - lucide-react: For icons (X, Loader2).
 * - @/lib/hooks/use-toast: For displaying notifications.
 */
"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { FollowRequest } from "@/types"
import { cancelFollowRequestAction } from "@/actions/db/follow-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { X, Loader2 } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"

interface OutgoingRequestsProps {
  requests: FollowRequest[]
  currentUserId: string
}

export default function OutgoingRequests({
  requests,
  currentUserId
}: OutgoingRequestsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null
  )
  const [isPending, startTransition] = useTransition()

  const handleCancelRequest = async (
    followingId: string,
    requestId: string
  ) => {
    setProcessingRequestId(requestId)

    try {
      const result = await cancelFollowRequestAction(currentUserId, followingId)

      if (result.isSuccess) {
        toast({
          title: "Request Cancelled",
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
          error instanceof Error ? error.message : "Failed to cancel request.",
        variant: "destructive"
      })
    } finally {
      setProcessingRequestId(null)
    }
  }

  if (requests.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No pending outgoing follow requests.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map(req => {
        const requestId = req.followingId
        const isLoading = processingRequestId === requestId

        return (
          <Card key={requestId} className="p-4">
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
                  <p className="text-muted-foreground text-xs">Request sent</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCancelRequest(req.followingId, requestId)}
                disabled={isLoading}
                aria-label={`Cancel request to follow ${req.profile?.username ?? "User"}`}
              >
                {isLoading ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <X className="mr-1 size-4" />
                )}
                Cancel
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
