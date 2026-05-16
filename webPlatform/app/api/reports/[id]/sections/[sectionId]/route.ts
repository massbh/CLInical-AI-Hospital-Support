import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";
import { requireDoctor } from "@/lib/db-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; sectionId: string }>}) {
    const authResult = await requireDoctor(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id, sectionId } = await params;
  
  try {  
    const result = await procedures.reportSectionGetById(sectionId, id);
  
    if (result.length === 0) {  
      return NextResponse.json({ error: "Section not found" }, { status: 404 });  
    }  
  
    return NextResponse.json(result[0]);  
  } catch (error) {  
    console.error("Error fetching section:", error);  
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
  }  
}  
  
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
    const authResult = await requireDoctor(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id, sectionId } = await params;

    const body = await request.json();
    const { status, content } = body;  
  
  try {  
    const result = await procedures.reportSectionUpdate(
        sectionId, 
        id, 
        status as "pending" | "accepted" | undefined, 
        content
    );
  
    if (result.length === 0) {  
      return NextResponse.json({ error: "Section not found" }, { status: 404 });  
    }  
  
    return NextResponse.json(result[0]);  
  } catch (error) {  
    console.error("Error updating section:", error);  
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
  }  
}