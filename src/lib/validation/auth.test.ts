import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validation/auth";

describe("loginSchema", () => {
  it("normalizes email to lowercase and trims whitespace", () => {
    const result = loginSchema.parse({ email: "  User@Example.com  ", password: "x" });
    expect(result.email).toBe("user@example.com");
  });

  it("rejects an invalid email", () => {
    expect(() => loginSchema.parse({ email: "not-an-email", password: "x" })).toThrow();
  });

  it("rejects an empty password", () => {
    expect(() => loginSchema.parse({ email: "user@example.com", password: "" })).toThrow();
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Nadia Voss",
    username: "nadiavoss",
    email: "nadia@example.com",
    password: "Str0ngPassw0rd",
  };

  it("accepts a well-formed registration", () => {
    expect(() => registerSchema.parse(valid)).not.toThrow();
  });

  it("rejects a username with uppercase or symbols", () => {
    expect(() => registerSchema.parse({ ...valid, username: "Nadia-Voss!" })).toThrow();
  });

  it("rejects a password missing a number", () => {
    expect(() => registerSchema.parse({ ...valid, password: "NoNumbersHere" })).toThrow();
  });

  it("rejects a password missing an uppercase letter", () => {
    expect(() => registerSchema.parse({ ...valid, password: "alllowercase1" })).toThrow();
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(() => registerSchema.parse({ ...valid, password: "Ab1" })).toThrow();
  });
});
