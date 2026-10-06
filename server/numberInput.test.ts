import { describe, expect, it } from "vitest";
import { parseLocaleNumber } from "../client/src/lib/numberInput";

describe("parseLocaleNumber", () => {
  it("parses comma decimals", () => {
    expect(parseLocaleNumber("0,25")).toBeCloseTo(0.25);
    expect(parseLocaleNumber("12,5")).toBeCloseTo(12.5);
  });

  it("treats dot as a decimal separator, never as thousands", () => {
    expect(parseLocaleNumber("1.234")).toBeCloseTo(1.234);
    expect(parseLocaleNumber("1,234")).toBeCloseTo(1.234);
    expect(Number.isNaN(parseLocaleNumber("1.234,56"))).toBe(true);
  });

  it("rejects blank or malformed values", () => {
    expect(Number.isNaN(parseLocaleNumber(""))).toBe(true);
    expect(Number.isNaN(parseLocaleNumber("abc"))).toBe(true);
  });
});
