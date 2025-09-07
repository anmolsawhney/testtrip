/**
 * @description
 * Shared layout for static legal pages like Terms of Service and Privacy Policy.
 * Provides a consistent container, background, and navigation for all pages
 * within the (legal) route group. This component is a client component to support
 * the router's `back()` functionality.
 *
 * Key features:
 * - Back Button: Allows users to easily navigate back to the previous page.
 * - Responsive Layout: A centered, max-width container with top padding ensures content is not clipped by the TopNav and is readable on all screen sizes.
 * - Consistent Styling: Provides a professional and clean look for all legal documents.
 *
 * @dependencies
 * - react: For component rendering.
 * - next/navigation: For the `useRouter` hook.
 * - lucide-react: For the `ArrowLeft` icon.
 * - @/components/ui/button: For the back button.
 *
 * @notes
 * - This layout wraps all pages placed within the `app/(legal)/` directory.
 */
"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function LegalLayout({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-black">
      <div className="container mx-auto max-w-3xl px-4 py-8 pt-24 md:py-16 md:pt-32">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground hover:bg-gray-200/50 dark:hover:bg-gray-800/50"
          >
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}
