/**
 * @description
 * Server component page for the Admin Reports Dashboard.
 * Fetches report data via server action (which includes admin check) and renders the dashboard UI.
 * UPDATED: Added top padding `pt-24` to ensure content is not obscured by the fixed top navigation bar.
 *
 * @dependencies
 * - react: For Suspense.
 * - @clerk/nextjs/server: For authentication (auth).
 * - next/navigation: For redirection (redirect - though not used directly for auth here anymore).
 * - @/actions/db/report-actions: For fetching reports (includes admin check).
 * - @/components/admin/report-dashboard: Client component for rendering the dashboard.
 * - @/components/admin/admin-report-skeleton: Skeleton loading component.
 * - @/types: For ReportWithDetails type definition.
 */
"use server"

import { Suspense } from "react"
import { redirect } from "next/navigation" // Keep for potential future redirects
import { auth } from "@clerk/nextjs/server"

import { getReportsAction } from "@/actions/db/report-actions" // Only need getReportsAction
import { ReportDashboard } from "@/components/admin/admin-report-dashboard"
import AdminReportSkeleton from "@/components/admin/admin-report-skeleton"
import { ReportWithDetails } from "@/types"
import { Button } from "@/components/ui/button" // Keep for error display
import Link from "next/link" // Keep for error display

/**
 * Fetches the report data. This runs inside the Suspense boundary.
 * The underlying getReportsAction handles the admin authorization check.
 */
async function ReportsFetcher() {
  // Call the action. It will return success:false if the user is not an admin.
  const reportResult = await getReportsAction() // Default fetches all

  if (!reportResult.isSuccess) {
    // Handle fetch error OR authorization error gracefully
    console.error("Failed to fetch reports:", reportResult.message)
    return (
      <div className="border-destructive bg-destructive/10 text-destructive-foreground rounded-md border p-4 text-center">
        Error loading reports: {reportResult.message}
        {/* Optionally add a link back home for non-admin users */}
        {reportResult.message.includes("Unauthorized") && (
          <div className="mt-4">
            <Button variant="destructive" asChild>
              <Link href="/">Go to Home</Link>
            </Button>
          </div>
        )}
      </div>
    )
  }

  const reports: ReportWithDetails[] = reportResult.data ?? []

  return <ReportDashboard initialReports={reports} />
}

/**
 * Main page component for the admin reports dashboard.
 * Authorization is handled within the ReportsFetcher's call to getReportsAction.
 */
export default async function AdminReportsPage() {
  // Basic auth check to ensure *someone* is logged in, but detailed
  // admin check is handled within the action called by ReportsFetcher.
  const { userId } = await auth()
  if (!userId) {
    redirect("/login?redirect_url=/admin/reports")
  }

  // Log access attempt (admin status verified inside action)
  console.log(
    `[AdminReportsPage] User ${userId} attempting to access reports dashboard.`
  )

  return (
    <div className="container mx-auto max-w-6xl px-4 pb-8 pt-24">
      <h1 className="mb-6 text-3xl font-bold">Manage User Reports</h1>
      <Suspense fallback={<AdminReportSkeleton />}>
        <ReportsFetcher />
      </Suspense>
    </div>
  )
}
