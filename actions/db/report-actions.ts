/**
 * @description
 * Server actions for managing user profile reports in the TripRizz application.
 * Includes creating reports, fetching reports (admin only), and updating report status (admin only).
 * Admin authorization is checked using a shared utility function.
 * FIXED: Corrected `getReportsAction` to select `username` instead of the removed `displayName`.
 * UPDATED: `getReportsAction` now uses an `innerJoin` to filter out reports involving soft-deleted users.
 *
 * @dependencies
 * - "@/db/db": Drizzle database instance.
 * - "@/db/schema": Database schema definitions (reportsTable, profilesTable).
 * - "@/types": ActionState type definition, ReportWithDetails type.
 * - "@/lib/auth-utils": For isAdminUser helper function.
 * - "@clerk/nextjs/server": For authentication (auth).
 * - "drizzle-orm": For database operations (eq, and, desc).
 * - "drizzle-orm/pg-core": For aliasing tables.
 */
"use server";

import { db } from "@/db/db";
import {
  reportsTable,
  InsertReport,
  SelectReport,
  profilesTable,
  reportStatusEnum
} from "@/db/schema";
import { ActionState, ReportWithDetails } from "@/types";
import { auth } from "@clerk/nextjs/server";
import { and, like, desc, eq, not, SQLWrapper } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { isAdminUser } from "@/lib/auth-utils";

export async function checkIsAdminAction(): Promise<ActionState<boolean>> {
    try {
        const { userId } = await auth();
        const isAdmin = isAdminUser(userId);
        return {
            isSuccess: true,
            message: "Admin status checked.",
            data: isAdmin,
        };
    } catch (error) {
         console.error("[Action checkIsAdmin] Error checking admin status:", error);
         return { isSuccess: false, message: "Failed to verify admin status.", data: undefined };
    }
}

export async function createReportAction(
  data: Omit<InsertReport, "id" | "status" | "createdAt" | "updatedAt" | "adminNotes">
): Promise<ActionState<SelectReport>> {
  const authResult = await auth();
  const currentUserId = authResult.userId;

  if (!currentUserId || currentUserId !== data.reporterId) {
    console.warn(`[Action createReport] Unauthorized attempt. Current: ${currentUserId}, Reporter in data: ${data.reporterId}`);
    return { isSuccess: false, message: "Unauthorized: You can only submit reports for yourself." };
  }

  if (!data.reporterId || !data.reportedId || !data.reason) {
    return { isSuccess: false, message: "Missing required fields: reporter, reported user, or reason." };
  }
  if (data.reporterId === data.reportedId) {
    return { isSuccess: false, message: "You cannot report yourself." };
  }

  try {
    console.log(`[Action createReport] User ${data.reporterId} reporting user ${data.reportedId} for reason: ${data.reason}`);
    const reportDataToInsert: InsertReport = {
      reporterId: data.reporterId,
      reportedId: data.reportedId,
      reason: data.reason,
      description: data.description || null,
      status: 'pending',
      adminNotes: null,
    };

    const [newReport] = await db
      .insert(reportsTable)
      .values(reportDataToInsert)
      .returning();

    if (!newReport) {
        console.error(`[Action createReport] Failed to insert report into database.`);
        throw new Error("Failed to create report record in database.");
    }

    console.log(`[Action createReport] Report ${newReport.id} created successfully.`);

    return {
      isSuccess: true,
      message: "Report submitted successfully.",
      data: newReport,
    };
  } catch (error) {
    console.error("[Action createReport] Error:", error);
    if (error instanceof Error && error.message.includes('violates foreign key constraint')) {
        if (error.message.includes('reports_reporter_id_profiles_user_id_fk')) {
             return { isSuccess: false, message: "Reporting user profile not found." };
        }
        if (error.message.includes('reports_reported_id_profiles_user_id_fk')) {
             return { isSuccess: false, message: "Reported user profile not found." };
        }
    }
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to submit report.",
    };
  }
}

