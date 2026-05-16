import { NextRequest, NextResponse } from "next/server";  
import bcrypt from "bcrypt";  
import { procedures } from "@/lib/db-procedures";

export async function POST(request: NextRequest) {
    const body = await request.json();  
    const { name, email, password, accountType } = body;  

    if (!name || !email || !password || !accountType) {
        return NextResponse.json(
            { error: "Missing one or more required fields: name, email, password, accountType" },
            { status: 400 }
        );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;  
    if (!emailRegex.test(email)) {  
        return NextResponse.json(  
            { error: "Invalid email format" },  
            { status: 400 }  
        );  
    }

    if (accountType !== "doctor" && accountType !== "patient") {
        return NextResponse.json(  
            { error: "accountType must be 'patient' or 'doctor'" },  
            { status: 400 }  
        ); 
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const accountResult = await procedures.authCreateAccount(
            name, 
            email, 
            passwordHash, 
            accountType as "patient" | "doctor"
        );

        const accountId = accountResult[0].id;

        if (accountType === "doctor") {
            await procedures.authCreateDoctor(name, accountId);
        }

        return NextResponse.json({ id: accountId }, { status: 201 });

    } catch (error: unknown) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code: string}).code === "23505"
        ) {
            return NextResponse.json(
                { error: "An account with this email already exists" },  
                { status: 409 } 
            );
        }

        console.error("Signup error:", error);  
        return NextResponse.json(  
            { error: "Internal server error" },  
            { status: 500 }  
        ); 
    }
}