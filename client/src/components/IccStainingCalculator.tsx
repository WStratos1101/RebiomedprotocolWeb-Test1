import { useMemo, useState } from "react";
import { FlaskConical, Info, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseLocaleNumber } from "@/lib/numberInput";
import { calculateIccBlocking, calculateIccDapi, calculateIccPermeabilization, calculateIccPrimary, calculateIccSecondary, type IccMixRow } from "@/lib/iccMath";

type PrimaryAntibody = { name: string; icc: string; westernBlot: string; ratio: number; defaultTotal: number };
type IccTab = "primary" | "secondary" | "permeabilization" | "blocking" | "dapi";

const primaryAntibodies: PrimaryAntibody[] = [
  { name: "α-SMA", icc: "1:300", westernBlot: "1:1000", ratio: 300, defaultTotal: 1500 },
  { name: "E2F1", icc: "1:500", westernBlot: "1:2000", ratio: 500, defaultTotal: 1500 },
  { name: "eEF1A1", icc: "1:500", westernBlot: "1:5000", ratio: 500, defaultTotal: 1500 },
  { name: "Collagen I", icc: "1:200", westernBlot: "1:1000", ratio: 200, defaultTotal: 1500 },
  { name: "GFAP", icc: "1:200", westernBlot: "NA", ratio: 200, defaultTotal: 1500 },
  { name: "Desmin", icc: "1:300", westernBlot: "1:1000", ratio: 300, defaultTotal: 1500 },
  { name: "Phalloidin", icc: "1:400", westernBlot: "—", ratio: 400, defaultTotal: 2000 },
  { name: "Alexa 488", icc: "1:500", westernBlot: "—", ratio: 500, defaultTotal: 1500 },
];

const tabs: Array<{ id: IccTab; label: string; eyebrow: string }> = [
  { id: "primary", label: "Pha kháng thể sơ cấp", eyebrow: "1ST ANTIBODY" },
  { id: "secondary", label: "Pha kháng thể thứ cấp", eyebrow: "2ND ANTIBODY" },
  { id: "permeabilization", label: "Permeabilization", eyebrow: "PERMEABILIZATION" },
  { id: "blocking", label: "Blocking buffer", eyebrow: "BLOCKING BUFFER" },
  { id: "dapi", label: "Pha DAPI", eyebrow: "DAPI" },
];

const format = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(value);
const number = (value: string) => {
  const parsed = parseLocaleNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function VolumeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="field-label icc-volume-field">V tổng muốn pha<Input value={value} onChange={event => onChange(event.target.value)} inputMode="decimal" placeholder="Ví dụ: 1500" /><span>µL</span></label>;
}

function ResultTable({ rows, total }: { rows: IccMixRow[] | null; total: number | null }) {
  return <div className="chemical-table-wrap"><table className="chemical-table icc-table"><thead><tr><th>Thành phần</th><th>Thể tích (µL)</th><th>Ghi chú</th></tr></thead><tbody>{rows?.map(row => <tr key={row.name}><td><strong>{row.name}</strong></td><td className="chemical-amount">{format(row.volume)}</td><td>{row.note}</td></tr>)}<tr><td><strong>Tổng</strong></td><td className="chemical-amount"><strong>{total === null ? "—" : format(total)}</strong></td><td>Đơn vị dùng chung: µL</td></tr></tbody></table></div>;
}

