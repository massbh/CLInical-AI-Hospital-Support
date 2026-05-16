import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";

export async function POST(request: NextRequest) {
  try {
    const { reportId } = await request.json();

    if (!reportId) {
      return NextResponse.json(
        { error: "reportId is required" },
        { status: 400 }
      );
    }

    const exists = await procedures.reportCheckExists(reportId);
    if (!exists[0].exists) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const result = await procedures.reportGetMeta(reportId);
    if (result.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
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
