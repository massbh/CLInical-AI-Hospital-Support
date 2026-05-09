import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireDoctor } from "@/lib/db-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }>}) {
    const authResult = await requireDoctor(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
  
  try {  
    const result = await pool.query(  
      `SELECT id, title, status  
       FROM report_sections  
       WHERE report_id = $1  
       ORDER BY created_at`,  
      [id]  
    );  
  
    return NextResponse.json(result.rows);  
  } catch (error) {  
    console.error("Error fetching sections:", error);  
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
  }  
}