import { NextRequest } from "next/server";

const mockQuery = jest.fn();
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import { POST } from "@/app/api/suggestions/route";

function postRequest(body: unknown) {
  return new NextRequest(
    new Request("http://x/api/suggestions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => mockQuery.mockReset());

describe("POST /api/suggestions", () => {
  it("400 when content missing", async () => {
    const r = await POST(postRequest({ appointmentId: "a" }));
    expect(r.status).toBe(400);
  });

  it("201 inserts using derived title and default priority", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "s1", content: "Order ECG.", priority: "medium", title: "Order ECG", timestamp: "t" }],
    });
    const r = await POST(postRequest({ content: "Order ECG. Stat.", appointmentId: "a1" }));
    expect(r.status).toBe(201);
    const args = mockQuery.mock.calls[0][1];
    // [title, content, priority, appointmentId]
    expect(args[0]).toBe("Order ECG");
    expect(args[1]).toBe("Order ECG. Stat.");
    expect(args[2]).toBe("medium");
    expect(args[3]).toBe("a1");
  });

  it("truncates long titles with ellipsis", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "s2" }] });
    const longContent = "x".repeat(200);
    await POST(postRequest({ content: longContent, appointmentId: "a1" }));
    const title = mockQuery.mock.calls[0][1][0];
    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBe(80);
  });
});
