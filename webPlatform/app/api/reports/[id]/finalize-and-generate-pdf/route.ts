import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";

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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    const sectionsResult = await procedures.reportSectionGetAll(reportId);
    const sections = sectionsResult;
    if (sections.length === 0) {
      return NextResponse.json(
        { error: "No sections found for this report" },
        { status: 404 }
      );
    }

    const pendingSections = sections.filter(
      (s) => s.status === "pending"
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

    await procedures.reportFinalize(reportId);

    const response = await fetch(
      `http://localhost:8004/generate-pdf/${reportId}`,
      { method: "POST" }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      await procedures.reportRevertFinalize(reportId);
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
