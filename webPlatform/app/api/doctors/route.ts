import { NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";

export async function GET() {
    try {
        const result = await procedures.doctorGetAll();
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching doctors:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}