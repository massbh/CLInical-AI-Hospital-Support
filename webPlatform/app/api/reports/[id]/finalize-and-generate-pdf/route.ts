import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * Finalize report and generate final PDF
 * Marks all sections as accepted and triggers PDF generation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    // Get all sections for this report
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

    // Check if all sections are accepted
    const pendingSections = sections.filter((s: any) => s.status === "pending");
    if (pendingSections.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot finalize: ${pendingSections.length} section(s) still pending review`,
          pending_count: pendingSections.length,
        },
        { status: 400 }
      );
    }

    // Mark report as finalized
    await pool.query(
      "UPDATE reports SET preview = $1 WHERE id = $2",
      [false, reportId] // false = finalized and PDF generated
    );

    // Call reportGenerator to generate final PDF
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
      // Rollback the finalized flag
      await pool.query(
        "UPDATE reports SET preview = NULL WHERE id = $1",
        [reportId]
      );
      return NextResponse.json(
        { error: error.detail || "Failed to generate final PDF" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: "Report finalized and PDF generated successfully",
      report_id: reportId,
      pdf_path: data.pdf_path,
      sections_count: sections.length,
    });
  } catch (error) {
    console.error("Error finalizing report:", error);
    return NextResponse.json(
      { error: "Failed to finalize report" },
      { status: 500 }
    );
  }
}
