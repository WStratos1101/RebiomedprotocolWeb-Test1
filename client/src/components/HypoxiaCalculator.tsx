import { useMemo, useState } from "react";
import { estimateHeadspaceOxygen, type OxygenDish } from "@/lib/hypoxiaMath";
import { parseLocaleNumber } from "@/lib/numberInput";
import "./hypoxia.css";

type NumericInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  min?: string;
  step?: string;
  hint?: string;
};

function NumericInput({ label, value, onChange, unit, min = "0", step = "any", hint }: NumericInputProps) {
  return <label className="hypoxia-field"><span>{label}</span><div className="hypoxia-input"><input type="text" inputMode="decimal" value={value} min={min} step={step} onChange={event => onChange(event.target.value)} /><b>{unit}</b></div>{hint && <small>{hint}</small>}</label>;
}

const scientific = (number: number) => number.toExponential(2).replace("e+", " × 10^").replace("e-", " × 10^−");
const OCR_SOURCE = "https://www.mdpi.com/2073-4409/9/11/2456";

export function HypoxiaCalculator() {
  const [volumeMode, setVolumeMode] = useState<"direct" | "dimensions">("direct");
  const [headspace, setHeadspace] = useState("1");
  const [length, setLength] = useState("10");
  const [width, setWidth] = useState("10");
  const [height, setHeight] = useState("10");
  const [displaced, setDisplaced] = useState("0");
  const [pressure, setPressure] = useState("1");
  const [ambient, setAmbient] = useState("1");
  const [pressureUnit, setPressureUnit] = useState<"atm" | "kPa">("atm");
  const [pressureKind, setPressureKind] = useState<"absolute" | "gauge">("absolute");
  const [temperature, setTemperature] = useState("37");
  const [oxygen, setOxygen] = useState("19");
  const [minimumOxygen, setMinimumOxygen] = useState("1");
  const [cultures, setCultures] = useState([{ id: 1, label: "HSC sơ cấp (tham khảo)", dishes: "3", cellsPerDish: "100000", ocr: "3.8e8" }]);

  const estimate = useMemo(() => {
    if ([pressure, temperature, oxygen, minimumOxygen].some(value => !value.trim()) ||
      (pressureKind === "gauge" && !ambient.trim()) ||
      (volumeMode === "direct" && !headspace.trim()) ||
      (volumeMode === "dimensions" && [length, width, height].some(value => !value.trim()))) return null;
    return estimateHeadspaceOxygen({
    volume: volumeMode === "direct"
      ? { mode: "direct", headspaceLiters: parseLocaleNumber(headspace) }
      : { mode: "dimensions", lengthCm: parseLocaleNumber(length), widthCm: parseLocaleNumber(width), heightCm: parseLocaleNumber(height), displacedLiters: parseLocaleNumber(displaced) },
    pressure: parseLocaleNumber(pressure),
    pressureUnit,
    pressureKind,
    ambientPressure: parseLocaleNumber(ambient),
    temperatureC: parseLocaleNumber(temperature),
    oxygenPercent: parseLocaleNumber(oxygen),
    minimumOxygenPercent: parseLocaleNumber(minimumOxygen),
    cultures: cultures.map(({ label, dishes, cellsPerDish, ocr }): OxygenDish => ({
      label, dishes: parseLocaleNumber(dishes), cellsPerDish: parseLocaleNumber(cellsPerDish), ocrMoleculesPerCellMinute: parseLocaleNumber(ocr),
    })),
    });
  }, [volumeMode, headspace, length, width, height, displaced, pressure, pressureUnit, pressureKind, ambient, temperature, oxygen, minimumOxygen, cultures]);

  const setCulture = (id: number, key: "label" | "dishes" | "cellsPerDish" | "ocr", value: string) =>
    setCultures(current => current.map(culture => culture.id === id ? { ...culture, [key]: value } : culture));

  return <section className="hypoxia-tool" aria-label="Ước tính O₂ pha khí trong hệ nuôi Hypoxia">
    <div className="hypoxia-heading"><span className="panel-index">HYPOXIA / HEADSPACE MODEL</span><h2>Ước tính O₂ pha khí</h2><p>Mô hình khí lý tưởng cho hệ kín: O₂ rời pha khí, không có khí khác thay thế, thể tích và nhiệt độ không đổi. Đây <strong>không phải thời gian bơm khí được khuyến nghị</strong>: O₂ tại lớp tế bào có thể giảm sớm hơn nhiều.</p></div>
    <div className="hypoxia-grid">
      <section className="content-panel hypoxia-panel"><h3>01 · Thể tích pha khí</h3><div className="hypoxia-switch"><button type="button" className={volumeMode === "direct" ? "active" : ""} onClick={() => setVolumeMode("direct")}>Nhập headspace</button><button type="button" className={volumeMode === "dimensions" ? "active" : ""} onClick={() => setVolumeMode("dimensions")}>Dài × rộng × cao</button></div>
        {volumeMode === "direct" ? <NumericInput label="Thể tích khí thực" value={headspace} onChange={setHeadspace} unit="L" hint="Không gồm môi trường lỏng, đĩa và vật chiếm chỗ." /> : <div className="hypoxia-fields"><NumericInput label="Dài" value={length} onChange={setLength} unit="cm" /><NumericInput label="Rộng" value={width} onChange={setWidth} unit="cm" /><NumericInput label="Cao" value={height} onChange={setHeight} unit="cm" /><NumericInput label="Thể tích vật/lỏng chiếm chỗ" value={displaced} onChange={setDisplaced} unit="L" min="0" /></div>}
      </section>
      <section className="content-panel hypoxia-panel"><h3>02 · Trạng thái khí</h3><div className="hypoxia-fields"><NumericInput label="Áp suất đo" value={pressure} onChange={setPressure} unit={pressureUnit} min={pressureKind === "gauge" ? "-1000" : "0"} /><label className="hypoxia-field"><span>Kiểu áp suất</span><select value={pressureKind} onChange={event => { const next = event.target.value as "absolute" | "gauge"; if (next !== pressureKind) { setPressure(value => String(parseLocaleNumber(value) + (next === "gauge" ? -parseLocaleNumber(ambient) : parseLocaleNumber(ambient)))); setPressureKind(next); } }}><option value="absolute">Tuyệt đối</option><option value="gauge">Gauge (tương đối)</option></select></label><label className="hypoxia-field"><span>Đơn vị áp suất</span><select value={pressureUnit} onChange={event => { const next = event.target.value as "atm" | "kPa"; if (next !== pressureUnit) { setPressure(value => String(parseLocaleNumber(value) * (next === "kPa" ? 101.325 : 1 / 101.325))); setAmbient(value => String(parseLocaleNumber(value) * (next === "kPa" ? 101.325 : 1 / 101.325))); setPressureUnit(next); } }}><option value="atm">atm</option><option value="kPa">kPa</option></select></label>{pressureKind === "gauge" && <NumericInput label="Áp suất môi trường" value={ambient} onChange={setAmbient} unit={pressureUnit} hint="P tuyệt đối = P gauge + P môi trường." />}<NumericInput label="Nhiệt độ" value={temperature} onChange={setTemperature} unit="°C" min="-273.14" /><NumericInput label="O₂ ban đầu" value={oxygen} onChange={setOxygen} unit="%" /><NumericInput label="Ngưỡng O₂ pha khí" value={minimumOxygen} onChange={setMinimumOxygen} unit="%" min="0" hint="Ngưỡng để ước tính, không phải pO₂ ở tế bào." /></div></section>
    </div>
    <section className="content-panel hypoxia-panel"><div className="hypoxia-row"><div><h3>03 · Tiêu thụ O₂ của tế bào</h3><p>Thêm nhóm khi số đĩa, tế bào/đĩa hoặc OCR khác nhau; nhu cầu được cộng toàn hệ.</p></div><button type="button" className="hypoxia-add" onClick={() => setCultures(current => [...current, { id: Date.now() + Math.random(), label: `Nhóm ${current.length + 1}`, dishes: "1", cellsPerDish: "100000", ocr: "3.8e8" }])}>+ Thêm nhóm đĩa</button></div>
      {cultures.map((culture, index) => <div className="hypoxia-culture" key={culture.id}><div className="hypoxia-row"><strong>Nhóm {index + 1}</strong>{cultures.length > 1 && <button type="button" className="hypoxia-remove" onClick={() => setCultures(current => current.filter(item => item.id !== culture.id))}>Xóa nhóm</button>}</div><div className="hypoxia-fields"><label className="hypoxia-field"><span>Loại tế bào / ghi chú</span><input value={culture.label} onChange={event => setCulture(culture.id, "label", event.target.value)} /></label><NumericInput label="Số đĩa" value={culture.dishes} onChange={value => setCulture(culture.id, "dishes", value)} unit="đĩa" step="1" /><NumericInput label="Tế bào / đĩa" value={culture.cellsPerDish} onChange={value => setCulture(culture.id, "cellsPerDish", value)} unit="cell" step="1" /><NumericInput label="OCR / tế bào / phút" value={culture.ocr} onChange={value => setCulture(culture.id, "ocr", value)} unit="phân tử" hint="Ưu tiên OCR đo trên chính tế bào nuôi." /></div><label className="hypoxia-field hypoxia-preset"><span>Mốc OCR để tham khảo (có thể sửa trực tiếp)</span><select value="" onChange={event => { if (event.target.value) setCulture(culture.id, "ocr", event.target.value); }}><option value="">Chọn mốc tham khảo…</option><option value="3.8e8">HSC sơ cấp yên lặng: ≈3,80×10⁸</option><option value="1.84e9">HSC hoạt hóa: ≈1,84×10⁹</option><option value="9.03e9">9,03×10⁹ — giả định người dùng, chưa kiểm chứng</option></select></label></div>)}
    </section>
    <section className="content-panel hypoxia-panel hypoxia-result" aria-live="polite"><span className="panel-index">IDEAL-GAS ESTIMATE / NOT A GAS-CHANGE SCHEDULE</span>{estimate ? <><div className="hypoxia-metrics"><div><span>Headspace · P tuyệt đối</span><strong>{estimate.headspaceLiters.toLocaleString("vi-VN", { maximumFractionDigits: 3 })} L · {estimate.absolutePressureAtm.toLocaleString("vi-VN", { maximumFractionDigits: 3 })} atm</strong></div><div><span>O₂ pha khí ban đầu</span><strong>{scientific(estimate.initialMolecules)} phân tử</strong></div><div><span>Tiêu thụ toàn hệ / 24 giờ</span><strong>{scientific(estimate.consumptionPerDay)} phân tử</strong></div><div><span>Nhu cầu O₂/24h so với O₂ ban đầu</span><strong>{estimate.percentUsedPerDay.toLocaleString("vi-VN", { maximumFractionDigits: 3 })}%</strong></div></div><div className="hypoxia-time"><small>ƯỚC TÍNH ĐẾN NGƯỠNG O₂ PHA KHÍ</small><strong>{estimate.hoursToGasThreshold.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giờ <span>≈ {estimate.daysToGasThreshold.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ngày</span></strong><p>Con số pha khí có thể rất lớn dù lớp tế bào đã thiếu O₂; tuyệt đối không đặt lịch thay/bơm khí theo giá trị này.</p></div></> : <p>Nhập thể tích khí và các thông số hợp lệ; 0 &lt; O₂ ban đầu &lt; 100%, ngưỡng nhỏ hơn O₂ ban đầu.</p>}</section>
    <div className="hypoxia-warning"><strong>Không dùng kết quả để quyết định thời điểm bơm khí nếu chưa đo O₂ thực tế.</strong> Mô hình chỉ chia lượng O₂ pha khí trên ngưỡng cho OCR giả định không đổi; chưa tính oxy hòa tan, độ sâu môi trường, diện tích bề mặt, khuếch tán/khuấy trộn, hơi nước, tăng sinh tế bào, CO₂ thay thế O₂ trong pha khí/tích tụ CO₂, biến đổi pH và đáp ứng OCR với hypoxia. O₂ tại lớp tế bào có thể cạn dù headspace còn nhiều; thiếu O₂ có thể gây chết tế bào hoặc biến đổi đặc tính và sai lệch kết luận. Đo pO₂/O₂ hòa tan gần tế bào, hiệu chuẩn OCR trên loại tế bào đang dùng và đặt lịch giám sát độc lập.</div>
    <div className="hypoxia-sources"><span>Tham khảo:</span> <a href={OCR_SOURCE} target="_blank" rel="noreferrer">OCR HSC yên lặng vs hoạt hóa (Smith-Cortinez et al., 2020)</a> · <a href="https://link.springer.com/article/10.1038/s44318-024-00084-7" target="_blank" rel="noreferrer">Giới hạn khuếch tán oxy (Tan et al., 2024)</a> · <a href="https://www.frontiersin.org/journals/endocrinology/articles/10.3389/fendo.2020.00057/full" target="_blank" rel="noreferrer">Hypoxia và O₂ quanh tế bào (Pavlacky & Polak, 2020)</a>. Giá trị tham khảo suy từ 63,1 và 305,9 pmol O₂/phút/10⁵ HSC chuột; không đại diện cho mọi tế bào hoặc điều kiện.</div>
  </section>;
}
