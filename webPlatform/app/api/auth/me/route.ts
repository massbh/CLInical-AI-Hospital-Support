import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/db-auth";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json(user);
}
