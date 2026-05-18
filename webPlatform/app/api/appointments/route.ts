import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";
import { requirePatient } from "@/lib/db-auth";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const doctorId = searchParams.get("doctorId");

    try {
        const result = await procedures.appointmentGetAll(doctorId || undefined);
        
        const formatted = result.map(row => ({
            doctorId: row.doctor_id,
            date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
            time: row.time
        }));
        
        return NextResponse.json(formatted);
    } catch (error) {
        console.error("Error fetching appointments:", error);  
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
    }
}

export async function POST(request: NextRequest) {
    const authResult = await requirePatient(request);
    if (authResult instanceof NextResponse) return authResult;
    const patientId = authResult.user.id;
    
    const body = await request.json();
    let { doctorId } = body;
    const { date, time } = body;

    if (!doctorId || !patientId || !date || !time) {
        return NextResponse.json(  
            { error: "Missing required fields: doctorId, patientId, date, time" },  
            { status: 400 }  
        ); 
    }

    try {
        if (doctorId === "all") {
            const available = await procedures.appointmentFindAvailable(date, time);

            if (available.length === 0) {
                 return NextResponse.json(  
                    { error: "No doctors available at this date and time" },  
                    { status: 409 }  
                ); 
            }

            doctorId = available[0].id;  
        }
        
        const result = await procedures.appointmentBook(doctorId, patientId, date, time);
        
        const row = result[0];
        return NextResponse.json({
            id: row.id,
            doctorId: row.doctor_id,
            date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
            time: row.time
        }, { status: 201 }); 
    } catch (error: unknown) {
        if (
            typeof error === "object" &&  
            error !== null &&  
            "code" in error &&  
            (error as { code: string }).code === "23505"  
        ) {
            return NextResponse.json(  
                { error: "This time slot is already booked" },  
                { status: 409 }  
            );  
        }

        console.error("Error booking appointment:", error);  
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
