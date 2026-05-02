import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// fetch suggestions for a specific appointment
export async function GET(request: NextRequest) {
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
       FROM suggestions
       WHERE appointment_id = $1
       ORDER BY timestamp::TIME DESC`,
      [appointmentId]
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// create a new suggestion for an appointment
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
      `INSERT INTO suggestions (content, source, appointment_id)
       VALUES ($1, $2, $3)
       RETURNING id, content, source, timestamp`,
      [content, source || null, appointmentId]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating suggestion:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
