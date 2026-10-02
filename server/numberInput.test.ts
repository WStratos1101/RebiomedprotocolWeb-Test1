import { describe, expect, it } from "vitest";
import { parseLocaleNumber } from "../client/src/lib/numberInput";

describe("parseLocaleNumber", () => {
  it("parses comma decimals", () => {
    expect(parseLocaleNumber("0,25")).toBeCloseTo(0.25);
    expect(parseLocaleNumber("12,5")).toBeCloseTo(12.5);
  });

  it("removes dot thousands separators before parsing decimals", () => {
    expect(parseLocaleNumber("1.234")).toBe(1234);
    expect(parseLocaleNumber("1.234.567,89")).toBeCloseTo(1234567.89);
  });

  it("rejects blank or malformed values", () => {
    expect(Number.isNaN(parseLocaleNumber(""))).toBe(true);
    expect(Number.isNaN(parseLocaleNumber("abc"))).toBe(true);
  });
});
