import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * Generate a preview PDF for a report and stream it back inline so the
 * browser can render it in a new tab. Does NOT finalize the report.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    const reportCheck = await pool.query(
      "SELECT id FROM reports WHERE id = $1",
      [reportId]
    );
    if (reportCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const response = await fetch(
      `http://localhost:8004/generate-pdf/${reportId}`,
      { method: "POST" }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: data.detail || "Failed to generate preview PDF" },
        { status: response.status }
      );
    }

    const buf = await response.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="report-${reportId}-preview.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating preview PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate preview PDF" },
      { status: 500 }
    );
  }
}
