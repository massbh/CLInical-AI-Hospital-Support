import { SignJWT, jwtVerify, JWTPayload } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "development-secret-change-in-production"
);

export interface AuthTokenPayload extends JWTPayload {
  id: string;
  name: string;
  accountType: "patient" | "doctor";
}

export async function signToken(
  userId: string,
  name: string,
  accountType: "patient" | "doctor"
): Promise<string> {
  return new SignJWT({ id: userId, name, accountType })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as AuthTokenPayload;
  } catch {
    return null;
  }
}
