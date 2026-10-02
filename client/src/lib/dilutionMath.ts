export type VolumeUnit = "L" | "mL" | "µL";
export type ConcentrationUnit =
  | "mol/mL"
  | "mol/L"
  | "mol/µL"
  | "mg/mL"
  | "mg/µL"
  | "mg/L"
  | "g/µL"
  | "g/mL"
  | "g/L";
export type DilutionTarget = "C1" | "V1" | "C2" | "V2";

export const VOLUME_UNITS: VolumeUnit[] = ["L", "mL", "µL"];
export const CONCENTRATION_UNITS: ConcentrationUnit[] = [
  "mol/mL",
  "mol/L",
  "mol/µL",
  "mg/mL",
  "mg/µL",
  "mg/L",
  "g/µL",
  "g/mL",
  "g/L",
];

export function volumeToMl(value: number, unit: VolumeUnit) {
  return unit === "L" ? value * 1000 : unit === "µL" ? value / 1000 : value;
}

export function mlToVolume(value: number, unit: VolumeUnit) {
  return unit === "L" ? value / 1000 : unit === "µL" ? value * 1000 : value;
}

type ConcentrationFamily = "mol" | "mg" | "g";
function concentrationFamily(unit: ConcentrationUnit): ConcentrationFamily {
  return unit.split("/")[0] as ConcentrationFamily;
}

/** Convert to a family-specific amount per litre, preserving mol/mass dimensions. */
export function concentrationToBase(value: number, unit: ConcentrationUnit) {
  const denominator = unit.split("/")[1];
  const perL = denominator === "µL" ? 1_000_000 : denominator === "mL" ? 1_000 : 1;
  return value * perL;
}

export function baseToConcentration(value: number, unit: ConcentrationUnit) {
  const denominator = unit.split("/")[1];
  const perL = denominator === "µL" ? 1_000_000 : denominator === "mL" ? 1_000 : 1;
  return value / perL;
}

export type DilutionValues = {
  c1: number;
  v1: number;
  c2: number;
  v2: number;
  c1Unit: ConcentrationUnit;
  c2Unit: ConcentrationUnit;
  v1Unit: VolumeUnit;
  v2Unit: VolumeUnit;
};

/** Solve C1V1=C2V2. Cross-family molar/mass conversions are intentionally rejected without MW. */
export function calculateDilution(target: DilutionTarget, input: DilutionValues): number | null {
  const { c1, v1, c2, v2, c1Unit, c2Unit, v1Unit, v2Unit } = input;
  const c1Base = concentrationToBase(c1, c1Unit);
  const c2Base = concentrationToBase(c2, c2Unit);
  const v1Ml = volumeToMl(v1, v1Unit);
  const v2Ml = volumeToMl(v2, v2Unit);
  const known = target === "C1" ? [v1, c2, v2] : target === "V1" ? [c1, c2, v2] : target === "C2" ? [c1, v1, v2] : [c1, v1, c2];
  if (known.some(value => !Number.isFinite(value) || value <= 0)) return null;
  if (concentrationFamily(c1Unit) !== concentrationFamily(c2Unit)) return null;

  if (target === "C1") return baseToConcentration((c2Base * v2Ml) / v1Ml, c1Unit);
  if (target === "V1") return mlToVolume((c2Base * v2Ml) / c1Base, v1Unit);
  if (target === "C2") return baseToConcentration((c1Base * v1Ml) / v2Ml, c2Unit);
  return mlToVolume((c1Base * v1Ml) / c2Base, v2Unit);
}
