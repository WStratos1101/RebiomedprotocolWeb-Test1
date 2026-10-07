export type IccMixRow = { name: string; volume: number; note?: string };

const positive = (value: number) => Number.isFinite(value) && value > 0;

export function calculateIccPrimary(totalVolume: number, dilutionRatio: number): IccMixRow[] | null {
  if (!positive(totalVolume) || !positive(dilutionRatio)) return null;
  const stock = totalVolume / dilutionRatio;
  return [
    { name: "Kháng thể sơ cấp stock", volume: stock, note: `Pha theo tỉ lệ 1:${dilutionRatio}` },
    { name: "BSA 1% + PBS", volume: totalVolume - stock, note: "Bổ sung đến đủ V tổng" },
  ];
}

export function calculateIccSecondary(totalVolume: number, dilutionRatio = 500): IccMixRow[] | null {
  if (!positive(totalVolume) || !positive(dilutionRatio)) return null;
  const stock = totalVolume / dilutionRatio;
  return [
    { name: "Alexa 488", volume: stock, note: `Pha theo tỉ lệ 1:${dilutionRatio}` },
    { name: "PBS", volume: totalVolume - stock, note: "Bổ sung đến đủ V tổng" },
  ];
}

export function calculateIccPermeabilization(totalVolume: number, finalPercent: number, reagentName: string): IccMixRow[] | null {
  if (!positive(totalVolume) || !positive(finalPercent)) return null;
  const reagent = totalVolume * finalPercent / 100;
  return [
    { name: reagentName, volume: reagent, note: `Nồng độ cuối ${String(finalPercent).replace(".", ",")}% (v/v)` },
    { name: "PBS", volume: totalVolume - reagent, note: "Bổ sung đến đủ V tổng" },
  ];
}

export function calculateIccBlocking(totalVolume: number): IccMixRow[] | null {
  if (!positive(totalVolume)) return null;
  const serum = totalVolume * 0.04;
  const bsa = totalVolume * 0.01;
  return [
    { name: "Goat serum", volume: serum, note: "Nồng độ cuối 4%" },
    { name: "BSA", volume: bsa, note: "Nồng độ cuối 1%" },
    { name: "PBS", volume: totalVolume - serum - bsa, note: "Bổ sung đến đủ V tổng" },
  ];
}

export function calculateIccDapi(totalVolume: number): IccMixRow[] | null {
  if (!positive(totalVolume)) return null;
  const dapi = totalVolume / 6;
  return [
    { name: "DAPI", volume: dapi, note: "1 phần" },
    { name: "PBS", volume: totalVolume - dapi, note: "5 phần" },
  ];
}
