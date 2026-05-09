import { NextRequest, NextResponse } from "next/server";
import { callTradLlmSession } from "@/lib/tradllm";
import { requireDoctor } from "@/lib/db-auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireDoctor(_request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "appointment id is required" },
      { status: 400 }
    );
  }

  try {
    const result = await callTradLlmSession("start", id);
    return NextResponse.json(result.body, { status: result.ok ? 200 : 502 });
  } catch (error) {
    console.error("Error starting tradLlm session:", error);
    return NextResponse.json(
      { error: "Failed to reach tradLlm" },
      { status: 502 }
    );
  }
}
