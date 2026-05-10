import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireDoctor } from "@/lib/db-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireDoctor(_request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "appointment id is required" },
      { status: 400 }
    );
  }

  try {
    const appointmentResult = await pool.query(
      `SELECT  
        ba.id,
        ba.date::text,
        ba.time,
        ba.patient_id,
        a.name AS "patientName",
        a.email AS "patientEmail",
        d.name AS "doctorName"
      FROM booked_appointments ba
      JOIN accounts a ON a.id = ba.patient_id
      JOIN doctors d ON d.id = ba.doctor_id
      WHERE ba.id = $1`,
      [id]
    );

    if (appointmentResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const appointment = appointmentResult.rows[0];
    const patientId = appointment.patient_id;

    const historyResult = await pool.query(
      `SELECT  
        ba.date::text,
        ba.time,
        d.name AS "doctorName"
      FROM booked_appointments ba
      JOIN doctors d ON d.id = ba.doctor_id
      WHERE ba.patient_id = $1
        AND ba.date < $2
        OR (ba.date = $2 AND ba.time < $3)
      ORDER BY ba.date DESC, ba.time DESC`,
      [patientId, appointment.date, appointment.time]
    );

    return NextResponse.json({
      appointment: {
        id: appointment.id,
        date: appointment.date,
        time: appointment.time,
        patientName: appointment.patientName,
        patientEmail: appointment.patientEmail,
        doctorName: appointment.doctorName,
      },
      history: historyResult.rows,
    });
  } catch (error) {
    console.error("Error fetching appointment details:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}