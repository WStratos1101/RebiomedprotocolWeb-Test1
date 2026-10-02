import { describe, expect, it } from "vitest";
import { estimateHeadspaceOxygen, type HypoxiaInput } from "../client/src/lib/hypoxiaMath";

const example: HypoxiaInput = {
  volume: { mode: "direct", headspaceLiters: 1 },
  pressure: 1,
  pressureUnit: "atm",
  pressureKind: "absolute",
  ambientPressure: 1,
  temperatureC: 37,
  oxygenPercent: 19,
  minimumOxygenPercent: 1,
  cultures: [{ label: "HSC", dishes: 3, cellsPerDish: 100_000, ocrMoleculesPerCellMinute: 3.8e8 }],
};

describe("sealed-chamber ideal-gas oxygen budget", () => {
  it("counts headspace oxygen with temperature and sums daily OCR across dishes", () => {
    const result = estimateHeadspaceOxygen(example)!;
    expect(result.initialMolecules).toBeCloseTo(4.4959e21, -17);
    expect(result.consumptionPerMinute).toBe(3 * 100_000 * 3.8e8);
    expect(result.consumptionPerDay).toBe(3 * 100_000 * 3.8e8 * 1440);
    expect(result.usableMolecules / result.consumptionPerMinute / 60).toBe(result.hoursToGasThreshold);
    expect(result.usableMolecules).toBeLessThan(result.initialMolecules);
  });
  it("normalizes gauge vs absolute pressure, including gauge zero", () => {
    const absolute = estimateHeadspaceOxygen(example)!;
    const gauge = estimateHeadspaceOxygen({ ...example, pressure: 0, pressureKind: "gauge" })!;
    expect(gauge.absolutePressureAtm).toBe(1);
    expect(gauge.initialMolecules).toBeCloseTo(absolute.initialMolecules, -10);
    const kPa = estimateHeadspaceOxygen({ ...example, pressure: 101.325, pressureUnit: "kPa" })!;
    expect(kPa.initialMolecules).toBeCloseTo(absolute.initialMolecules, -10);
  });
  it("uses changing total moles for the O₂ percentage threshold in a rigid sealed chamber", () => {
    const result = estimateHeadspaceOxygen({ ...example, minimumOxygenPercent: 10 })!;
    const totalInitially = result.initialMolecules / 0.19;
    const moleculesRemoved = result.usableMolecules;
    expect((result.initialMolecules - moleculesRemoved) / (totalInitially - moleculesRemoved)).toBeCloseTo(0.10);
    expect(moleculesRemoved).toBeCloseTo(totalInitially * (0.19 - 0.10) / (1 - 0.10), -10);
  });
  it("subtracts displaced volume and combines groups with distinct OCR", () => {
    const result = estimateHeadspaceOxygen({ ...example,
      volume: { mode: "dimensions", lengthCm: 10, widthCm: 10, heightCm: 10, displacedLiters: 0.2 },
      cultures: [...example.cultures, { label: "activated", dishes: 1, cellsPerDish: 100_000, ocrMoleculesPerCellMinute: 1.84e9 }],
    })!;
    expect(result.headspaceLiters).toBeCloseTo(0.8);
    expect(result.consumptionPerMinute).toBe(3 * 100_000 * 3.8e8 + 100_000 * 1.84e9);
    expect(result.hoursToGasThreshold).toBeLessThan(estimateHeadspaceOxygen(example)!.hoursToGasThreshold);
  });
  it("rejects impossible headspace, threshold and cell counts", () => {
    expect(estimateHeadspaceOxygen({ ...example, minimumOxygenPercent: 19 })).toBeNull();
    expect(estimateHeadspaceOxygen({ ...example, oxygenPercent: 100 })).toBeNull();
    expect(estimateHeadspaceOxygen({ ...example, volume: { mode: "direct", headspaceLiters: 0 } })).toBeNull();
    expect(estimateHeadspaceOxygen({ ...example, cultures: [{ ...example.cultures[0], cellsPerDish: 0 }] })).toBeNull();
    expect(estimateHeadspaceOxygen({ ...example, cultures: [{ ...example.cultures[0], dishes: 1.5 }] })).toBeNull();
    expect(estimateHeadspaceOxygen({ ...example, pressure: -2, pressureKind: "gauge" })).toBeNull();
  });
});
