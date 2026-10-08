import { useMemo, useState } from "react";
import { calculateManualCellCount } from "@/lib/cellCalculations";
import { parseLocaleNumber } from "@/lib/numberInput";

const vessels = {
  "giếng 6": { area: 9.5, minMl: 1, maxMl: 3, defaultMl: 2, label: "Giếng 6-well" },
  "giếng 12": { area: 3.6, minMl: 0.75, maxMl: 1.15, defaultMl: 1, label: "Giếng 12-well" },
  "giếng 24": { area: 1.9, minMl: 0.3, maxMl: 0.6, defaultMl: 0.5, label: "Giếng 24-well" },
  "giếng 48": { area: 1.0, minMl: 0.2, maxMl: 0.5, defaultMl: 0.3, label: "Giếng 48-well" },
  "giếng 96": { area: 0.32, minMl: 0.1, maxMl: 0.2, defaultMl: 0.15, label: "Giếng 96-well" },
  "flask T25": { area: 25, minMl: 3, maxMl: 7, defaultMl: 5, label: "Flask T25" },
} as const;
type Vessel = keyof typeof vessels;
type ResultVolumeUnit = "mL" | "µL";
type DilutionMode = "factor" | "volumes";

export function SeedingCalculator() {
  const [targetPerUnit, setTargetPerUnit] = useState("100000");
  const [unitCount, setUnitCount] = useState("1");
  const [countedCells, setCountedCells] = useState("");
  const [countedSquares, setCountedSquares] = useState("4");
  const [solutionVolume, setSolutionVolume] = useState("1");
  const [mediumPerUnit, setMediumPerUnit] = useState("");
  const [dilutionFactor, setDilutionFactor] = useState("1.5");
  const [dilutionMode, setDilutionMode] = useState<DilutionMode>("factor");
  const [initialVolume, setInitialVolume] = useState("20");
  const [addedVolume, setAddedVolume] = useState("10");
  const [vessel, setVessel] = useState<Vessel>("giếng 96");
  const [resultVolumeUnit, setResultVolumeUnit] = useState<ResultVolumeUnit>("mL");
  const values = [targetPerUnit, unitCount, countedCells, countedSquares, solutionVolume, dilutionFactor, initialVolume, addedVolume].map(parseLocaleNumber);
  const result = useMemo(() => {
    const [target, count, counted, squares, volume, factor, initial, added] = values;
    const selectedVessel = vessels[vessel];
    const requestedMedium = parseLocaleNumber(mediumPerUnit);
    const mediumMl = Number.isFinite(requestedMedium) && requestedMedium > 0 ? requestedMedium : selectedVessel.defaultMl;
    if (mediumMl < selectedVessel.minMl || mediumMl > selectedVessel.maxMl) return { invalidMedium: true as const, minMl: selectedVessel.minMl, maxMl: selectedVessel.maxMl };
    const effectiveFactor = dilutionMode === "factor" ? factor : (Number.isFinite(initial) && initial > 0 && Number.isFinite(added) && added >= 0 ? (initial + added) / initial : NaN);
    const concentration = calculateManualCellCount(counted, squares, effectiveFactor, volume);
    if (!concentration || !Number.isFinite(target) || target <= 0 || !Number.isFinite(count) || count <= 0) return null;
    const totalMediumMl = count * mediumMl;
    const cellsRequired = target * count;
    const cellSuspensionMl = cellsRequired / concentration;
    return { invalidMedium: false as const, concentration, cellsRequired, totalMediumMl, cellSuspensionMl, addedMediumMl: Math.max(0, totalMediumMl - cellSuspensionMl) };
  }, [targetPerUnit, unitCount, countedCells, countedSquares, solutionVolume, dilutionFactor, initialVolume, addedVolume, dilutionMode, vessel, mediumPerUnit]);
  const displayVolume = (valueMl: number) => valueMl * (resultVolumeUnit === "µL" ? 1000 : 1);
  const formatVolume = (valueMl: number) => displayVolume(valueMl).toLocaleString("vi-VN", { maximumFractionDigits: resultVolumeUnit === "µL" ? 2 : 4 });
  const field = (label: string, value: string, setValue: (value: string) => void, unit?: string, placeholder?: string) => <label className="field-label">{label}<span className="seeding-input"><input value={value} onChange={event => setValue(event.target.value)} inputMode="decimal" placeholder={placeholder} />{unit && <b>{unit}</b>}</span></label>;
  return <section className="content-panel seeding-calculator"><div className="panel-index">CELL GROUP / SEEDING</div><h2>Seeding</h2><p>Nhập số tế bào mục tiêu, số đơn vị nuôi và số tế bào đếm được để tính môi trường cần chuẩn bị.</p><div className="seeding-grid">{field("Số tế bào mong muốn / giếng hoặc flask", targetPerUnit, setTargetPerUnit, "cell", "Ví dụ: 100000")}{field("Tổng số giếng / flask", unitCount, setUnitCount, "đơn vị", "Ví dụ: 6")}{field("Tổng số tế bào đếm được", countedCells, setCountedCells, "cell", "Nhập kết quả buồng đếm")}{field("Tổng số ô đã đếm", countedSquares, setCountedSquares, "ô", "Mặc định 4")}{field("Thể tích hiện có", solutionVolume, setSolutionVolume, "mL", "Mặc định 1")}<label className="field-label">Lượng môi trường / giếng hoặc flask<span className="seeding-input"><input value={mediumPerUnit} onChange={event => setMediumPerUnit(event.target.value)} inputMode="decimal" placeholder={`Mặc định ${vessels[vessel].defaultMl} mL`} /><b>mL</b></span><small>Cho phép {vessels[vessel].minMl}–{vessels[vessel].maxMl} mL · để trống dùng mặc định {vessels[vessel].defaultMl} mL</small></label><div className="result-toggle seeding-dilution-toggle"><span>Cách tính hệ số pha loãng</span><button type="button" className={dilutionMode === "factor" ? "active" : ""} onClick={() => setDilutionMode("factor")}>Dùng hệ số</button><button type="button" className={dilutionMode === "volumes" ? "active" : ""} onClick={() => setDilutionMode("volumes")}>Từ thể tích</button></div>{dilutionMode === "factor" ? field("Hệ số pha loãng", dilutionFactor, setDilutionFactor, "×", "Mặc định 1,5") : <>{field("Thể tích ban đầu", initialVolume, setInitialVolume, "µL", "Ví dụ: 20")}{field("Thể tích pha thêm", addedVolume, setAddedVolume, "µL", "Ví dụ: 10")}</>}<label className="field-label">Phân loại giếng / flask<select value={vessel} onChange={event => setVessel(event.target.value as Vessel)}>{Object.entries(vessels).map(([name, spec]) => <option key={name} value={name}>{spec.label} · {spec.area} cm²</option>)}</select></label><label className="field-label">Đơn vị kết quả<select value={resultVolumeUnit} onChange={event => setResultVolumeUnit(event.target.value as ResultVolumeUnit)}><option value="mL">mL</option><option value="µL">µL (ul)</option></select><small>Áp dụng cho các kết quả thể tích bên dưới</small></label></div><div className="seeding-result">{result?.invalidMedium ? <p>Thể tích môi trường phải nằm trong khoảng {result.minMl}–{result.maxMl} mL cho loại giếng/flask đã chọn.</p> : result ? <><div><small>NỒNG ĐỘ TẾ BÀO</small><strong>{result.concentration.toLocaleString("vi-VN", { maximumSignificantDigits: 8 })} cell/mL</strong></div><div><small>TỔNG MÔI TRƯỜNG</small><strong>{formatVolume(result.totalMediumMl)} {resultVolumeUnit}</strong></div><div><small>MÔI TRƯỜNG CÓ TẾ BÀO CẦN LẤY</small><strong>{formatVolume(result.cellSuspensionMl)} {resultVolumeUnit}</strong></div><div><small>MÔI TRƯỜNG NUÔI CẤY CẦN THÊM</small><strong>{formatVolume(result.addedMediumMl)} {resultVolumeUnit}</strong></div></> : <p>Nhập đủ các số liệu để xem kết quả.</p>}</div></section>;
}
