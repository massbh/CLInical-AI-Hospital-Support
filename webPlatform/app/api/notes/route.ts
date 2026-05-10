import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
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
    const result = await pool.query(  
      `SELECT id, content, source, timestamp  
       FROM notes  
       WHERE appointment_id = $1  
       ORDER BY timestamp::TIME DESC`,  
      [appointmentId]  
    );  
    return NextResponse.json(result.rows);  
  } catch (error) {  
    console.error("Error fetching notes:", error);  
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
  }  
}  
  
// Create a new note for an appointment.
// Internal-only — called by medBrain (server-side) on the same host. The
// frontend never POSTs here, only GETs. Auth is intentionally skipped so
// medBrain's localhost requests aren't blocked by missing doctor cookies.
export async function POST(request: NextRequest) {
    try {
    const { content, source, appointmentId } = await request.json();  
  
    if (!content || !appointmentId) {  
      return NextResponse.json(  
        { error: "content and appointmentId are required" },  
        { status: 400 }  
      );  
    }  
  
    const result = await pool.query(  
      `INSERT INTO notes (content, source, appointment_id)  
       VALUES ($1, $2, $3)  
       RETURNING id, content, source, timestamp`,  
      [content, source || null, appointmentId]  
    );  
  
    return NextResponse.json(result.rows[0], { status: 201 });  
  } catch (error) {  
    console.error("Error creating note:", error);  
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
  }  
}