import { NextRequest, NextResponse } from "next/server";
import { signToken } from "@/lib/auth";

const mockQuery = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { getAuthUser, requireAuth, requireDoctor, requirePatient } from "@/lib/db-auth";

function makeRequest(opts: { token?: string; bearer?: string } = {}) {
  const headers = new Headers();
  if (opts.bearer) headers.set("authorization", `Bearer ${opts.bearer}`);
  const cookieHeader = opts.token ? `auth_token=${opts.token}` : "";
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return new NextRequest(new Request("http://localhost/test", { headers }));
}

beforeEach(() => mockQuery.mockReset());

describe("getAuthUser", () => {
  it("returns null when no token is present", async () => {
    expect(await getAuthUser(makeRequest())).toBeNull();
  });

  it("returns null when token is invalid", async () => {
    expect(await getAuthUser(makeRequest({ token: "garbage" }))).toBeNull();
  });

  it("returns user from cookie token + DB row", async () => {
    const token = await signToken("u-1", "Alice", "doctor");
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "u-1", name: "Alice", account_type: "doctor" }],
    });
    const user = await getAuthUser(makeRequest({ token }));
    expect(user).toEqual({ id: "u-1", name: "Alice", accountType: "doctor" });
  });

  it("prefers Authorization header over cookie", async () => {
    const headerToken = await signToken("u-h", "H", "patient");
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "u-h", name: "H", account_type: "patient" }],
    });
    const user = await getAuthUser(makeRequest({ bearer: headerToken, token: "ignored" }));
    expect(user!.id).toBe("u-h");
  });

  it("returns null when user not found in DB", async () => {
    const token = await signToken("ghost", "G", "doctor");
    mockQuery.mockResolvedValueOnce({ rows: [] });
    expect(await getAuthUser(makeRequest({ token }))).toBeNull();
  });
});

describe("requireAuth / requireDoctor / requirePatient", () => {
  it("requireAuth returns 401 when no user", async () => {
    const r = await requireAuth(makeRequest());
    expect(r).toBeInstanceOf(NextResponse);
    expect((r as NextResponse).status).toBe(401);
  });

  it("requireDoctor returns 403 for patient", async () => {
    const token = await signToken("p", "P", "patient");
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "p", name: "P", account_type: "patient" }],
    });
    const r = await requireDoctor(makeRequest({ token }));
    expect(r).toBeInstanceOf(NextResponse);
    expect((r as NextResponse).status).toBe(403);
  });

  it("requireDoctor passes for doctor", async () => {
    const token = await signToken("d", "D", "doctor");
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "d", name: "D", account_type: "doctor" }],
    });
    const r = await requireDoctor(makeRequest({ token }));
    expect(r).not.toBeInstanceOf(NextResponse);
    expect((r as { user: { id: string } }).user.id).toBe("d");
  });

  it("requirePatient returns 403 for doctor", async () => {
    const token = await signToken("d", "D", "doctor");
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "d", name: "D", account_type: "doctor" }],
    });
    const r = await requirePatient(makeRequest({ token }));
    expect((r as NextResponse).status).toBe(403);
  });
});
