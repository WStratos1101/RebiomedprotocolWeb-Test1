import { describe, expect, it } from "vitest";
import { calculateCellsNeeded, calculateVolumeToTake } from "../client/src/lib/cellCalculations";

describe("cell calculation units", () => {
  it("treats cell as a total independent of wells or flasks", () => {
    expect(calculateCellsNeeded(750_000, "cell", 100, 0, "µL")).toBe(750_000);
    expect(calculateVolumeToTake(250_000, 1_000_000, "cell", 10, "mL", 0)).toBe(2.5);
  });

  it("converts density and volume units correctly", () => {
    expect(calculateCellsNeeded(100_000, "cell/mL", 2, 500, "µL")).toBe(100_000);
    expect(calculateVolumeToTake(200_000, 50_000, "cell/mL", 10, "mL", 0)).toBe(4);
    expect(calculateVolumeToTake(200_000, 50_000, "cell/mL", 0.01, "L", 0)).toBe(0.004);
  });

  it("multiplies per-well and per-flask quantities by the specified number of units", () => {
    expect(calculateCellsNeeded(10_000, "cell/giếng", 12, 0, "mL")).toBe(120_000);
    expect(calculateCellsNeeded(50_000, "cell/flask", 3, 0, "mL")).toBe(150_000);
    expect(calculateVolumeToTake(50_000, 25_000, "cell/giếng", 2, "mL", 4)).toBe(1);
  });

  it("rejects missing unit counts, zero totals and requests greater than available cells", () => {
    expect(calculateVolumeToTake(10, 100, "cell/flask", 1, "mL", 0)).toBeNull();
    expect(calculateVolumeToTake(101, 100, "cell", 1, "mL", 0)).toBeNull();
    expect(calculateVolumeToTake(10, 0, "cell", 1, "mL", 0)).toBeNull();
  });
});
