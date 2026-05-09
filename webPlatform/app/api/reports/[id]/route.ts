import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireDoctor } from "@/lib/db-auth";

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
