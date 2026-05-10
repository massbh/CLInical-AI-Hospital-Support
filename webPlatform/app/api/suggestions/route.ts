import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireDoctor } from "@/lib/db-auth";

// The suggestions table on the live DB stores (title, description, priority)
// instead of the (content, source) pair that the rest of the system speaks.
// This route bridges the two shapes so medBrain can keep POSTing { content,
// source } and the conversation page can keep reading { content, source }.

const SUGGESTION_TITLE_MAX = 80;

function buildTitle(content: string): string {
  const firstLine = content.split(/[\n.!?]/)[0]?.trim() || content.trim();
  if (firstLine.length <= SUGGESTION_TITLE_MAX) return firstLine;
  return firstLine.slice(0, SUGGESTION_TITLE_MAX - 1).trimEnd() + "…";
}

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
      `SELECT id,
              description AS content,
              priority,
              title,
              NULL::text AS source,
              timestamp
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

// Internal-only — called by medBrain (server-side). Accepts the legacy
// { content, source, appointmentId } payload and maps it onto the live
// (title, description, priority) schema.
export async function POST(request: NextRequest) {
  try {
    const { content, appointmentId, priority } = await request.json();

    if (!content || !appointmentId) {
      return NextResponse.json(
        { error: "content and appointmentId are required" },
        { status: 400 }
      );
    }

    const title = buildTitle(String(content));
    const resolvedPriority = priority || "medium";

    const result = await pool.query(
      `INSERT INTO suggestions (title, description, priority, appointment_id)
       VALUES ($1, $2, $3::suggestion_priority, $4)
       RETURNING id, description AS content, priority, title, timestamp`,
      [title, content, resolvedPriority, appointmentId]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error creating suggestion:", error);
    return NextResponse.json(
      { error: "Internal server error", detail: message },
      { status: 500 }
    );
  }
}
