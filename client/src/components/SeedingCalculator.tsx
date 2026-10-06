import { useMemo, useState } from "react";
import { calculateManualCellCount } from "@/lib/cellCalculations";
import { parseLocaleNumber } from "@/lib/numberInput";

const vessels = { "giếng 96": 100, "giếng 48": 250, "giếng 6": 1200, "flask T25": 2500 } as const;
type Vessel = keyof typeof vessels;

export function SeedingCalculator() {
  const [targetPerUnit, setTargetPerUnit] = useState("100000");
  const [unitCount, setUnitCount] = useState("1");
  const [countedCells, setCountedCells] = useState("");
  const [countedSquares, setCountedSquares] = useState("4");
  const [solutionVolume, setSolutionVolume] = useState("1");
  const [dilutionFactor, setDilutionFactor] = useState("1.5");
  const [vessel, setVessel] = useState<Vessel>("giếng 96");
  const values = [targetPerUnit, unitCount, countedCells, countedSquares, solutionVolume, dilutionFactor].map(parseLocaleNumber);
  const result = useMemo(() => {
    const [target, count, counted, squares, volume, factor] = values;
    const concentration = calculateManualCellCount(counted, squares, factor, volume);
    if (!concentration || !Number.isFinite(target) || target <= 0 || !Number.isFinite(count) || count <= 0) return null;
    const totalMediumMl = count * vessels[vessel] / 1000;
    const cellsRequired = target * count;
    const cellSuspensionMl = cellsRequired / concentration;
    return { concentration, cellsRequired, totalMediumMl, cellSuspensionMl, addedMediumMl: Math.max(0, totalMediumMl - cellSuspensionMl) };
  }, [targetPerUnit, unitCount, countedCells, countedSquares, solutionVolume, dilutionFactor, vessel]);
  const field = (label: string, value: string, setValue: (value: string) => void, unit?: string, placeholder?: string) => <label className="field-label">{label}<span className="seeding-input"><input value={value} onChange={event => setValue(event.target.value)} inputMode="decimal" placeholder={placeholder} />{unit && <b>{unit}</b>}</span></label>;
  return <section className="content-panel seeding-calculator"><div className="panel-index">CELL GROUP / SEEDING</div><h2>Seeding</h2><p>Nhập số tế bào mục tiêu, số đơn vị nuôi và số tế bào đếm được để tính môi trường cần chuẩn bị.</p><div className="seeding-grid">{field("Số tế bào mong muốn / giếng hoặc flask", targetPerUnit, setTargetPerUnit, "cell", "Ví dụ: 100000")}{field("Tổng số giếng / flask", unitCount, setUnitCount, "đơn vị", "Ví dụ: 6")}{field("Tổng số tế bào đếm được", countedCells, setCountedCells, "cell", "Nhập kết quả buồng đếm")}{field("Tổng số ô đã đếm", countedSquares, setCountedSquares, "ô", "Mặc định 4")}{field("Thể tích hiện có", solutionVolume, setSolutionVolume, "mL", "Mặc định 1")}{field("Hệ số pha loãng", dilutionFactor, setDilutionFactor, "×", "Mặc định 1,5")}<label className="field-label">Phân loại giếng / flask<select value={vessel} onChange={event => setVessel(event.target.value as Vessel)}>{Object.entries(vessels).map(([name, volume]) => <option key={name} value={name}>{name} · {volume} µL / đơn vị</option>)}</select></label></div><div className="seeding-result">{result ? <><div><small>NỒNG ĐỘ TẾ BÀO</small><strong>{result.concentration.toLocaleString("vi-VN", { maximumSignificantDigits: 8 })} cell/mL</strong></div><div><small>TỔNG MÔI TRƯỜNG</small><strong>{result.totalMediumMl.toLocaleString("vi-VN", { maximumFractionDigits: 4 })} mL</strong></div><div><small>MÔI TRƯỜNG CÓ TẾ BÀO CẦN LẤY</small><strong>{result.cellSuspensionMl.toLocaleString("vi-VN", { maximumFractionDigits: 4 })} mL</strong></div><div><small>MÔI TRƯỜNG NUÔI CẤY CẦN THÊM</small><strong>{result.addedMediumMl.toLocaleString("vi-VN", { maximumFractionDigits: 4 })} mL</strong></div></> : <p>Nhập đủ các số liệu để xem kết quả.</p>}</div></section>;
}
