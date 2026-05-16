import { signToken, verifyToken } from "@/lib/auth";

describe("lib/auth", () => {
  it("signs and verifies a token roundtrip", async () => {
    const token = await signToken("user-123", "Alice", "doctor");
    expect(typeof token).toBe("string");
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.id).toBe("user-123");
    expect(payload!.name).toBe("Alice");
    expect(payload!.accountType).toBe("doctor");
  });

  it("returns null for a tampered token", async () => {
    const token = await signToken("u", "n", "patient");
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifyToken(tampered)).toBeNull();
  });

  it("returns null for garbage input", async () => {
    expect(await verifyToken("not-a-jwt")).toBeNull();
  });
});
