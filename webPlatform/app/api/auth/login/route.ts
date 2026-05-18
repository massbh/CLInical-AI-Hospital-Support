import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { procedures } from "@/lib/db-procedures";
import { signToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
        return NextResponse.json(
            { error: "Missing required fields: email, password" },
            { status: 400 }
        );
    }

    try {
        const result = await procedures.authGetUserByEmail(email);

        if (result.length === 0) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }

        const account = result[0];

        const passwordMatch = await bcrypt.compare(password, account.password_hash);

        if (!passwordMatch) {
            return NextResponse.json(
                { error: "Invalid email or password" },
                { status: 401 }
            );
        }

        const token = await signToken(account.id, account.name, account.account_type);

        const response = NextResponse.json({
            token,
            user: {
                id: account.id,
                name: account.name,
                accountType: account.account_type,
            },
        });

        response.cookies.set("auth_token", token, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60,
            secure: process.env.NODE_ENV === "production",
        });

        return response;
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
