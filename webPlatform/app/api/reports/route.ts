import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireDoctor } from "@/lib/db-auth";

export async function GET(_request: NextRequest) {
    const authResult = await requireDoctor(_request);
    if (authResult instanceof NextResponse) return authResult;
    try {
        const results = await pool.query(
            `SELECT id,
                    patient_name AS "patientName",
                    patient_surname AS "patientSurname",
                    date::text,
                    title,
                    content,
                    (preview IS FALSE) AS "finalized"
            FROM reports
            ORDER BY date DESC`
        );
        return NextResponse.json(results.rows);
    } catch (error) {  
        console.error("Error fetching reports:", error);  
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
    }  
}