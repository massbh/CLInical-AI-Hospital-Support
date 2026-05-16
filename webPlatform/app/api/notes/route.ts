import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";
import { requireDoctor } from "@/lib/db-auth";

export async function GET(request: NextRequest) {
    const authResult = await requireDoctor(request);
    if (authResult instanceof NextResponse) return authResult;

    const appointmentId = new URL(request.url).searchParams.get("appointmentId");
  
  if (!appointmentId) {  
    return NextResponse.json(  
      { error: "appointmentId query parameter is required" },  
      { status: 400 }  
    );  
  }  
  
  try {  
    const result = await procedures.noteGetByAppointment(appointmentId);
    return NextResponse.json(result);  
  } catch (error) {  
    console.error("Error fetching notes:", error);  
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
  }  
}  
  
export async function POST(request: NextRequest) {
    try {
    const { content, source, appointmentId } = await request.json();  
  
    if (!content || !appointmentId) {  
      return NextResponse.json(  
        { error: "content and appointmentId are required" },  
        { status: 400 }  
      );  
    }  
  
    const result = await procedures.noteCreate(content, source || null, appointmentId);
  
    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Internal server error", detail: message },
      { status: 500 }
    );
  }
}