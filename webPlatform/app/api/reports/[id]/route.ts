import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
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

// GET: fetch report metadata
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }>}) {
    const authResult = await requireDoctor(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;

    try {
        const result = await pool.query(
            `SELECT id, 
                    patient_id AS "patientId",  
                    patient_name AS "patientName",
                    doctor_name AS "doctorName",
                    date::text
            FROM report_meta
            WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });  
        }

        return NextResponse.json(result.rows[0]);  
    } catch (error) {  
        console.error("Error fetching report:", error);  
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
    }  
}

// POST: Receive structured report preview from PDF generator
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;
    const previewData: PreviewData = await req.json();

    console.log(`📋 Preview received for report: ${reportId}`);

    // Verify report exists
    const reportCheck = await pool.query(
      `SELECT id FROM reports WHERE id = $1`,
      [reportId]
    );

    if (reportCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Store sections in database (insert or update)
    for (const section of previewData.sections) {
      await pool.query(
        `INSERT INTO report_sections (report_id, title, content, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (report_id, title) DO UPDATE SET
         content = EXCLUDED.content, status = EXCLUDED.status`,
        [reportId, section.title, section.content, section.status]
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
