import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * Proxy endpoint to generate a PDF via the reportGenerator service and
 * stream it back to the browser as a download.
 */
export async function POST(request: NextRequest) {
  try {
    const { reportId } = await request.json();

    if (!reportId) {
      return NextResponse.json(
        { error: "reportId is required" },
        { status: 400 }
      );
    }

    const previewCheck = await pool.query(
      "SELECT preview FROM reports WHERE id = $1",
      [reportId]
    );
    if (previewCheck.rows.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    if (previewCheck.rows[0].preview !== false) {
      return NextResponse.json(
        { error: "Report must be finalized before download" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `http://localhost:8004/generate-pdf/${reportId}`,
      { method: "POST" }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: data.detail || "Failed to generate PDF" },
        { status: response.status }
      );
    }

    const buf = await response.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          response.headers.get("Content-Disposition") ??
          `attachment; filename="report-${reportId}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
