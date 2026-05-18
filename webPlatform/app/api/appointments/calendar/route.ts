import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";
import { requireDoctor } from "@/lib/db-auth";  
  
export async function GET(_request: NextRequest) {
    const authResult = await requireDoctor(_request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult; 

   try {  
        const doctorResult = await procedures.appointmentGetDoctorByAccountId(user.id);
  
        if (doctorResult.length === 0) {  
            return NextResponse.json({ error: "No doctor profile found for this account" }, { status: 404 });  
        }  
  
        const doctorId = doctorResult[0].id;  
  
        const result = await procedures.appointmentGetCalendarForDoctor(doctorId);
        
        const formatted = result.map(row => ({
            id: row.id,
            date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
            time: row.time,
            patientName: row.patient_name
        }));
  
        return NextResponse.json(formatted);  
    } catch (error) {  
        console.error("Error fetching calendar appointments:", error);  
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
    }  
}