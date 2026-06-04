import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";

describe("secret encryption", () => {
  it("round-trips encrypted values", () => {
    const encrypted = encryptSecret("secret-value");
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain("secret-value");
    expect(decryptSecret(encrypted)).toBe("secret-value");
  });

  it("keeps empty secrets empty", () => {
    expect(encryptSecret("")).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });
});
