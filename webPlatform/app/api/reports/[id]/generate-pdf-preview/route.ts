import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * Generate a preview PDF for a report
 * This generates the PDF WITHOUT finalizing the report sections
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    // Check if report exists
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

    // Call reportGenerator to generate preview PDF
    const response = await fetch(
      `http://localhost:8004/generate-pdf/${reportId}`,
      {
        method: "POST",
        headers: {
          "X-API-Key": process.env.REPORT_GENERATOR_API_KEY || "dev-key",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.detail || "Failed to generate preview PDF" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: "Preview PDF generated successfully",
      report_id: reportId,
      pdf_path: data.pdf_path,
    });
  } catch (error) {
    console.error("Error generating preview PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate preview PDF" },
      { status: 500 }
    );
  }
}
