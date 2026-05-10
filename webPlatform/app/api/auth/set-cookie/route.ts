import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { token } = body;

    if (!token) {
        return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("auth_token", token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
        secure: process.env.NODE_ENV === "production",
    });

    return response;
}
