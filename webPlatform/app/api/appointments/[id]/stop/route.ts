import { NextRequest, NextResponse } from "next/server";
import { callTradLlmSession } from "@/lib/tradllm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "appointment id is required" },
      { status: 400 }
    );
  }

  try {
    const result = await callTradLlmSession("stop", id);
    return NextResponse.json(result.body, { status: result.ok ? 200 : 502 });
  } catch (error) {
    console.error("Error stopping tradLlm session:", error);
    return NextResponse.json(
      { error: "Failed to reach tradLlm" },
      { status: 502 }
    );
  }
}
