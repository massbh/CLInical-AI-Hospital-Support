import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";
import { requireDoctor } from "@/lib/db-auth";

export async function GET(_request: NextRequest) {
    const authResult = await requireDoctor(_request);
    if (authResult instanceof NextResponse) return authResult;
    try {
        const results = await procedures.reportGetAll();
        
        const formatted = results.map(row => ({
            id: row.id,
            patientName: row.patient_name,
            patientSurname: row.patient_surname,
            date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
            title: row.title,
            content: row.content,
            finalized: row.finalized
        }));
        
        return NextResponse.json(formatted);
    } catch (error) {  
        console.error("Error fetching reports:", error);  
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
    }  
}