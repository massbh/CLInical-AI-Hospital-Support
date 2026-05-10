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

    // Create sections from notes
    const sectionTitles = ["Assessment", "Vital Signs", "Diagnosis", "Recommendations"];
    let sectionIndex = 0;

    for (const note of notes) {
      const sectionTitle =
        sectionTitles[sectionIndex % sectionTitles.length] ||
        `Note ${sectionIndex + 1}`;

      await pool.query(
        `INSERT INTO report_sections (report_id, title, content, status)
         VALUES ($1, $2, $3, $4)`,
        [reportId, sectionTitle, note.content, "pending"]
      );

      sectionIndex++;
    }

    // If no notes, create placeholder sections
    if (notes.length === 0) {
      for (const title of sectionTitles) {
        await pool.query(
          `INSERT INTO report_sections (report_id, title, content, status)
           VALUES ($1, $2, $3, $4)`,
          [reportId, title, "", "pending"]
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Report created from appointment notes",
      report_id: reportId,
      sections_created: Math.max(notes.length, sectionTitles.length),
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
