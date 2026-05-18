import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";
import { requireDoctor } from "@/lib/db-auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }>}) {
    const authResult = await requireDoctor(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await params;
  
  try {  
    const result = await procedures.reportSectionGetAll(id);
    return NextResponse.json(result);  
  } catch (error) {  
    console.error("Error fetching sections:", error);  
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });  
  }  
}