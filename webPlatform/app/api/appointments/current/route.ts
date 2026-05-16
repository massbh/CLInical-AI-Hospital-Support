import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";
import { requireDoctor } from "@/lib/db-auth";

export async function GET(request: NextRequest) {
    const authResult = await requireDoctor(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    try {
        const doctorResult = await procedures.appointmentGetDoctorByAccountId(user.id);

        if (doctorResult.length === 0) {
            return NextResponse.json({ error: "No doctor profile found" }, { status: 404 });
        }

        const { id: doctorId, name: doctorName } = doctorResult[0];

        const appointmentResult = await procedures.appointmentGetCurrent(doctorId);

        if (appointmentResult.length === 0) {
            return NextResponse.json({ error: "No appointment found for today" }, { status: 404 });
        }

        const row = appointmentResult[0];

        return NextResponse.json({
            id: row.id,
            patient_id: row.patient_id,
            date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
            time: row.time,
            patient_name: row.patient_name,
            patient_surname: row.patient_surname,
            doctor_name: doctorName,
        });
    } catch (error) {
        console.error("Error fetching current appointment:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
