import { describe, expect, it } from "vitest";
import { remainingSeconds, retrySecondsFromError } from "../src/lib/admin-access";

describe("admin access throttling", () => {
  it("parses Supabase's English retry limit", () => {
    expect(retrySecondsFromError({ message: "For security purposes, you can only request this after 46 seconds.", status: 429 })).toBe(46);
  });
  it("gracefully handles provider 429 without a number", () => {
    expect(retrySecondsFromError({ status: 429 })).toBe(60);
  });
  it("does not throttle ordinary errors", () => {
    expect(retrySecondsFromError(new Error("Network unavailable"))).toBe(0);
  });
  it("calculates the timer and stops at zero", () => {
    expect(remainingSeconds(46_000, 1000)).toBe(45);
    expect(remainingSeconds(1000, 2000)).toBe(0);
  });
});