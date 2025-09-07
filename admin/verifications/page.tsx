/**
 * @description
 * Server component page for the Admin Identity Verification Dashboard.
 * Handles admin authorization, fetches pending verification requests,
 * and renders the dashboard UI for review.
 * UPDATED: Added top padding `pt-24` to ensure content is not obscured by the fixed top navigation bar.
 *
 * @dependencies
 * - react: For Suspense.
 * - @clerk/nextjs/server: For authentication (auth).
 * - next/navigation: For redirection (redirect).
 * - @/actions/db/verification-actions: For fetching pending verifications.
 * - @/lib/auth-utils: For admin check helper function. // Updated to use shared util
 * - @/components/admin/verification-dashboard: Client component for rendering the dashboard.
 * - @/components/admin/admin-verification-skeleton: Skeleton loading component.
 * - @/types: For SelectProfile type definition.
 * - @/components/ui/button: For UI components.
 * - next/link: For navigation links.
 */
"use server"

import { Suspense } from "react"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import Link from "next/link"

import { getPendingVerificationsAction } from "@/actions/db/verification-actions"
import { isAdminUser } from "@/lib/auth-utils" // Use shared utility
import { VerificationDashboard } from "@/components/admin/verification-dashboard"
import AdminVerificationSkeleton from "@/components/admin/admin-verification-skeleton"
import { SelectProfile } from "@/db/schema"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card" // For error display

/**
 * Fetches the pending verification data. Runs inside Suspense.
 */
async function VerificationsFetcher() {
  const result = await getPendingVerificationsAction()

  if (!result.isSuccess) {
    // Handle fetch error OR authorization error gracefully
    console.error("Failed to fetch pending verifications:", result.message)
    return (
      <Card className="border-destructive bg-destructive/10">
        <CardHeader>
          <CardTitle className="text-destructive">
            Error Loading Verifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive-foreground">{result.message}</p>
          {/* Add link back to admin home or reports if needed */}
          {result.message.includes("Unauthorized") && (
            <div className="mt-4">
              <Button variant="destructive" asChild>
                <Link href="/">Go to Home</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const pendingVerifications: SelectProfile[] = result.data ?? []

  return (
    <VerificationDashboard initialPendingVerifications={pendingVerifications} />
  )
}

/**
 * Main page component for the admin verification dashboard.
 */
export default async function AdminVerificationPage() {
  // --- Admin Authorization Check ---
  const { userId: adminUserId } = await auth()
  if (!isAdminUser(adminUserId)) {
    console.warn(
      `[AdminVerificationPage] Unauthorized access attempt by user ${adminUserId}. Redirecting.`
    )
    redirect("/") // Redirect non-admins
  }
  // --- End Admin Authorization Check ---

  console.log(
    `[AdminVerificationPage] Admin user ${adminUserId} accessed the verification dashboard.`
  )

  return (
    <div className="container mx-auto max-w-7xl px-4 pb-8 pt-24">
      {" "}
      {/* Use wider container */}
      <h1 className="mb-6 text-3xl font-bold">
        Identity Verification Requests
      </h1>
      <Suspense fallback={<AdminVerificationSkeleton />}>
        <VerificationsFetcher />
      </Suspense>
    </div>
  )
}
