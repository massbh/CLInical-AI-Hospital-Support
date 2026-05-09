import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireDoctor } from "@/lib/db-auth";

export async function GET(request: NextRequest) {
    const authResult = await requireDoctor(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    try {
        const doctorResult = await pool.query(
            `SELECT id FROM doctors WHERE account_id = $1`,
            [user.id]
        );

        if (doctorResult.rows.length === 0) {
            return NextResponse.json({ error: "No doctor profile found" }, { status: 404 });
        }

        const doctorId = doctorResult.rows[0].id;

        const appointmentResult = await pool.query(
            `SELECT id, patient_id, date, time
             FROM booked_appointments
             WHERE doctor_id = $1
               AND date = CURRENT_DATE
               AND time::TIME >= CURRENT_TIME - INTERVAL '60 minutes'
             ORDER BY time::TIME
             LIMIT 1`,
            [doctorId]
        );

        if (appointmentResult.rows.length === 0) {
            return NextResponse.json({ error: "No appointment found for today" }, { status: 404 });
        }

        return NextResponse.json(appointmentResult.rows[0]);
    } catch (error) {
        console.error("Error fetching current appointment:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
