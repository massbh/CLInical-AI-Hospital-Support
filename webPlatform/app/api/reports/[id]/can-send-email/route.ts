import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * Check if a report can be sent via email
 * All sections must be accepted and PDF must be generated
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reportId = params.id;

    // Get report and section statuses
    const [reportResult, sectionsResult] = await Promise.all([
      pool.query(
        "SELECT id, preview, patient_name, patient_surname, doctor_name FROM reports WHERE id = $1",
        [reportId]
      ),
      pool.query(
        "SELECT id, status FROM report_sections WHERE report_id = $1",
        [reportId]
      ),
    ]);

    if (reportResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const report = reportResult.rows[0];
    const sections = sectionsResult.rows;

    // Check conditions
    const hasPendingSections = sections.some((s: any) => s.status === "pending");
    const isPdfGenerated = report.preview === false; // false = finalized
    const canSendEmail = !hasPendingSections && isPdfGenerated;

    const reasons = [];
    if (hasPendingSections) {
      reasons.push(`${sections.filter((s: any) => s.status === "pending").length} section(s) still pending`);
    }
    if (!isPdfGenerated) {
      reasons.push("PDF not yet generated");
    }

    return NextResponse.json({
      can_send_email: canSendEmail,
      report_id: reportId,
      sections_total: sections.length,
      sections_pending: sections.filter((s: any) => s.status === "pending").length,
      pdf_generated: isPdfGenerated,
      reasons_if_not_ready: reasons,
      report_info: {
        patient_name: report.patient_name,
        patient_surname: report.patient_surname,
        doctor_name: report.doctor_name,
      },
    });
  } catch (error) {
    console.error("Error checking email readiness:", error);
    return NextResponse.json(
      { error: "Failed to check report status" },
      { status: 500 }
    );
  }
}
