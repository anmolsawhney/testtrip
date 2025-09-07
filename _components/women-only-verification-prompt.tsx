/**
 * @description
 * Client component that displays a prompt for users who try to access women-only
 * trips without having completed identity verification. It shows different messages
 * based on their current verification status.
 *
 * Key features:
 * - Displays a title, description, and icon tailored to the user's status (none, pending, rejected).
 * - Provides a clear call-to-action button that links to the verification page.
 * - Uses a consistent and visually distinct style to draw attention to the required action.
 *
 * @dependencies
 * - react: For component rendering.
 * - next/link: For client-side navigation.
 * - lucide-react: For icons (ShieldAlert, ShieldQuestion).
 * - @/components/ui/button: For the call-to-action button.
 * - @/components/ui/card: For styling and layout.
 *
 * @notes
 * - This is a presentational component controlled by its parent.
 * - It expects a `status` prop to determine which message to display.
 */
"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ShieldAlert, ShieldQuestion } from "lucide-react"
import Link from "next/link"

interface WomenOnlyVerificationPromptProps {
  status: "none" | "pending" | "rejected"
}

export function WomenOnlyVerificationPrompt({
  status
}: WomenOnlyVerificationPromptProps) {
  const messages = {
    none: {
      icon: ShieldQuestion,
      title: "Verify Your Identity to View",
      description:
        "Access to women-only trips is reserved for members who have completed identity verification. Please verify your profile to continue."
    },
    pending: {
      icon: ShieldAlert,
      title: "Verification Pending",
      description:
        "Your identity verification is currently under review. Access to women-only trips will be granted upon approval."
    },
    rejected: {
      icon: ShieldQuestion,
      title: "Verification Required",
      description:
        "Your previous verification was not approved. Please re-submit your documents to access women-only trips."
    }
  }

  const { icon: Icon, title, description } = messages[status]

  return (
    <Card className="flex min-h-[40vh] flex-col items-center justify-center border-2 border-dashed border-purple-200 bg-purple-50/50 p-8 text-center">
      <CardContent className="flex flex-col items-center justify-center p-0">
        <Icon className="mb-4 size-16 text-purple-400" />
        <h2 className="mb-2 text-2xl font-bold text-purple-800">{title}</h2>
        <p className="max-w-md text-purple-700">{description}</p>
        <Button asChild className="bg-gradient-1 mt-6 text-white">
          <Link href="/verify-identity">Go to Verification</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