export function IccStainingCalculator() {
  const [activeTab, setActiveTab] = useState<IccTab>("primary");
  const [selectedAntibody, setSelectedAntibody] = useState("α-SMA");
  const [volumeByTab, setVolumeByTab] = useState<Record<IccTab, string>>({ primary: "1500", secondary: "1500", permeabilization: "100", blocking: "100", dapi: "1500" });
  const selected = primaryAntibodies.find(item => item.name === selectedAntibody) ?? primaryAntibodies[0];
  const total = number(volumeByTab[activeTab]);
  const primaryRows = useMemo(() => calculateIccPrimary(number(volumeByTab.primary) ?? Number.NaN, selected.ratio), [selected.ratio, volumeByTab.primary]);
  const secondaryRows = useMemo(() => calculateIccSecondary(number(volumeByTab.secondary) ?? Number.NaN), [volumeByTab.secondary]);
  const tweenRows = useMemo(() => calculateIccPermeabilization(number(volumeByTab.permeabilization) ?? Number.NaN, 0.2, "Tween 20"), [volumeByTab.permeabilization]);
  const tritonRows = useMemo(() => calculateIccPermeabilization(number(volumeByTab.permeabilization) ?? Number.NaN, 0.1, "Triton X-100"), [volumeByTab.permeabilization]);
  const blockingRows = useMemo(() => calculateIccBlocking(number(volumeByTab.blocking) ?? Number.NaN), [volumeByTab.blocking]);
  const dapiRows = useMemo(() => calculateIccDapi(number(volumeByTab.dapi) ?? Number.NaN), [volumeByTab.dapi]);
  const setVolume = (value: string) => setVolumeByTab(current => ({ ...current, [activeTab]: value }));
  const reset = () => { setActiveTab("primary"); setSelectedAntibody("α-SMA"); setVolumeByTab({ primary: "1500", secondary: "1500", permeabilization: "100", blocking: "100", dapi: "1500" }); };
  const rows = activeTab === "primary" ? primaryRows : activeTab === "secondary" ? secondaryRows : activeTab === "blocking" ? blockingRows : dapiRows;
  const active = tabs.find(tab => tab.id === activeTab) ?? tabs[0];

  return <section className="icc-staining">
    <div className="content-panel cdna-hero"><div><span className="panel-index">CHEMISTRY WORKBENCH / ICC STAINING</span><h2>Pha hoá chất nhuộm ICC</h2><p>Tách thành 5 mục pha riêng. Mỗi mục chỉ cần nhập V tổng muốn pha; toàn bộ thể tích đều dùng đơn vị µL.</p></div><div className="cdna-kit-badge"><FlaskConical size={20} /><span><strong>ICC staining</strong><small>Đơn vị chung · µL</small></span></div></div>
    <nav className="icc-subtabs" role="tablist" aria-label="Các mục pha nhuộm ICC">{tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>
    <section className="content-panel icc-panel"><div className="panel-heading"><div><span className="panel-index">{active.eyebrow}</span><h3>{active.label}</h3><p>Nhập một giá trị V tổng để nhận ngay thể tích từng thành phần.</p></div><Button variant="outline" onClick={reset}><RotateCcw size={14} /> Đặt lại</Button></div>
      {activeTab === "primary" && <div className="icc-primary-controls"><label className="field-label icc-select-field">Kháng thể sơ cấp<select value={selectedAntibody} onChange={event => setSelectedAntibody(event.target.value)}>{primaryAntibodies.map(item => <option key={item.name} value={item.name}>{item.name} · {item.icc}</option>)}</select><span>Chọn tỉ lệ kháng thể cần dùng</span></label><VolumeInput value={volumeByTab.primary} onChange={value => setVolumeByTab(current => ({ ...current, primary: value }))} /></div>}
      {activeTab !== "primary" && <VolumeInput value={volumeByTab[activeTab]} onChange={setVolume} />}
      {activeTab === "permeabilization" ? <div className="icc-option-results"><section><h4>PBS Tween 20 · 0,2%</h4><ResultTable rows={tweenRows} total={total} /></section><section><h4>PBS Triton X-100 · 0,1%</h4><ResultTable rows={tritonRows} total={total} /></section></div> : <ResultTable rows={rows} total={total} />}
      {total === null && <div className="chemical-warning"><Info size={15} /> Nhập V tổng là số dương. Dấu “.” và “,” đều được hiểu là dấu thập phân.</div>}
      {activeTab === "permeabilization" && <p className="icc-note">Thể tích hoạt chất được tính theo nồng độ cuối % (v/v) trên tổng thể tích. Nếu SOP của phòng thí nghiệm dùng stock có nồng độ khác, cần hiệu chỉnh theo nồng độ stock thực tế.</p>}
    </section>
    {activeTab === "primary" && <section className="content-panel icc-panel"><div className="panel-heading"><div><span className="panel-index">REFERENCE</span><h3>Tra cứu tỉ lệ kháng thể</h3></div></div><div className="chemical-table-wrap"><table className="chemical-table icc-table"><thead><tr><th>Kháng thể</th><th>ICC</th><th>Western Blot</th></tr></thead><tbody>{primaryAntibodies.map(item => <tr key={item.name}><td><strong>{item.name}</strong></td><td className="chemical-amount">{item.icc}</td><td>{item.westernBlot}</td></tr>)}</tbody></table></div></section>}
  </section>;
}
