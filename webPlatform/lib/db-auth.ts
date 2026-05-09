import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./auth";
import pool from "./db";
import { cookies } from "next/headers";

export interface AuthUser {
  id: string;
  name: string;
  accountType: "patient" | "doctor";
}

export async function getAuthUser(
  request: NextRequest
): Promise<AuthUser | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const result = await pool.query(
    "SELECT id, name, account_type FROM accounts WHERE id = $1",
    [payload.id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    accountType: row.account_type,
  };
}

export async function getAuthUserFromCookies(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const result = await pool.query(
    "SELECT id, name, account_type FROM accounts WHERE id = $1",
    [payload.id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    accountType: row.account_type,
  };
}

export async function requireAuth(
  request: NextRequest
): Promise<{ user: AuthUser } | NextResponse> {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return { user };
}

export async function requireDoctor(
  request: NextRequest
): Promise<{ user: AuthUser } | NextResponse> {
  const result = await requireAuth(request);
  if (result instanceof NextResponse) return result;

  if (result.user.accountType !== "doctor") {
    return NextResponse.json(
      { error: "Forbidden: doctors only" },
      { status: 403 }
    );
  }
  return result;
}

export async function requirePatient(
  request: NextRequest
): Promise<{ user: AuthUser } | NextResponse> {
  const result = await requireAuth(request);
  if (result instanceof NextResponse) return result;

  if (result.user.accountType !== "patient") {
    return NextResponse.json(
      { error: "Forbidden: patients only" },
      { status: 403 }
    );
  }
  return result;
}
