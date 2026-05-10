import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireDoctor } from "@/lib/db-auth";

export async function GET(request: NextRequest) {
    const authResult = await requireDoctor(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    try {
        const doctorResult = await pool.query(
            `SELECT id, name FROM doctors WHERE account_id = $1`,
            [user.id]
        );

        if (doctorResult.rows.length === 0) {
            return NextResponse.json({ error: "No doctor profile found" }, { status: 404 });
        }

        const { id: doctorId, name: doctorName } = doctorResult.rows[0];

        const appointmentResult = await pool.query(
            `SELECT ba.id,
                    ba.patient_id,
                    ba.date,
                    ba.time,
                    a.name AS patient_full_name
             FROM booked_appointments ba
             JOIN accounts a ON a.id = ba.patient_id
             WHERE ba.doctor_id = $1
               AND ba.date = CURRENT_DATE
               AND ba.time::TIME >= CURRENT_TIME - INTERVAL '60 minutes'
             ORDER BY ba.time::TIME
             LIMIT 1`,
            [doctorId]
        );

        if (appointmentResult.rows.length === 0) {
            return NextResponse.json({ error: "No appointment found for today" }, { status: 404 });
        }

        const row = appointmentResult.rows[0];
        const fullName: string = row.patient_full_name ?? "";
        const [patientName, ...rest] = fullName.split(" ");
        const patientSurname = rest.join(" ");

        return NextResponse.json({
            id: row.id,
            patient_id: row.patient_id,
            date: row.date,
            time: row.time,
            patient_name: patientName,
            patient_surname: patientSurname,
            doctor_name: doctorName,
        });
    } catch (error) {
        console.error("Error fetching current appointment:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