export async function getReportsAction(filter: {
  status?: typeof reportStatusEnum.enumValues[number];
} = {}): Promise<ActionState<ReportWithDetails[]>> {
  try {
    const authResult = await auth();
    const adminUserId = authResult.userId;

    if (!isAdminUser(adminUserId)) {
        console.warn(`[Action getReports] Unauthorized attempt by user ${adminUserId}.`);
        return { isSuccess: false, message: "Unauthorized: Admin access required." };
    }
    console.log(`[Action getReports] Admin ${adminUserId} fetching reports. Filter:`, filter);

    const reporterProfile = alias(profilesTable, "reporter");
    const reportedProfile = alias(profilesTable, "reported");

    const conditions: (SQLWrapper | undefined)[] = [];
    if (filter.status) {
        console.log(`[Action getReports] Applying status filter: ${filter.status}`);
      conditions.push(eq(reportsTable.status, filter.status));
    }

    const results = await db
      .select({
        report: reportsTable,
        reporter: {
          userId: reporterProfile.userId,
          username: reporterProfile.username, // FIXED
          profilePhoto: reporterProfile.profilePhoto,
        },
        reported: {
          userId: reportedProfile.userId,
          username: reportedProfile.username, // FIXED
          profilePhoto: reportedProfile.profilePhoto,
        },
      })
      .from(reportsTable)
      .innerJoin(reporterProfile, and(
        eq(reportsTable.reporterId, reporterProfile.userId),
        not(like(reporterProfile.username, "deleted_%"))
      ))
      .innerJoin(reportedProfile, and(
        eq(reportsTable.reportedId, reportedProfile.userId),
        not(like(reportedProfile.username, "deleted_%"))
      ))
      .where(and(...conditions.filter(c => c !== undefined)))
      .orderBy(desc(reportsTable.createdAt));

    const reportsWithDetails: ReportWithDetails[] = results.map(r => ({
      ...r.report,
      reporter: r.reporter,
      reported: r.reported,
    }));

    console.log(`[Action getReports] Retrieved ${reportsWithDetails.length} reports.`);
    return {
      isSuccess: true,
      message: "Reports retrieved successfully.",
      data: reportsWithDetails,
    };
  } catch (error) {
    console.error("[Action getReports] Error:", error);
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to retrieve reports.",
    };
  }
}

export async function updateReportStatusAction(
  reportId: string,
  status: typeof reportStatusEnum.enumValues[number],
  adminNotes?: string
): Promise<ActionState<SelectReport>> {
  try {
     const authResult = await auth();
     const adminUserId = authResult.userId;

     if (!isAdminUser(adminUserId)) {
         console.warn(`[Action updateReportStatus] Unauthorized attempt by user ${adminUserId} to update report ${reportId}.`);
         return { isSuccess: false, message: "Unauthorized: Admin access required." };
     }
     console.log(`[Action updateReportStatus] Admin ${adminUserId} updating report ${reportId} to status ${status}. Notes: ${adminNotes ?? 'None'}`);

    if (!reportId) {
      return { isSuccess: false, message: "Report ID is required." };
    }
    if (!reportStatusEnum.enumValues.includes(status)) {
       return { isSuccess: false, message: `Invalid status value: ${status}` };
    }

    const updateData: Partial<InsertReport> = {
      status: status,
      updatedAt: new Date(),
    };
    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes === "" ? null : adminNotes;
    }

    const [updatedReport] = await db
      .update(reportsTable)
      .set(updateData)
      .where(eq(reportsTable.id, reportId))
      .returning();

    if (!updatedReport) {
       console.warn(`[Action updateReportStatus] Report not found during update: ${reportId}`);
      return { isSuccess: false, message: "Report not found to update." };
    }

    console.log(`[Action updateReportStatus] Report ${reportId} updated successfully.`);

    return {
      isSuccess: true,
      message: "Report status updated successfully.",
      data: updatedReport,
    };
  } catch (error) {
    console.error("[Action updateReportStatus] Error:", error);
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to update report status.",
    };
  }
}