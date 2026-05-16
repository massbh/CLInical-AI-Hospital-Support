import { NextRequest } from "next/server";

const mockQuery = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { signToken } from "@/lib/auth";
import { GET, POST } from "@/app/api/notes/route";

function getRequest(url: string, token?: string) {
  const headers = new Headers();
  if (token) headers.set("cookie", `auth_token=${token}`);
  return new NextRequest(new Request(url, { headers }));
}

function postRequest(url: string, body: unknown) {
  return new NextRequest(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => mockQuery.mockReset());

describe("GET /api/notes", () => {
  it("401 without auth", async () => {
    const r = await GET(getRequest("http://x/api/notes?appointmentId=a1"));
    expect(r.status).toBe(401);
  });

  it("403 for patient", async () => {
    const token = await signToken("p", "P", "patient");
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "p", name: "P", account_type: "patient" }],
    });
    const r = await GET(getRequest("http://x/api/notes?appointmentId=a1", token));
    expect(r.status).toBe(403);
  });

  it("400 when appointmentId missing", async () => {
    const token = await signToken("d", "D", "doctor");
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "d", name: "D", account_type: "doctor" }],
    });
    const r = await GET(getRequest("http://x/api/notes", token));
    expect(r.status).toBe(400);
  });

  it("200 returns notes for doctor", async () => {
    const token = await signToken("d", "D", "doctor");
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "d", name: "D", account_type: "doctor" }] })
      .mockResolvedValueOnce({
        rows: [{ id: "n1", content: "hi", source: "medBrain", timestamp: "t" }],
      });
    const r = await GET(getRequest("http://x/api/notes?appointmentId=a1", token));
    expect(r.status).toBe(200);
    expect((await r.json())[0].id).toBe("n1");
  });
});

describe("POST /api/notes (internal)", () => {
  it("400 when content missing", async () => {
    const r = await POST(postRequest("http://x/api/notes", { appointmentId: "a" }));
    expect(r.status).toBe(400);
  });

  it("201 creates note", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "n1", content: "hi", source: "medBrain", timestamp: "t" }],
    });
    const r = await POST(
      postRequest("http://x/api/notes", { content: "hi", source: "medBrain", appointmentId: "a1" })
    );
    expect(r.status).toBe(201);
    expect((await r.json()).id).toBe("n1");
  });

  it("500 on db error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("db boom"));
    const r = await POST(
      postRequest("http://x/api/notes", { content: "hi", appointmentId: "a1" })
    );
    expect(r.status).toBe(500);
  });
});
