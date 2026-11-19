import { beforeEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/crypto";

describe("token crypto", () => {
  beforeEach(() => {
    process.env.TOKEN_ENC_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("round-trips", () => {
    expect(decryptToken(encryptToken("gho_abc"))).toBe("gho_abc");
  });

  it("uses a random IV", () => {
    expect(encryptToken("gho_abc")).not.toBe(encryptToken("gho_abc"));
  });

  it("outputs iv.tag.ciphertext base64url", () => {
    const parts = encryptToken("gho_abc").split(".");
    expect(parts).toHaveLength(3);
    for (const p of parts) expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects tampered ciphertext", () => {
    const enc = encryptToken("x");
    const parts = enc.split(".");
    parts[2] = Buffer.from("y").toString("base64url");
    expect(() => decryptToken(parts.join("."))).toThrow();
    expect(() => decryptToken(enc.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toThrow();
  });

  it("throws when key is missing or wrong length", () => {
    delete process.env.TOKEN_ENC_KEY;
    expect(() => encryptToken("x")).toThrow(/TOKEN_ENC_KEY/);
    process.env.TOKEN_ENC_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(() => encryptToken("x")).toThrow(/32/);
  });
});
