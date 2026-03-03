import { describe, it, expect } from "vitest";
import { encryptData, decryptData } from "../crypto.js";

describe("encryptData / decryptData", () => {
  it("roundtrip: encrypt then decrypt returns original data", async () => {
    const data = { hello: "world", num: 42, arr: [1, 2, 3] };
    const envelope = await encryptData(data, "test-password-123");
    const result = await decryptData(envelope, "test-password-123");
    expect(result).toEqual(data);
  });

  it("wrong password throws with user-friendly message", async () => {
    const data = { test: true };
    const envelope = await encryptData(data, "correct-password");
    await expect(decryptData(envelope, "wrong-password")).rejects.toThrow("Wrong password");
  });

  it("unknown format throws", async () => {
    await expect(decryptData({ format: "unknown-format" }, "pw")).rejects.toThrow("Unknown file format");
  });

  it("envelope contains expected fields", async () => {
    const envelope = await encryptData({ x: 1 }, "pw");
    expect(envelope.format).toBe("greenlight-encrypted-v1");
    expect(envelope.algorithm).toBe("AES-GCM");
    expect(envelope.kdf).toBe("PBKDF2");
    expect(envelope.kdfIterations).toBe(600_000);
    expect(typeof envelope.salt).toBe("string");
    expect(typeof envelope.iv).toBe("string");
    expect(typeof envelope.payload).toBe("string");
  });

  it("different exports produce different ciphertext and salts", async () => {
    const data = { same: "data" };
    const env1 = await encryptData(data, "same-password");
    const env2 = await encryptData(data, "same-password");
    expect(env1.payload).not.toBe(env2.payload);
    expect(env1.salt).not.toBe(env2.salt);
    expect(env1.iv).not.toBe(env2.iv);
  });

  it("missing envelope fields throws descriptive error, not raw DOMException", async () => {
    const base = { format: "greenlight-encrypted-v1", salt: "abc", iv: "def", payload: "ghi" };
    await expect(decryptData({ ...base, iv: undefined }, "pw")).rejects.toThrow("missing required fields");
    await expect(decryptData({ ...base, payload: undefined }, "pw")).rejects.toThrow("missing required fields");
    await expect(decryptData({ ...base, salt: undefined }, "pw")).rejects.toThrow("missing required fields");
  });
});
