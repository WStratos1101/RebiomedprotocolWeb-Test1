import { useMemo, useState } from "react";
import { Info, Layers3, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseLocaleNumber } from "@/lib/numberInput";
import { calculateNycodenzOneLayer, calculateNycodenzTwoLayers } from "@/lib/nycodenzMath";

const format = (value: number | null) => value === null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(value);
const read = (value: string) => {
  const parsed = parseLocaleNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

type LayerMode = "one" | "two";
type ConcentrationUnit = "%" | "g/mL";

const convertConcentration = (value: string, from: ConcentrationUnit, to: ConcentrationUnit) => {
  if (from === to || !value.trim()) return value;
  const parsed = read(value);
  if (parsed === null) return value;
  const converted = from === "%" ? parsed / 100 : parsed * 100;
  return String(Number(converted.toPrecision(8))).replace(".", ",");
};

export function NycodenzCalculator() {
  const [mode, setMode] = useState<LayerMode>("one");
  const [concentrationUnit, setConcentrationUnit] = useState<ConcentrationUnit>("%");
  const [stockPercent, setStockPercent] = useState("80");
  const [targetPercent1, setTargetPercent1] = useState("9.6");
  const [targetPercent2, setTargetPercent2] = useState("4.8");
  const [totalVolume, setTotalVolume] = useState("12");
  const [layer1TotalVolume, setLayer1TotalVolume] = useState("8");
  const [layer2TotalVolume, setLayer2TotalVolume] = useState("4");
  const [availableVolume, setAvailableVolume] = useState("5");

  const result = useMemo(() => {
    const stock = read(stockPercent);
    const target1 = read(targetPercent1);
    const target2 = read(targetPercent2);
    const total = read(totalVolume);
    const layer1Total = read(layer1TotalVolume);
    const layer2Total = read(layer2TotalVolume);
    const available = read(availableVolume);
    if (stock === null || target1 === null || total === null || available === null || stock <= 0 || target1 < 0 || total <= 0 || available < 0 || available > total) return null;
    if (mode === "one") return { mode, ...calculateNycodenzOneLayer({ stockPercent: stock, targetPercent: target1, totalVolume: total, availableVolume: available }) };
    if (target2 === null || target2 < 0 || layer1Total === null || layer2Total === null || layer1Total <= 0 || layer2Total <= 0 || Math.abs(layer1Total + layer2Total - total) > 0.000001 || available > layer1Total) return null;
    return { mode, ...calculateNycodenzTwoLayers({ stockPercent: stock, targetPercent1: target1, targetPercent2: target2, totalVolume: total, layer1TotalVolume: layer1Total, layer2TotalVolume: layer2Total, availableVolume: available }) };
  }, [mode, stockPercent, targetPercent1, targetPercent2, totalVolume, layer1TotalVolume, layer2TotalVolume, availableVolume]);

  const reset = () => { setMode("one"); setConcentrationUnit("%"); setStockPercent("80"); setTargetPercent1("9.6"); setTargetPercent2("4.8"); setTotalVolume("12"); setLayer1TotalVolume("8"); setLayer2TotalVolume("4"); setAvailableVolume("5"); };
  const changeConcentrationUnit = (next: ConcentrationUnit) => {
    if (next === concentrationUnit) return;
    setStockPercent(current => convertConcentration(current, concentrationUnit, next));
    setTargetPercent1(current => convertConcentration(current, concentrationUnit, next));
    setTargetPercent2(current => convertConcentration(current, concentrationUnit, next));
    setConcentrationUnit(next);
  };
  const twoLayerTotalsMismatch = mode === "two" && (() => {
    const total = read(totalVolume);
    const layer1 = read(layer1TotalVolume);
    const layer2 = read(layer2TotalVolume);
    return total !== null && layer1 !== null && layer2 !== null && Math.abs(layer1 + layer2 - total) > 0.000001;
  })();
  const field = (label: string, value: string, setter: (value: string) => void, help: string, unit = "mL") => <label className="field-label">{label}{help && <span>{help}</span>}<div><Input value={value} onChange={event => setter(event.target.value)} inputMode="decimal" /><b>{unit}</b></div></label>;

  return <section className="content-panel nycodenz-calculator">
    <div className="panel-heading"><div><span className="panel-index">PROTOCOL-ONLY TOOL / NYCODENZ</span><h2>Tính pha Nycodenz</h2><p>Tool này chỉ được sử dụng từ bước quy trình có liên kết, không xuất hiện trong bảng Công cụ tính tổng hợp.</p></div><Layers3 size={22} /></div>
    <div className="result-toggle"><span>Số phân lớp</span><button type="button" className={mode === "one" ? "active" : ""} onClick={() => { setMode("one"); setTotalVolume("12"); }}>1 phân lớp</button><button type="button" className={mode === "two" ? "active" : ""} onClick={() => { setMode("two"); setTotalVolume("12"); setLayer1TotalVolume("8"); setLayer2TotalVolume("4"); }}>2 phân lớp</button></div>
    <div className="result-toggle"><span>Đơn vị nồng độ</span><button type="button" className={concentrationUnit === "%" ? "active" : ""} onClick={() => changeConcentrationUnit("%")}>%</button><button type="button" className={concentrationUnit === "g/mL" ? "active" : ""} onClick={() => changeConcentrationUnit("g/mL")}>g/mL</button></div>
    <div className="nycodenz-grid">
      {field("Nồng độ Nycodenz ban đầu", stockPercent, setStockPercent, "", concentrationUnit)}
      {field(mode === "two" ? "Nồng độ Nycodenz 1" : "Nồng độ Nycodenz sử dụng", targetPercent1, setTargetPercent1, "", concentrationUnit)}
      {mode === "two" && field("Nồng độ Nycodenz 2", targetPercent2, setTargetPercent2, "", concentrationUnit)}
      {field("Dung tích tổng", totalVolume, setTotalVolume, "")}
      {mode === "two" && field("Tổng dung tích Nycodenz 1", layer1TotalVolume, setLayer1TotalVolume, "")}
      {mode === "two" && field("Tổng dung tích Nycodenz 2", layer2TotalVolume, setLayer2TotalVolume, "")}
      {field("Dung tích có sẵn", availableVolume, setAvailableVolume, "")}
    </div>
    {result ? <div className="nycodenz-results">
      {result.mode === "one" ? <><div><small>NYCODENZ CẦN THÊM</small><strong>{format(result.nycodenzVolume)} mL</strong></div><div><small>GBSSB CẦN THÊM</small><strong>{format(result.gbssbVolume)} mL</strong></div><div><small>DUNG TÍCH SAU KHI THÊM</small><strong>{format(result.totalVolume)} mL</strong></div></> : <><div><small>LỚP 1 · NYCODENZ</small><strong>{format(result.layer1.nycodenzVolume)} mL</strong><span>GBSSB: {format(result.layer1.gbssbVolume)} mL · tổng lớp: {format(result.layer1.totalVolume)} mL</span></div><div><small>LỚP 2 · NYCODENZ</small><strong>{format(result.layer2.nycodenzVolume)} mL</strong><span>GBSSB: {format(result.layer2.gbssbVolume)} mL · tổng lớp: {format(result.layer2.totalVolume)} mL</span></div><div><small>PHÂN BỐ</small><strong>{format(result.availableVolume)} mL có sẵn</strong><span>Lớp 1 được thêm trước; lớp 2 dùng tổng 4 mL theo quy trình.</span></div></>}
    </div> : <div className="chemical-warning"><Info size={15} /> {twoLayerTotalsMismatch ? "Tổng dung tích Nycodenz 1 và 2 phải bằng dung tích tổng." : "Nhập các nồng độ và dung tích hợp lệ để xem kết quả."}</div>}
    <div className="editor-footer"><span>Nồng độ: {concentrationUnit} · Dung tích: mL</span><Button variant="outline" onClick={reset}><RotateCcw size={14} /> Đặt lại</Button></div>
  </section>;
}
