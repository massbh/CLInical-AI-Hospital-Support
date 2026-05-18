import { NextRequest, NextResponse } from "next/server";
import { procedures } from "@/lib/db-procedures";
import { requireDoctor } from "@/lib/db-auth";

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
    const result = await procedures.suggestionGetByAppointment(appointmentId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    const result = await procedures.suggestionCreate(title, content, resolvedPriority, appointmentId);

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error creating suggestion:", error);
    return NextResponse.json(
      { error: "Internal server error", detail: message },
      { status: 500 }
    );
  }
}
