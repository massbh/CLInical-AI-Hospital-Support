import { NextRequest, NextResponse } from "next/server";  
import { procedures } from "@/lib/db-procedures";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }>}) {
    const { id } = await params;

    try {
        const result = await procedures.doctorGetSchedule(id);
        
        if (result.length === 0) {
            return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
        }
        
        const row = result[0];
        return NextResponse.json([{
            doctorId: row.doctor_id,
            workingDays: row.working_days,
            workHours: row.work_hours
        }]);
    } catch (error) {
        console.error("Error fetching doctor schedule:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 505 });
    }
}