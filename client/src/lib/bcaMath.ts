export type BcaWorkingSolutionInput = {
  sampleWells: number;
  blankWells: number;
  volumePerWell: number;
};

export type BcaWorkingSolutionResult = {
  totalWells: number;
  reagentAVolume: number;
  reagentBVolume: number;
};

export function calculateBcaWorkingSolution(input: BcaWorkingSolutionInput): BcaWorkingSolutionResult | null {
  const { sampleWells, blankWells, volumePerWell } = input;
  if (!Number.isFinite(sampleWells) || !Number.isFinite(blankWells) || !Number.isFinite(volumePerWell)) return null;
  if (sampleWells < 0 || blankWells < 0 || volumePerWell <= 0) return null;
  const totalWells = sampleWells + blankWells;
  if (totalWells <= 0) return null;
  return {
    totalWells,
    reagentAVolume: volumePerWell * totalWells,
    reagentBVolume: (volumePerWell / 50) * totalWells,
  };
}
