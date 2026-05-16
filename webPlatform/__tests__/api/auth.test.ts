import { NextRequest } from "next/server";

const mockQuery = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args) },
}));

const mockHash = jest.fn();
const mockCompare = jest.fn();
jest.mock("bcrypt", () => ({
  __esModule: true,
  default: {
    hash: (...args: unknown[]) => mockHash(...args),
    compare: (...args: unknown[]) => mockCompare(...args),
  },
}));

import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as signupPOST } from "@/app/api/auth/signup/route";

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  mockQuery.mockReset();
  mockHash.mockReset();
  mockCompare.mockReset();
});

describe("POST /api/auth/login", () => {
  it("400 when fields missing", async () => {
    const r = await loginPOST(jsonRequest("http://x/login", { email: "a@b.c" }));
    expect(r.status).toBe(400);
  });

  it("401 when email not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const r = await loginPOST(jsonRequest("http://x/login", { email: "a@b.c", password: "p" }));
    expect(r.status).toBe(401);
  });

  it("401 when password mismatches", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "1", name: "A", email: "a@b.c", password_hash: "h", account_type: "doctor" }],
    });
    mockCompare.mockResolvedValueOnce(false);
    const r = await loginPOST(jsonRequest("http://x/login", { email: "a@b.c", password: "bad" }));
    expect(r.status).toBe(401);
  });

  it("200 + token + cookie on valid credentials", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "1", name: "A", email: "a@b.c", password_hash: "h", account_type: "doctor" }],
    });
    mockCompare.mockResolvedValueOnce(true);

    const r = await loginPOST(jsonRequest("http://x/login", { email: "a@b.c", password: "ok" }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(typeof data.token).toBe("string");
    expect(data.user.accountType).toBe("doctor");
    expect(r.cookies.get("auth_token")?.value).toBe(data.token);
  });
});

describe("POST /api/auth/signup", () => {
  it("400 when missing fields", async () => {
    const r = await signupPOST(jsonRequest("http://x/signup", { email: "a@b.c" }));
    expect(r.status).toBe(400);
  });

  it("400 on bad email format", async () => {
    const r = await signupPOST(
      jsonRequest("http://x/signup", {
        name: "A",
        email: "no-at-sign",
        password: "p",
        accountType: "doctor",
      })
    );
    expect(r.status).toBe(400);
  });

  it("400 on bad accountType", async () => {
    const r = await signupPOST(
      jsonRequest("http://x/signup", {
        name: "A",
        email: "a@b.c",
        password: "p",
        accountType: "admin",
      })
    );
    expect(r.status).toBe(400);
  });

  it("201 inserts patient account", async () => {
    mockHash.mockResolvedValueOnce("hashed");
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "new-id" }] });
    const r = await signupPOST(
      jsonRequest("http://x/signup", {
        name: "A",
        email: "a@b.c",
        password: "p",
        accountType: "patient",
      })
    );
    expect(r.status).toBe(201);
    expect((await r.json()).id).toBe("new-id");
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("201 inserts doctor and creates doctor row", async () => {
    mockHash.mockResolvedValueOnce("hashed");
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "doc-1" }] })
      .mockResolvedValueOnce({ rows: [] });
    const r = await signupPOST(
      jsonRequest("http://x/signup", {
        name: "Dr A",
        email: "dr@b.c",
        password: "p",
        accountType: "doctor",
      })
    );
    expect(r.status).toBe(201);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("409 on duplicate email", async () => {
    mockHash.mockResolvedValueOnce("hashed");
    mockQuery.mockRejectedValueOnce({ code: "23505" });
    const r = await signupPOST(
      jsonRequest("http://x/signup", {
        name: "A",
        email: "a@b.c",
        password: "p",
        accountType: "patient",
      })
    );
    expect(r.status).toBe(409);
  });
});
