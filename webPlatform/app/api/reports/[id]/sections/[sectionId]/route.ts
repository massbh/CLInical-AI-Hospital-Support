import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireDoctor } from "@/lib/db-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; sectionId: string }>}) {
    const authResult = await requireDoctor(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id, sectionId } = await params;
  
  try {  
    const result = await pool.query(  
      `SELECT id, title, status, content  
       FROM report_sections  
       WHERE id = $1 AND report_id = $2`,  
      [sectionId, id]  
    );  
  
    if (result.rows.length === 0) {  
      return NextResponse.json({ error: "Section not found" }, { status: 404 });  
    }  
  
    return NextResponse.json(result.rows[0]);  
  } catch (error) {  
    console.error("Error fetching section:", error);  
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
  }  
}  
  
// update report section status and/or content
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
    const authResult = await requireDoctor(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id, sectionId } = await params;

    const body = await request.json();
  const { status, content } = body;  
  
  try {  
    const result = await pool.query(        // COALESCE($1, status) means use new value if provided, otherwise keep existing.
      `UPDATE report_sections  
       SET status = COALESCE($1, status),  
           content = COALESCE($2, content)  
       WHERE id = $3 AND report_id = $4  
       RETURNING id, title, status`,  
      [status, content, sectionId, id]  
    );  
  
    if (result.rows.length === 0) {  
      return NextResponse.json({ error: "Section not found" }, { status: 404 });  
    }  
  
    return NextResponse.json(result.rows[0]);  
  } catch (error) {  
    console.error("Error updating section:", error);  
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
  }  
}