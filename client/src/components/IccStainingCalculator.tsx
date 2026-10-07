import { useMemo, useState } from "react";
import { FlaskConical, Info, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseLocaleNumber } from "@/lib/numberInput";

type PrimaryAntibody = {
  name: string;
  icc: string;
  westernBlot: string;
  ratio: number;
  defaultTotal: number;
};

const primaryAntibodies: PrimaryAntibody[] = [
  { name: "α-SMA", icc: "1:300", westernBlot: "1:1000", ratio: 300, defaultTotal: 1500 },
  { name: "E2F1", icc: "1:500", westernBlot: "1:2000", ratio: 500, defaultTotal: 1500 },
  { name: "eEF1A1", icc: "1:500", westernBlot: "1:5000", ratio: 500, defaultTotal: 1500 },
  { name: "Collagen I", icc: "1:200", westernBlot: "1:1000", ratio: 200, defaultTotal: 1500 },
  { name: "GFAP", icc: "1:200", westernBlot: "NA", ratio: 200, defaultTotal: 1500 },
  { name: "Desmin", icc: "1:300", westernBlot: "1:1000", ratio: 300, defaultTotal: 1500 },
  { name: "Phalloidin", icc: "1:400", westernBlot: "—", ratio: 400, defaultTotal: 2000 },
  { name: "HRP", icc: "—", westernBlot: "1:10000", ratio: 10000, defaultTotal: 1500 },
  { name: "Alexa 488", icc: "1:500", westernBlot: "—", ratio: 500, defaultTotal: 1500 },
  { name: "DAPI", icc: "1:5", westernBlot: "—", ratio: 5, defaultTotal: 1500 },
];

