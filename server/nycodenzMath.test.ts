import { describe, expect, it } from "vitest";
import { calculateNycodenzOneLayer, calculateNycodenzTwoLayers } from "../client/src/lib/nycodenzMath";

describe("Nycodenz calculations", () => {
  it("calculates one layer from 12 mL total and 5 mL available", () => {
    const result = calculateNycodenzOneLayer({ stockPercent: 80, targetPercent: 9.6, totalVolume: 12, availableVolume: 5 });
    expect(result.nycodenzVolume).toBeCloseTo(1.44, 6);
    expect(result.gbssbVolume).toBeCloseTo(5.56, 6);
  });

  it("calculates two layers from 8 mL and 4 mL totals", () => {
    const result = calculateNycodenzTwoLayers({ stockPercent: 80, targetPercent1: 9.6, targetPercent2: 4.8, totalVolume: 12, layer1TotalVolume: 8, layer2TotalVolume: 4, availableVolume: 5 });
    expect(result.layer1.totalVolume).toBe(8);
    expect(result.layer1.nycodenzVolume).toBeCloseTo(0.96, 6);
    expect(result.layer1.gbssbVolume).toBeCloseTo(2.04, 6);
    expect(result.layer2.totalVolume).toBe(4);
    expect(result.layer2.nycodenzVolume).toBeCloseTo(0.24, 6);
    expect(result.layer2.gbssbVolume).toBeCloseTo(3.76, 6);
  });
});
