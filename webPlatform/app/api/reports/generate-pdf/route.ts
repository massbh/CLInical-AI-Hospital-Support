import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy endpoint to generate PDF via reportGenerator service
 * This avoids CORS issues by going backend-to-backend
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

    // Call reportGenerator backend
    const response = await fetch(
      `http://localhost:8004/generate-pdf/${reportId}`,
      {
        method: "POST",
        headers: {
          "X-API-Key": process.env.REPORT_GENERATOR_API_KEY || "dev-key",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || "Failed to generate PDF" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
