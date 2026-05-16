import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";
import { requireDoctor } from "@/lib/db-auth";

interface PreviewData {
  report_id: string;
  patient_name: string;
  patient_surname: string;
  doctor_name: string;
  title: string;
  date: string;
  sections: Array<{
    title: string;
    content: string;
    status: string;
  }>;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }>}) {
    const authResult = await requireDoctor(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    try {
        const result = await procedures.reportGetMeta(id);

        if (result.length === 0) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });  
        }

        const row = result[0];
        return NextResponse.json({
            id: row.id,
            patientId: row.patient_id,
            patientName: row.patient_name,
            doctorName: row.doctor_name,
            date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date
        });
    } catch (error) {  
        console.error("Error fetching report:", error);  
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
    }  
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
    const previewData: PreviewData = await req.json();

    console.log(`📋 Preview received for report: ${reportId}`);

    const exists = await procedures.reportCheckExists(reportId);

    if (!exists[0].exists) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    for (const section of previewData.sections) {
      await procedures.reportSectionUpsert(
        reportId,
        section.title,
        section.content,
        section.status as "pending" | "accepted"
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Preview data received and stored",
        report_id: reportId,
        sections_count: previewData.sections.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error receiving preview:", error);
    return NextResponse.json(
      { error: "Failed to process preview data" },
      { status: 500 }
    );
  }
}