const format = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value);
const number = (value: string) => {
  const parsed = parseLocaleNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function IccStainingCalculator() {
  const [selectedAntibody, setSelectedAntibody] = useState("α-SMA");
  const [totalVolume, setTotalVolume] = useState("1500");
  const [permeaVolume, setPermeaVolume] = useState("100");
  const selected = primaryAntibodies.find(item => item.name === selectedAntibody) ?? primaryAntibodies[0];
  const primaryMix = useMemo(() => {
    const total = number(totalVolume);
    if (!selected || total === null || total <= 0) return null;
    const stock = total / selected.ratio;
    return { total, stock, carrier: Math.max(0, total - stock) };
  }, [selected, totalVolume]);
  const reset = () => {
    setSelectedAntibody("α-SMA");
    setTotalVolume("1500");
    setPermeaVolume("100");
  };

  return <section className="icc-staining">
    <div className="content-panel cdna-hero">
      <div><span className="panel-index">CHEMISTRY WORKBENCH / ICC STAINING</span><h2>Pha hoá chất nhuộm ICC</h2><p>Bảng tỉ lệ kháng thể, pha kháng thể sơ cấp, permeabilization, Alexa, DAPI và blocking buffer theo thông tin đã cung cấp.</p></div>
      <div className="cdna-kit-badge"><FlaskConical size={20} /><span><strong>ICC staining</strong><small>Antibody · Permea · DAPI</small></span></div>
    </div>

    <section className="content-panel icc-panel">
      <div className="panel-heading"><div><span className="panel-index">ANTIBODY DILUTION</span><h3>Tỉ lệ kháng thể</h3><p>ICC và Western Blot được hiển thị cạnh nhau để tra cứu nhanh.</p></div><Button variant="outline" onClick={reset}><RotateCcw size={14} /> Đặt lại</Button></div>
      <div className="chemical-table-wrap"><table className="chemical-table icc-table"><thead><tr><th>Kháng thể</th><th>ICC staining</th><th>Western Blot</th></tr></thead><tbody>{primaryAntibodies.map(item => <tr key={item.name}><td><strong>{item.name}</strong></td><td className="chemical-amount">{item.icc}</td><td>{item.westernBlot}</td></tr>)}</tbody></table></div>
    </section>

    <section className="content-panel icc-panel">
      <div className="panel-heading"><div><span className="panel-index">1ST ANTIBODY / SOLUTION</span><h3>Pha kháng thể sơ cấp</h3><p>V1st = BSA 1% + PBS. Thay đổi thể tích tổng để tự tính thể tích kháng thể stock và dung dịch mang.</p></div></div>
      <div className="cdna-settings-grid icc-settings-grid">
        <label className="field-label cdna-green-field">Kháng thể<select value={selectedAntibody} onChange={event => { const next = primaryAntibodies.find(item => item.name === event.target.value); setSelectedAntibody(event.target.value); if (next) setTotalVolume(String(next.defaultTotal)); }}>{primaryAntibodies.map(item => <option key={item.name}>{item.name}</option>)}</select></label>
        <label className="field-label cdna-green-field">V tổng<Input value={totalVolume} onChange={event => setTotalVolume(event.target.value)} inputMode="decimal" /><small>µL</small></label>
        <div className="icc-result-card"><small>TỈ LỆ</small><strong>{selected.icc}</strong><span>{selected.name}</span></div>
        <div className="icc-result-card"><small>V KHÁNG THỂ STOCK</small><strong>{primaryMix ? format(primaryMix.stock) : "—"}</strong><span>µL</span></div>
        <div className="icc-result-card"><small>V1st · BSA 1% + PBS</small><strong>{primaryMix ? format(primaryMix.carrier) : "—"}</strong><span>µL</span></div>
      </div>
      <div className="chemical-table-wrap"><table className="chemical-table icc-table"><thead><tr><th>Thành phần</th><th>Thể tích (µL)</th><th>Ghi chú</th></tr></thead><tbody><tr><td>{selected.name}</td><td className="chemical-amount">{primaryMix ? format(primaryMix.stock) : "—"}</td><td>Tính theo V tổng / hệ số pha loãng</td></tr><tr><td>BSA 1% + PBS</td><td className="chemical-amount">{primaryMix ? format(primaryMix.carrier) : "—"}</td><td>Bổ sung đến đủ V tổng</td></tr><tr><td><strong>Tổng</strong></td><td className="chemical-amount"><strong>{primaryMix ? format(primaryMix.total) : "—"}</strong></td><td>Ủ kháng thể sơ cấp ít nhất 12 giờ ở 4°C</td></tr></tbody></table></div>
    </section>

    <div className="icc-two-column">
      <section className="content-panel icc-panel"><div className="panel-heading"><div><span className="panel-index">PERMEABILIZATION</span><h3>Permeabilization</h3></div></div><label className="field-label cdna-green-field">Thể tích cần pha<Input value={permeaVolume} onChange={event => setPermeaVolume(event.target.value)} inputMode="decimal" /><small>mL · cần xác định thể tích stock theo SOP</small></label><div className="chemical-table-wrap"><table className="chemical-table icc-table"><thead><tr><th>Lựa chọn</th><th>Nồng độ cuối</th><th>Ghi chú</th></tr></thead><tbody><tr><td>PBS Tween 20</td><td className="chemical-amount">0,2%</td><td>Cách pha 1</td></tr><tr><td>PBS Triton X-100</td><td className="chemical-amount">0,1%</td><td>Cách pha 2</td></tr></tbody></table></div><div className="chemical-warning"><Info size={15} /> Bảng gốc chưa nêu nồng độ stock; xác nhận stock trước khi pha số lượng lớn.</div></section>
      <section className="content-panel icc-panel"><div className="panel-heading"><div><span className="panel-index">BLOCKING BUFFER</span><h3>Blocking buffer</h3></div></div><div className="chemical-table-wrap"><table className="chemical-table icc-table"><thead><tr><th>Thành phần</th><th>Nồng độ</th><th>Ghi chú</th></tr></thead><tbody><tr><td>Goat serum</td><td className="chemical-amount">4%</td><td>Hạn chế tín hiệu nền</td></tr><tr><td>BSA</td><td className="chemical-amount">1%</td><td>Protein blocking</td></tr><tr><td>PBS</td><td>Đến đủ thể tích</td><td>Aliquot để sử dụng</td></tr></tbody></table></div><p className="icc-note">Lưu ý: serum/protein có thể làm tăng sinh vi khuẩn; bảo quản và aliquot theo SOP.</p></section>
    </div>

    <div className="icc-two-column">
      <section className="content-panel icc-panel"><div className="panel-heading"><div><span className="panel-index">SECONDARY ANTIBODY</span><h3>Pha kháng thể thứ cấp</h3></div></div><div className="chemical-table-wrap"><table className="chemical-table icc-table"><thead><tr><th>Thành phần</th><th>Thể tích (µL)</th><th>Tỉ lệ</th></tr></thead><tbody><tr><td>Alexa 488</td><td className="chemical-amount">3</td><td>1:500</td></tr><tr><td>PBS</td><td className="chemical-amount">1497</td><td>Bổ sung đến đủ</td></tr><tr><td><strong>Tổng</strong></td><td className="chemical-amount"><strong>1500</strong></td><td>Ủ 1 giờ ở nhiệt độ phòng</td></tr></tbody></table></div></section>
      <section className="content-panel icc-panel"><div className="panel-heading"><div><span className="panel-index">DAPI</span><h3>Pha DAPI</h3></div></div><div className="chemical-table-wrap"><table className="chemical-table icc-table"><thead><tr><th>Thành phần</th><th>Thể tích (µL)</th><th>Tỉ lệ</th></tr></thead><tbody><tr><td>DAPI</td><td className="chemical-amount">250</td><td>1 phần</td></tr><tr><td>PBS</td><td className="chemical-amount">1250</td><td>5 phần</td></tr><tr><td><strong>Tổng</strong></td><td className="chemical-amount"><strong>1500</strong></td><td>Ủ 5–10 phút, rửa PBS 2–3 lần</td></tr></tbody></table></div></section>
    </div>
  </section>;
}
