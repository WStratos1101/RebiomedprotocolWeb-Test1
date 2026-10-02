import { describe, expect, it } from "vitest";
import { calculateDilution } from "../client/src/lib/dilutionMath";

describe("dilution calculator", () => {
  const base = {
    c1: 10,
    v1: 20,
    c2: 2,
    v2: 100,
    c1Unit: "mg/mL" as const,
    c2Unit: "mg/mL" as const,
    v1Unit: "µL" as const,
    v2Unit: "µL" as const,
  };

  it("solves each of C1, V1, C2 and V2", () => {
    expect(calculateDilution("C1", base)).toBeCloseTo(10);
    expect(calculateDilution("V1", base)).toBeCloseTo(20);
    expect(calculateDilution("C2", base)).toBeCloseTo(2);
    expect(calculateDilution("V2", base)).toBeCloseTo(100);
  });

  it("converts mixed volume and same-family concentration units", () => {
    expect(calculateDilution("V1", {
      ...base,
      c1: 1,
      c2: 500,
      c2Unit: "mg/L",
      v1: 1,
      v1Unit: "mL",
      v2: 2,
      v2Unit: "L",
    })).toBeCloseTo(1000);
  });

  it("supports molar units without confusing them with mass units", () => {
    expect(calculateDilution("C1", {
      ...base,
      c1: 1,
      c1Unit: "mol/L",
      c2: 1,
      c2Unit: "mol/mL",
    })).toBeCloseTo(5000);
    expect(calculateDilution("C1", { ...base, c1Unit: "mol/L" })).toBeNull();
  });

  it("supports percentage concentrations for C1 and C2", () => {
    const percentBase = { ...base, c1: 10, c2: 2, c1Unit: "%" as const, c2Unit: "%" as const };
    expect(calculateDilution("C1", percentBase)).toBeCloseTo(10);
    expect(calculateDilution("C2", percentBase)).toBeCloseTo(2);
    expect(calculateDilution("V1", percentBase)).toBeCloseTo(20);
    expect(calculateDilution("C1", { ...base, c1Unit: "%" as const })).toBeNull();
  });

  it("rejects missing or non-positive known values", () => {
    expect(calculateDilution("V1", { ...base, c1: 0 })).toBeNull();
    expect(calculateDilution("C2", { ...base, v2: Number.NaN })).toBeNull();
  });
});
