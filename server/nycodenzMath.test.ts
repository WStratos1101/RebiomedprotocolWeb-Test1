import { describe, expect, it } from "vitest";
import { calculateNycodenzOneLayer, calculateNycodenzTwoLayers } from "../client/src/lib/nycodenzMath";

describe("Nycodenz calculations", () => {
  it("calculates one layer from 12 mL total and 5 mL available", () => {
    const result = calculateNycodenzOneLayer({ stockPercent: 100, targetPercent: 9.6, totalVolume: 12, availableVolume: 5 });
    expect(result.nycodenzVolume).toBeCloseTo(1.152, 6);
    expect(result.gbssbVolume).toBeCloseTo(5.848, 6);
  });

  it("calculates the high layer first and the second 4 mL layer", () => {
    const result = calculateNycodenzTwoLayers({ stockPercent: 100, targetPercent1: 9.6, targetPercent2: 4.8, totalVolume: 8, availableVolume: 5 });
    expect(result.layer1.totalVolume).toBe(3);
    expect(result.layer1.nycodenzVolume).toBeCloseTo(0.288, 6);
    expect(result.layer1.gbssbVolume).toBeCloseTo(2.712, 6);
    expect(result.layer2.totalVolume).toBe(4);
    expect(result.layer2.nycodenzVolume).toBeCloseTo(0.192, 6);
    expect(result.layer2.gbssbVolume).toBeCloseTo(3.808, 6);
  });
});
