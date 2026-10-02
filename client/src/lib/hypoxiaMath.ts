export const AVOGADRO = 6.02214076e23;
const GAS_CONSTANT_L_ATM_PER_MOL_K = 0.082057366080960;

export type GasVolume =
  | { mode: "direct"; headspaceLiters: number }
  | { mode: "dimensions"; lengthCm: number; widthCm: number; heightCm: number; displacedLiters: number };

export type OxygenDish = {
  label: string;
  dishes: number;
  cellsPerDish: number;
  ocrMoleculesPerCellMinute: number;
};

export type HypoxiaInput = {
  volume: GasVolume;
  pressure: number;
  pressureUnit: "atm" | "kPa";
  pressureKind: "absolute" | "gauge";
  ambientPressure: number;
  temperatureC: number;
  oxygenPercent: number;
  minimumOxygenPercent: number;
  cultures: OxygenDish[];
};

export type HypoxiaEstimate = {
  headspaceLiters: number;
  absolutePressureAtm: number;
  initialMolecules: number;
  usableMolecules: number;
  consumptionPerMinute: number;
  consumptionPerDay: number;
  daysToGasThreshold: number;
  hoursToGasThreshold: number;
  percentUsedPerDay: number;
};

/** Sealed rigid headspace, O₂ removed without gas-phase replacement, constant T/OCR.
 *  This is a scenario estimate, not a model of CO₂ production or cell-layer pO₂.
 */
export function estimateHeadspaceOxygen(input: HypoxiaInput): HypoxiaEstimate | null {
  const validPositive = (value: number) => Number.isFinite(value) && value > 0;
  const validNonNegative = (value: number) => Number.isFinite(value) && value >= 0;
  const volume = input.volume.mode === "direct"
    ? input.volume.headspaceLiters
    : input.volume.lengthCm * input.volume.widthCm * input.volume.heightCm / 1000 - input.volume.displacedLiters;
  if (input.volume.mode === "dimensions" &&
    (![input.volume.lengthCm, input.volume.widthCm, input.volume.heightCm].every(validPositive) ||
      !validNonNegative(input.volume.displacedLiters))) return null;
  if (!validPositive(volume) || !Number.isFinite(input.temperatureC) || input.temperatureC <= -273.15) return null;
  if ((input.pressureKind === "absolute" && !validPositive(input.pressure)) ||
    (input.pressureKind === "gauge" && (!Number.isFinite(input.pressure) || !validPositive(input.ambientPressure)))) return null;
  if (!validPositive(input.oxygenPercent) || input.oxygenPercent >= 100 ||
    !validNonNegative(input.minimumOxygenPercent) || input.minimumOxygenPercent >= input.oxygenPercent) return null;
  if (!input.cultures.length || input.cultures.some(culture =>
    !Number.isInteger(culture.dishes) || !validPositive(culture.dishes) ||
    !Number.isInteger(culture.cellsPerDish) || !validPositive(culture.cellsPerDish) ||
    !validPositive(culture.ocrMoleculesPerCellMinute))) return null;

  const toAtm = (value: number) => input.pressureUnit === "kPa" ? value / 101.325 : value;
  const absolutePressureAtm = toAtm(input.pressure) + (input.pressureKind === "gauge" ? toAtm(input.ambientPressure) : 0);
  if (!validPositive(absolutePressureAtm)) return null;
  const totalGasMolecules = absolutePressureAtm * volume / (GAS_CONSTANT_L_ATM_PER_MOL_K * (input.temperatureC + 273.15)) * AVOGADRO;
  const initialFraction = input.oxygenPercent / 100;
  const thresholdFraction = input.minimumOxygenPercent / 100;
  const initialMolecules = totalGasMolecules * initialFraction;
  // x_threshold = (nO2_initial − nO2_used) / (nTotal_initial − nO2_used)
  const usableMolecules = totalGasMolecules * (initialFraction - thresholdFraction) / (1 - thresholdFraction);
  const consumptionPerMinute = input.cultures.reduce((sum, culture) =>
    sum + culture.dishes * culture.cellsPerDish * culture.ocrMoleculesPerCellMinute, 0);
  if (![initialMolecules, usableMolecules, consumptionPerMinute].every(validPositive)) return null;
  const consumptionPerDay = consumptionPerMinute * 1440;
  const hoursToGasThreshold = usableMolecules / consumptionPerMinute / 60;
  if (![consumptionPerDay, hoursToGasThreshold].every(Number.isFinite)) return null;
  return {
    headspaceLiters: volume,
    absolutePressureAtm,
    initialMolecules,
    usableMolecules,
    consumptionPerMinute,
    consumptionPerDay,
    hoursToGasThreshold,
    daysToGasThreshold: hoursToGasThreshold / 24,
    percentUsedPerDay: 100 * consumptionPerDay / initialMolecules,
  };
}
