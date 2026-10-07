import { describe, expect, it } from "vitest";
import { calculateIccBlocking, calculateIccDapi, calculateIccPermeabilization, calculateIccPrimary, calculateIccSecondary } from "../client/src/lib/iccMath";

describe("ICC volume calculations", () => {
  it("calculates primary antibody stock and carrier from total volume", () => {
    const rows = calculateIccPrimary(1500, 300);
    expect(rows?.[0].volume).toBeCloseTo(5, 8);
    expect(rows?.[1].volume).toBeCloseTo(1495, 8);
  });

  it("calculates secondary antibody at 1:500", () => {
    const rows = calculateIccSecondary(1500);
    expect(rows?.[0].volume).toBeCloseTo(3, 8);
    expect(rows?.[1].volume).toBeCloseTo(1497, 8);
  });

  it("calculates both permeabilization options from one total volume", () => {
    const tween = calculateIccPermeabilization(100, 0.2, "Tween 20");
    const triton = calculateIccPermeabilization(100, 0.1, "Triton X-100");
    expect(tween?.[0].volume).toBeCloseTo(0.2, 8);
    expect(tween?.[1].volume).toBeCloseTo(99.8, 8);
    expect(triton?.[0].volume).toBeCloseTo(0.1, 8);
    expect(triton?.[1].volume).toBeCloseTo(99.9, 8);
  });

  it("calculates blocking buffer at 4% serum and 1% BSA", () => {
    const rows = calculateIccBlocking(1000);
    expect(rows?.map(row => row.volume)).toEqual([40, 10, 950]);
  });

  it("calculates DAPI:PBS at 1:5", () => {
    const rows = calculateIccDapi(1500);
    expect(rows?.[0].volume).toBeCloseTo(250, 8);
    expect(rows?.[1].volume).toBeCloseTo(1250, 8);
  });

  it("rejects empty or non-positive total volume", () => {
    expect(calculateIccDapi(0)).toBeNull();
    expect(calculateIccBlocking(Number.NaN)).toBeNull();
  });
});
