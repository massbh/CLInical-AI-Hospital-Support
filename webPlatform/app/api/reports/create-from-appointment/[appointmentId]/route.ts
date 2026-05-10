import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

/**
 * Create a report from an appointment with initial sections from notes
 * Auto-populates sections from conversation notes
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { appointmentId: string } }
) {
  try {
    const appointmentId = params.appointmentId;
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

    // Get appointment details to find patient and doctor IDs
    const appointmentResult = await pool.query(
      `SELECT patient_id, doctor_id FROM booked_appointments WHERE id = $1`,
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const { patient_id, doctor_id } = appointmentResult.rows[0];

    // Get notes from this appointment to use as initial sections
    const notesResult = await pool.query(
      `SELECT id, content FROM notes WHERE appointment_id = $1 ORDER BY timestamp ASC`,
      [appointmentId]
    );

    const notes = notesResult.rows;

    // Get suggestions for additional context
    const suggestionsResult = await pool.query(
      `SELECT id, content FROM suggestions WHERE appointment_id = $1 ORDER BY timestamp ASC`,
      [appointmentId]
    );

    const suggestions = suggestionsResult.rows;

    // Create the report
    const reportResult = await pool.query(
      `INSERT INTO reports (patient_id, doctor_id, patient_name, patient_surname, doctor_name, date, title, preview)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, NULL)
       RETURNING id`,
      [patient_id, doctor_id, patient_name, patient_surname, doctor_name, title || "Medical Consultation Report"]
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
