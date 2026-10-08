import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Info, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseLocaleNumber } from "@/lib/numberInput";
import { toast } from "sonner";

const GENES = ["Gapdh", "E2F1", "eEF1A1", "sma", "cylinD1", "cyclinE", "cyclinA", "Lrat", "GFAP"] as const;
type Gene = typeof GENES[number];
type SampleRow = { id: number; symbol: string; genes: Gene[] };

const SAMPLE_INFO = [
  ["N", "Tế bào CFSC nontreat"],
  ["C", "Tế bào CFSC treat sirna đối chứng"],
  ["E", "Tế bào CFSC treat sirna E2F1"],
  ["0", "TB HSC ngày 7 nontreat"],
  ["5", "TB HSC ngày 7 treat LPS 5 ng/ml"],
] as const;

const initialRows: SampleRow[] = [
  { id: 1, symbol: "N", genes: ["Gapdh", "E2F1", "eEF1A1"] },
  { id: 2, symbol: "C", genes: ["Gapdh", "E2F1", "eEF1A1"] },
  { id: 3, symbol: "E", genes: ["Gapdh", "E2F1", "eEF1A1"] },
  { id: 4, symbol: "0", genes: ["Gapdh", "E2F1", "eEF1A1", "sma", "cylinD1"] },
  { id: 5, symbol: "5", genes: ["Gapdh", "E2F1", "eEF1A1", "sma", "cylinD1"] },
  { id: 6, symbol: "", genes: [] },
  { id: 7, symbol: "", genes: [] },
  { id: 8, symbol: "", genes: [] },
];

