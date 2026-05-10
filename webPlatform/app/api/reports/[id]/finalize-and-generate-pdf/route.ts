import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

const EMAIL_SERVICE_URL =
  process.env.EMAIL_SERVICE_URL ?? "http://localhost:8003";
const EMAIL_SERVICE_API_KEY = process.env.EMAIL_SERVICE_API_KEY ?? "";

type EmailResult = {
  sent: boolean;
  recipient?: string;
  error?: string;
};

async function sendFinalizedReportEmail(reportId: string): Promise<EmailResult> {
  try {
    const response = await fetch(
      `${EMAIL_SERVICE_URL.replace(/\/$/, "")}/send-report`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": EMAIL_SERVICE_API_KEY,
        },
        body: JSON.stringify({ report_id: reportId }),
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail =
        data && typeof data === "object" && "detail" in data
          ? String(data.detail)
          : `Email service returned ${response.status}`;
      return { sent: false, error: detail };
    }

    const recipient =
      data && typeof data === "object" && "recipient" in data
        ? String(data.recipient)
        : undefined;

    return { sent: true, recipient };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Finalize a report and stream the generated PDF back as an attachment.
 * All sections must be accepted before this can succeed.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    const sectionsResult = await pool.query(
      "SELECT id, status FROM report_sections WHERE report_id = $1",
      [reportId]
    );
    const sections = sectionsResult.rows;
    if (sections.length === 0) {
      return NextResponse.json(
        { error: "No sections found for this report" },
        { status: 404 }
      );
    }

    const pendingSections = sections.filter(
      (s: { status: string }) => s.status === "pending"
    );
    if (pendingSections.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot finalize: ${pendingSections.length} section(s) still pending review`,
          pending_count: pendingSections.length,
        },
        { status: 400 }
      );
    }

    await pool.query(
      "UPDATE reports SET preview = $1 WHERE id = $2",
      [false, reportId]
    );

    const response = await fetch(
      `http://localhost:8004/generate-pdf/${reportId}`,
      { method: "POST" }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      await pool.query(
        "UPDATE reports SET preview = NULL WHERE id = $1",
        [reportId]
      );
      return NextResponse.json(
        { error: data.detail || "Failed to generate final PDF" },
        { status: response.status }
      );
    }

    const buf = await response.arrayBuffer();
    const emailResult = await sendFinalizedReportEmail(reportId);
    if (!emailResult.sent) {
      console.error(
        `Report ${reportId} finalized but email was not sent:`,
        emailResult.error
      );
    }

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${reportId}.pdf"`,
        "X-Email-Sent": emailResult.sent ? "true" : "false",
        ...(emailResult.recipient
          ? { "X-Email-Recipient": emailResult.recipient }
          : {}),
        ...(emailResult.error ? { "X-Email-Error": emailResult.error } : {}),
      },
    });
  } catch (error) {
    console.error("Error finalizing report:", error);
    return NextResponse.json(
      { error: "Failed to finalize report" },
      { status: 500 }
    );
  }
}
