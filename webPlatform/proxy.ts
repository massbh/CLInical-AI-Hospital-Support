import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export const config = {
  matcher: [
    "/appointments",
    "/appointments/new",
    "/appointments/:path+",
    "/conversation/:path*",
    "/reports/:path*",
    "/login",
    "/signup",
    "/api/auth/set-cookie",
  ],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname === "/signup") {
    const token = request.cookies.get("auth_token")?.value;

    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        return NextResponse.redirect(
          new URL(
            payload.accountType === "doctor" ? "/appointments" : "/appointments/new",
            request.url
          )
        );
      }
    }

    return NextResponse.next();
  }

  let token: string | undefined = request.cookies.get("auth_token")?.value;

  if (!token) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.length > 7 && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const accountType = payload.accountType;

  if (pathname === "/appointments") {
    if (accountType !== "doctor") {
      return NextResponse.redirect(new URL("/appointments/new", request.url));
    }
  } else if (pathname === "/appointments/new") {
    if (accountType !== "patient") {
      return NextResponse.redirect(new URL("/appointments", request.url));
    }
  } else if (pathname.startsWith("/conversation")) {
    if (accountType !== "doctor") {
      return NextResponse.redirect(new URL("/appointments", request.url));
    }
  } else if (pathname.startsWith("/reports")) {
    if (accountType !== "doctor") {
      return NextResponse.redirect(new URL("/appointments", request.url));
    }
  }

  return NextResponse.next();
}