const number = (value: string) => {
  const parsed = parseLocaleNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const format = (value: number | null, digits = 2) => value === null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(value);
const geneLabel = (gene: Gene) => gene.toLowerCase();
const plateRows = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function QdnaMasterMixCalculator({ userId }: { userId?: number }) {
  const [annealingTemperature, setAnnealingTemperature] = useState("60");
  const [reactionVolume, setReactionVolume] = useState("10");
  const [technicalReplicate, setTechnicalReplicate] = useState("2");
  const [rows, setRows] = useState<SampleRow[]>(initialRows);
  const [sampleInfo, setSampleInfo] = useState<Record<string, string>>(() => Object.fromEntries(SAMPLE_INFO));
  const storageKey = `rebiomed-master-mix-qdna-${userId ?? "guest"}`;
  useEffect(() => { try { const raw = window.localStorage.getItem(storageKey); if (!raw) return; const saved = JSON.parse(raw) as { savedAt?: number; data?: { annealingTemperature?: string; reactionVolume?: string; technicalReplicate?: string; rows?: SampleRow[]; sampleInfo?: Record<string,string> } }; if (!saved.savedAt || Date.now() - saved.savedAt > 10 * 60 * 60 * 1000) { window.localStorage.removeItem(storageKey); return; } const data = saved.data; if (!data) return; if (data.annealingTemperature) setAnnealingTemperature(data.annealingTemperature); if (data.reactionVolume) setReactionVolume(data.reactionVolume); if (data.technicalReplicate) setTechnicalReplicate(data.technicalReplicate); if (data.rows) setRows(data.rows); if (data.sampleInfo) setSampleInfo(data.sampleInfo); } catch { /* ignore malformed temporary data */ } }, [storageKey]);
  const saveTemporary = (section: "sample" | "reaction") => { try { window.localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), data: { annealingTemperature, reactionVolume, technicalReplicate, rows, sampleInfo } })); toast.success(section === "sample" ? "Đã lưu tạm thông tin mẫu trong 10 giờ." : "Đã lưu tạm thông tin phản ứng trong 10 giờ."); } catch { toast.error("Không thể lưu tạm trên thiết bị này."); } };

  const result = useMemo(() => {
    const annealing = number(annealingTemperature);
    const reaction = number(reactionVolume);
    const replicate = number(technicalReplicate);
    if (annealing === null || reaction === null || replicate === null || reaction <= 0 || replicate <= 0 || !Number.isInteger(replicate)) return null;
    const scale = reaction / 10;
    const mix1PerReaction = 8 * scale;
    const cDNAperReaction = 0.7 * scale;
    const primerPerReaction = 0.4 * scale;
    const depcPerReaction = 0.9 * scale;
    const rowResults = rows.map(row => {
      const reactionCount = row.genes.length * replicate;
      const mix1Volume = reactionCount * 1.1 * mix1PerReaction;
      const cdnaVolume = reactionCount * 1.1 * cDNAperReaction;
      return { ...row, geneCount: row.genes.length, reactionCount, mix1Volume, cdnaVolume, mix2Total: mix1Volume + cdnaVolume };
    });
    const geneResults = GENES.map(gene => {
      const reactionCount = rows.filter(row => row.genes.includes(gene)).length * replicate;
      return { gene, reactionCount, primerVolume: reactionCount * 1.1 * primerPerReaction, depcVolume: reactionCount * 1.1 * depcPerReaction };
    });
    const totalReactions = rowResults.reduce((sum, row) => sum + row.reactionCount, 0);
    const masterMixReactions = totalReactions * 1.15;
    const mix1 = { depc: masterMixReactions * 3 * scale, sensiFast: masterMixReactions * 5 * scale, total: masterMixReactions * mix1PerReaction };
    const plate = rowResults.map((row, index) => {
      const wells: string[] = [];
      row.genes.forEach(gene => { for (let replicateIndex = 1; replicateIndex <= replicate; replicateIndex += 1) wells.push(`${geneLabel(gene)}-${replicateIndex}`); });
      return { label: plateRows[index] ?? String(index + 1), symbol: row.symbol || "—", wells: Array.from({ length: 12 }, (_, wellIndex) => wells[wellIndex] ?? "") };
    });
    return { annealing, reaction, replicate, scale, mix1PerReaction, cDNAperReaction, primerPerReaction, depcPerReaction, rowResults, geneResults, totalReactions, masterMixReactions, mix1, plate };
  }, [annealingTemperature, reactionVolume, technicalReplicate, rows]);

  const updateRow = (id: number, patch: Partial<SampleRow>) => setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  const addSample = () => setRows(current => [...current, { id: Math.max(0, ...current.map(row => row.id)) + 1, symbol: "", genes: [] }]);
  const toggleGene = (id: number, gene: Gene) => setRows(current => current.map(row => {
    if (row.id !== id) return row;
    const genes = row.genes.includes(gene) ? row.genes.filter(item => item !== gene) : [...row.genes, gene];
    return { ...row, genes };
  }));
  const reset = () => { setAnnealingTemperature("60"); setReactionVolume("10"); setTechnicalReplicate("2"); setRows(initialRows.map(row => ({ ...row, genes: [...row.genes] }))); setSampleInfo(Object.fromEntries(SAMPLE_INFO)); };
  const clearTemporary = () => { if (!window.confirm("Xoá bản lưu tạm và đặt Master Mix qDNA về mặc định?")) return; try { window.localStorage.removeItem(storageKey); } catch { /* ignore storage errors after reset */ } reset(); toast.success("Đã xoá bản lưu tạm và khôi phục mặc định."); };
  const display = result ?? { annealing: 60, reaction: 10, replicate: 2, scale: 1, mix1PerReaction: 8, cDNAperReaction: 0.7, primerPerReaction: 0.4, depcPerReaction: 0.9, rowResults: [] as Array<SampleRow & { geneCount: number; reactionCount: number; mix1Volume: number; cdnaVolume: number; mix2Total: number }>, geneResults: GENES.map(gene => ({ gene, reactionCount: 0, primerVolume: 0, depcVolume: 0 })), totalReactions: 0, masterMixReactions: 0, mix1: { depc: 0, sensiFast: 0, total: 0 }, plate: [] as Array<{ label: string; symbol: string; wells: string[] }> };

  return <section className="cdna-master-mix">
    <div className="content-panel cdna-hero"><div><span className="panel-index">CHEMISTRY WORKBENCH / MASTER MIX</span><h2>Master mix qDNA</h2><p>Tính số phản ứng, Mix 1, Mix 2, Mix 3 và bố trí đĩa cho qDNA theo SensiFAST™ SYBR® No-ROX Kit.</p></div><div className="cdna-kit-badge"><FlaskConical size={20} /><span><strong>SensiFAST™ SYBR® No-ROX Kit</strong><small>BIO-98005</small></span></div></div>
    <div className="content-panel cdna-settings"><div className="panel-heading"><div><span className="panel-index">INPUT / MÀU XANH</span><h3>Thông số phản ứng</h3></div><Button variant="outline" onClick={reset}><RotateCcw size={14} /> Đặt lại</Button></div><div className="cdna-settings-grid">
      <label className="field-label cdna-green-field">Nhiệt độ bắt cặp<Input value={annealingTemperature} onChange={event => setAnnealingTemperature(event.target.value)} inputMode="decimal" /><small>°C</small></label>
      <label className="field-label cdna-green-field">Thể tích phản ứng<Input value={reactionVolume} onChange={event => setReactionVolume(event.target.value)} inputMode="decimal" /><small>µL / phản ứng</small></label>
      <label className="field-label cdna-green-field">Technical replicate<Input value={technicalReplicate} onChange={event => setTechnicalReplicate(event.target.value)} inputMode="numeric" /><small>Số lần lặp lại kỹ thuật</small></label>
      <div className="cdna-kit-detail"><small>BỘ KIT SỬ DỤNG</small><strong>SensiFAST™ SYBR® No-ROX Kit</strong><span>BIO-98005</span></div>
    </div>{result === null && <div className="chemical-warning"><Info size={15} /> Nhập nhiệt độ, thể tích phản ứng dương và Technical replicate là số nguyên dương.</div>}</div>

    <section className="content-panel cdna-sample-panel qdna-sample-panel"><div className="panel-heading"><div><span className="panel-index">REACTION INFORMATION</span><h3>Thông tin phản ứng</h3><p>Chọn dấu x cho gene cần chạy ở từng mẫu.</p></div><span className="stock-summary">{display.totalReactions} phản ứng</span><Button variant="outline" onClick={addSample}><Plus size={14} /> Thêm mẫu</Button><Button variant="outline" onClick={() => saveTemporary("reaction")}><Save size={14} /> Lưu tạm</Button><Button variant="outline" onClick={clearTemporary}><Trash2 size={14} /> Xoá bản lưu tạm</Button></div><div className="chemical-table-wrap"><table className="chemical-table qdna-sample-table"><thead><tr><th>STT</th><th>Kí hiệu mẫu</th>{GENES.map(gene => <th key={gene}>{gene}</th>)}<th>Tổng số gene</th><th>Tổng phản ứng</th></tr></thead><tbody>{rows.map((row, index) => { const calculated = display.rowResults[index]; return <tr key={row.id}><td>{index + 1}</td><td><Input className="cdna-cell-input" value={row.symbol} onChange={event => updateRow(row.id, { symbol: event.target.value })} placeholder="—" /></td>{GENES.map(gene => <td key={gene} className="qdna-check-cell"><input type="checkbox" checked={row.genes.includes(gene)} onChange={() => toggleGene(row.id, gene)} aria-label={`${row.symbol || `mẫu ${row.id}`} · ${gene}`} /></td>)}<td className="chemical-amount">{calculated?.geneCount ?? row.genes.length}</td><td className="chemical-amount">{calculated?.reactionCount ?? 0}</td></tr>; })}</tbody></table></div></section>

    <div className="cdna-two-column"><section className="content-panel cdna-info-panel"><div className="panel-heading"><div><span className="panel-index">SAMPLE KEY</span><h3>Thông tin mẫu chi tiết</h3></div><Button variant="outline" onClick={() => saveTemporary("sample")}><Save size={14} /> Lưu tạm</Button><Button variant="outline" onClick={clearTemporary}><Trash2 size={14} /> Xoá bản lưu tạm</Button></div><div className="cdna-key-list">{SAMPLE_INFO.map(([symbol]) => <div key={symbol}><strong>{symbol}</strong><Input value={sampleInfo[symbol] ?? ""} onChange={event => setSampleInfo(current => ({ ...current, [symbol]: event.target.value }))} aria-label={`Thông tin mẫu ${symbol}`} /></div>)}</div></section><section className="content-panel cdna-reaction-panel"><div className="panel-heading"><div><span className="panel-index">REACTION / {format(display.reaction)} µL</span><h3>Thành phần phản ứng</h3></div><span className="chemical-scale">{format(display.annealing)} °C</span><Button variant="outline" onClick={() => saveTemporary("reaction")}><Save size={14} /> Lưu tạm</Button><Button variant="outline" onClick={clearTemporary}><Trash2 size={14} /> Xoá bản lưu tạm</Button></div><div className="chemical-table-wrap"><table className="chemical-table cdna-reaction-table"><thead><tr><th>Thành phần</th><th>V (µL)</th><th>Vai trò</th></tr></thead><tbody><tr><td>DEPC · Mix 1</td><td className="chemical-amount">{format(3 * display.scale)}</td><td>Nền phản ứng</td></tr><tr><td>2x SensiFAST</td><td className="chemical-amount">{format(5 * display.scale)}</td><td>Master mix 2X</td></tr><tr><td>cDNA</td><td className="chemical-amount">{format(display.cDNAperReaction)}</td><td>Mẫu khuôn</td></tr><tr><td>Primer</td><td className="chemical-amount">{format(display.primerPerReaction)}</td><td>Primer mix</td></tr><tr><td>DEPC · Mix 3</td><td className="chemical-amount">{format(display.depcPerReaction)}</td><td>Bù thể tích primer mix</td></tr><tr><td><strong>Tổng</strong></td><td className="chemical-amount"><strong>{format(display.reaction)}</strong></td><td>Cho mỗi phản ứng</td></tr></tbody></table></div></section></div>

    <section className="content-panel cdna-mix-panel"><div className="panel-heading"><div><span className="panel-index">MIX 1 / {format(display.masterMixReactions, 1)} REACTIONS + 15%</span><h3>Master mix 1 (2X)</h3></div><span className="stock-summary">Tổng phản ứng: {display.totalReactions}</span></div><div className="chemical-table-wrap"><table className="chemical-table cdna-mix-table"><thead><tr><th>Mix 1 (2X)</th><th>V (µL)</th><th>Công thức</th></tr></thead><tbody><tr><td>DEPC</td><td className="chemical-amount">{format(display.mix1.depc, 1)}</td><td>3 µL × tổng phản ứng × 1,15</td></tr><tr><td>2x SensiFAST</td><td className="chemical-amount">{format(display.mix1.sensiFast, 1)}</td><td>5 µL × tổng phản ứng × 1,15</td></tr><tr><td><strong>Tổng</strong></td><td className="chemical-amount"><strong>{format(display.mix1.total, 1)}</strong></td><td>Mix 1 cần chuẩn bị</td></tr></tbody></table></div></section>

    <section className="content-panel cdna-mix-panel"><div className="panel-heading"><div><span className="panel-index">MIX 2 / PER SAMPLE + 10%</span><h3>Mix 2 · cDNA mix</h3></div><span className="stock-summary">Mix 1 + cDNA = {format(display.mix1PerReaction + display.cDNAperReaction)} µL / phản ứng</span></div><div className="chemical-table-wrap"><table className="chemical-table cdna-mix-table"><thead><tr><th>Mẫu</th><th>Số phản ứng</th><th>Mix 1 (µL)</th><th>cDNA (µL)</th><th>Tổng Mix 2 (µL)</th></tr></thead><tbody>{display.rowResults.map(row => <tr key={`mix2-${row.id}`}><td><strong>{row.symbol || `Mẫu ${row.id}`}</strong></td><td>{row.reactionCount}</td><td className="chemical-amount">{format(row.mix1Volume)}</td><td className="chemical-amount">{format(row.cdnaVolume)}</td><td className="chemical-amount">{format(row.mix2Total)}</td></tr>)}</tbody></table></div></section>

    <section className="content-panel cdna-mix-panel"><div className="panel-heading"><div><span className="panel-index">MIX 3 / PRIMER MIX + 10%</span><h3>Mix 3 · Primer mix theo gene</h3></div><span className="stock-summary">Primer 0,4 + DEPC 0,9 µL / phản ứng</span></div><div className="chemical-table-wrap"><table className="chemical-table qdna-gene-table"><thead><tr><th>Thành phần</th>{GENES.map(gene => <th key={gene}>{gene}</th>)}</tr></thead><tbody><tr><td><strong>Primer 10mM</strong></td>{display.geneResults.map(item => <td key={item.gene} className="chemical-amount">{format(item.primerVolume)}</td>)}</tr><tr><td><strong>DEPC</strong></td>{display.geneResults.map(item => <td key={item.gene} className="chemical-amount">{format(item.depcVolume)}</td>)}</tr></tbody></table></div></section>

    <section className="content-panel cdna-mix-panel"><div className="panel-heading"><div><span className="panel-index">PLATE LAYOUT / {format(display.replicate, 0)} REPLICATES</span><h3>Bố trí đĩa</h3></div><span className="stock-summary">Mix 2: {format(display.mix1PerReaction + display.cDNAperReaction)} µL · Mix 3: {format(display.primerPerReaction + display.depcPerReaction)} µL</span></div><div className="chemical-table-wrap"><table className="chemical-table qdna-plate-table"><thead><tr><th>Kí hiệu mẫu</th>{Array.from({ length: 12 }, (_, index) => <th key={index}>{index + 1}</th>)}</tr></thead><tbody>{display.plate.map(row => <tr key={row.label}><td><strong>{row.symbol}</strong><small>{row.label}</small></td>{row.wells.map((well, index) => <td key={`${row.label}-${index}`}>{well}</td>)}</tr>)}</tbody></table></div></section>
  </section>;
}
