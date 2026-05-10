import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * Create a report from an appointment with initial sections from notes
 * Auto-populates sections from conversation notes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  try {
    const { appointmentId } = await params;
    const { patient_name, patient_surname, doctor_name, title } =
      await request.json();

    if (!patient_name || !patient_surname || !doctor_name) {
      return NextResponse.json(
        {
          error:
            "patient_name, patient_surname, and doctor_name are required",
        },
        { status: 400 }
      );
    }

    // booked_appointments.doctor_id references doctors(id), but
    // reports.doctor_id references accounts(id). Translate via the doctor's
    // account_id so the FK on reports is satisfied.
    const appointmentResult = await pool.query(
      `SELECT ba.patient_id, d.account_id AS doctor_account_id
       FROM booked_appointments ba
       JOIN doctors d ON d.id = ba.doctor_id
       WHERE ba.id = $1`,
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const { patient_id, doctor_account_id } = appointmentResult.rows[0];
    if (!doctor_account_id) {
      return NextResponse.json(
        { error: "Doctor has no linked account" },
        { status: 500 }
      );
    }

    // Get notes from this appointment to use as initial sections
    const notesResult = await pool.query(
      `SELECT id, content FROM notes WHERE appointment_id = $1 ORDER BY timestamp ASC`,
      [appointmentId]
    );

    const notes = notesResult.rows;

    // Create the report
    const reportResult = await pool.query(
      `INSERT INTO reports (patient_id, doctor_id, patient_name, patient_surname, doctor_name, date, title, preview)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, NULL)
       RETURNING id`,
      [patient_id, doctor_account_id, patient_name, patient_surname, doctor_name, title || "Medical Consultation Report"]
    );

    const reportId = reportResult.rows[0].id;

    // Always create the same fixed schema so every report has the full
    // structure and Assessment & Plan is the final section. Notes are
    // concatenated into the Vital Signs / Physical Examination sections as
    // raw context for the doctor to edit; the clinical sections start empty.
    const notesText = notes.map((n) => n.content).join("\n\n");
    const sectionSchema: { title: string; content: string }[] = [
      { title: "Vital Signs", content: notesText },
      { title: "Physical Examination", content: "" },
      { title: "Diagnosis", content: "" },
      { title: "Recommendations", content: "" },
      { title: "Assessment & Plan", content: "" },
    ];

    for (const section of sectionSchema) {
      await pool.query(
        `INSERT INTO report_sections (report_id, title, content, status)
         VALUES ($1, $2, $3, $4)`,
        [reportId, section.title, section.content, "pending"]
      );
    }

    return NextResponse.json({
      success: true,
      message: "Report created from appointment notes",
      report_id: reportId,
      sections_created: sectionSchema.length,
      patient_name,
      patient_surname,
      doctor_name,
    });
  } catch (error) {
    console.error("Error creating report from appointment:", error);
    return NextResponse.json(
      { error: "Failed to create report from appointment" },
      { status: 500 }
    );
  }
}
