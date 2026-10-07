import { describe, expect, it } from "vitest";
import { calculateBcaWorkingSolution } from "../client/src/lib/bcaMath";

describe("BCA working solution math", () => {
  it("calculates Reagent A and B from sample plus blank wells", () => {
    expect(calculateBcaWorkingSolution({ sampleWells: 20, blankWells: 4, volumePerWell: 200 })).toEqual({
      totalWells: 24,
      reagentAVolume: 4800,
      reagentBVolume: 96,
    });
  });

  it("uses the requested ratio and rejects invalid inputs", () => {
    expect(calculateBcaWorkingSolution({ sampleWells: 0, blankWells: 2, volumePerWell: 250 })).toEqual({
      totalWells: 2,
      reagentAVolume: 500,
      reagentBVolume: 10,
    });
    expect(calculateBcaWorkingSolution({ sampleWells: 0, blankWells: 0, volumePerWell: 200 })).toBeNull();
    expect(calculateBcaWorkingSolution({ sampleWells: 2, blankWells: 1, volumePerWell: 0 })).toBeNull();
  });
});
