import { useMemo, useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseLocaleNumber } from "@/lib/numberInput";

type QpcrSample = { id: string; name: string; values: string[] };
type QpcrGroup = { id: string; name: string; samples: QpcrSample[] };
type QpcrStat = { mean: number | null; sd: number | null };
type QpcrResult = { sample: string; deltaCt: number; deltaDeltaCt: number; expression: number; upper: number; lower: number };

const DEFAULT_GENES = ["GAPDH", "E2F1", "eEF1A1", "SMA"];
const makeSample = (id: string, name: string, values = ["", "", ""]): QpcrSample => ({ id, name, values });
const makeGroup = (id: string, name: string, sampleNames: string[]): QpcrGroup => ({ id, name, samples: sampleNames.map((sample, index) => makeSample(`${id}-${index}`, sample)) });
const initialGroups: QpcrGroup[] = [
  { id: "normalize", name: "Nhóm normalize / Healthy", samples: [makeSample("normalize-0", "H2", ["20.85", "20.66", "", "31.23", "29.90", "", "18.17", "18.29", "", "30.21", "30.94", ""]), makeSample("normalize-1", "H3", ["23.38", "23.03", "", "32.58", "31.76", "", "22.89", "22.72", "", "30.78", "31.49", ""]), makeSample("normalize-2", "0")] },
  { id: "control", name: "Nhóm đối chứng", samples: [makeSample("control-0", "DC1", ["22.18", "21.49", "", "31.52", "30.59", "", "20.37", "20.16", "", "29.87", "29.29", ""]), makeSample("control-1", "DC2", ["23.27", "22.70", "", "32.87", "31.25", "", "24.99", "24.61", "", "32.93", "32.37", ""]), makeSample("control-2", "DC3", ["21.67", "21.17", "", "31.89", "30.42", "", "23.83", "23.52", "", "31.99", "31.35", ""])] },
  { id: "taa", name: "Nhóm TAA", samples: [makeSample("taa-0", "TAA1"), makeSample("taa-1", "TAA2"), makeSample("taa-2", "TAA3")] },
];
initialGroups.forEach(group => group.samples.forEach(sample => { sample.values = [...sample.values, ...Array(DEFAULT_GENES.length * 3 - sample.values.length).fill("")]; }));

function stat(values: string[]): QpcrStat {
  const numbers = values.map(parseLocaleNumber).filter(value => Number.isFinite(value));
  if (!numbers.length) return { mean: null, sd: null };
  const mean = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  const sd = numbers.length > 1 ? Math.sqrt(numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (numbers.length - 1)) : 0;
  return { mean, sd };
}
const format = (value: number | null, digits = 3) => value === null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(value);

export function QpcrCalculationView() {
  const [genes, setGenes] = useState(DEFAULT_GENES);
  const [groups, setGroups] = useState(initialGroups);
  const [referenceGene, setReferenceGene] = useState("GAPDH");
  const [calibratorGroup, setCalibratorGroup] = useState("normalize");

  const updateGene = (index: number, value: string) => setGenes(current => current.map((gene, geneIndex) => geneIndex === index ? value : gene));
  const updateGroup = (groupId: string, patch: Partial<QpcrGroup>) => setGroups(current => current.map(group => group.id === groupId ? { ...group, ...patch } : group));
  const updateSample = (groupId: string, sampleId: string, patch: Partial<QpcrSample>) => setGroups(current => current.map(group => group.id === groupId ? { ...group, samples: group.samples.map(sample => sample.id === sampleId ? { ...sample, ...patch } : sample) } : group));
  const updateValue = (groupId: string, sampleId: string, index: number, value: string) => setGroups(current => current.map(group => group.id === groupId ? { ...group, samples: group.samples.map(sample => sample.id === sampleId ? { ...sample, values: sample.values.map((item, itemIndex) => itemIndex === index ? value : item) } : sample) } : group));
  const addGene = () => { const nextGene = `Gene ${genes.length + 1}`; setGenes(current => [...current, nextGene]); setGroups(current => current.map(group => ({ ...group, samples: group.samples.map(sample => ({ ...sample, values: [...sample.values, "", "", ""] })) }))); };
  const removeGene = (index: number) => { if (genes.length <= 2 || genes[index] === referenceGene) return; setGenes(current => current.filter((_, geneIndex) => geneIndex !== index)); setGroups(current => current.map(group => ({ ...group, samples: group.samples.map(sample => ({ ...sample, values: sample.values.filter((_, valueIndex) => valueIndex < index * 3 || valueIndex >= (index + 1) * 3) })) }))); };
  const addSample = (groupId: string) => setGroups(current => current.map(group => group.id === groupId ? { ...group, samples: [...group.samples, makeSample(`${groupId}-${Date.now()}`, `Mẫu ${group.samples.length + 1}`, genes.flatMap(() => ["", "", ""]))] } : group));
  const removeSample = (groupId: string, sampleId: string) => setGroups(current => current.map(group => group.id === groupId && group.samples.length > 1 ? { ...group, samples: group.samples.filter(sample => sample.id !== sampleId) } : group));
  const addGroup = () => setGroups(current => [...current, { id: `group-${Date.now()}`, name: `Nhóm thí nghiệm ${current.length + 1}`, samples: [makeSample(`group-${Date.now()}-0`, "Mẫu 1", genes.flatMap(() => ["", "", ""]))] }]);
  const removeGroup = (groupId: string) => setGroups(current => current.length > 1 ? current.filter(group => group.id !== groupId) : current);

  const results = useMemo(() => {
    const calibrator = groups.find(group => group.id === calibratorGroup) ?? groups[0];
    const referenceIndex = Math.max(0, genes.indexOf(referenceGene));
    return groups.flatMap(group => {
      const calibratorDeltas = calibrator.samples.map((_, sampleIndex) => {
        const target = stat((calibrator.samples[sampleIndex]?.values ?? []).slice(0, 3));
        const reference = stat((calibrator.samples[sampleIndex]?.values ?? []).slice(referenceIndex * 3, referenceIndex * 3 + 3));
        return target.mean !== null && reference.mean !== null ? target.mean - reference.mean : null;
      });
      return genes.filter((_, geneIndex) => geneIndex !== referenceIndex).flatMap((gene, geneIndex) => {
        const actualIndex = geneIndex >= referenceIndex ? geneIndex + 1 : geneIndex;
        const baseDelta = calibrator.samples.reduce((sum, sample, sampleIndex) => {
          const target = stat(sample.values.slice(actualIndex * 3, actualIndex * 3 + 3)); const reference = stat(sample.values.slice(referenceIndex * 3, referenceIndex * 3 + 3));
          return target.mean !== null && reference.mean !== null ? sum + (target.mean - reference.mean) : sum;
        }, 0) / Math.max(1, calibratorDeltas.filter(value => value !== null).length);
        return group.samples.map((sample, sampleIndex) => {
          const target = stat(sample.values.slice(actualIndex * 3, actualIndex * 3 + 3)); const reference = stat(sample.values.slice(referenceIndex * 3, referenceIndex * 3 + 3));
          if (target.mean === null || reference.mean === null || !Number.isFinite(baseDelta)) return null;
          const deltaCt = target.mean - reference.mean;
          const deltaDeltaCt = deltaCt - baseDelta;
          const expression = 2 ** (-deltaDeltaCt);
          const spread = target.sd ?? 0;
          return { sample: `${group.name} · ${sample.name} · ${gene}`, deltaCt, deltaDeltaCt, expression, upper: 2 ** (-(deltaDeltaCt - spread)), lower: 2 ** (-(deltaDeltaCt + spread)) };
        }).filter((value): value is QpcrResult => value !== null);
      });
    });
  }, [groups, genes, referenceGene, calibratorGroup]);

  const resultSummary = useMemo(() => genes.filter(gene => gene !== referenceGene).map(gene => {
    const values = results.filter(result => result.sample.endsWith(`· ${gene}`)).map(result => result.expression);
    const summary = stat(values.map(value => String(value)));
    return { gene, ...summary };
  }), [genes, referenceGene, results]);

  return <div className="qpcr-page">
    <div className="page-intro"><div><div className="eyebrow">QPCR / RELATIVE EXPRESSION</div><h1>Tính toán <em>qPCR.</em></h1><p>Nhập Ct/Cp vào các ô màu xanh để tính trung bình, độ lệch chuẩn, ΔCt, ΔΔCt và biểu hiện tương đối theo phương pháp 2<sup>−ΔΔCt</sup>.</p></div><Calculator size={28} color="var(--teal)" /></div>
    <section className="content-panel qpcr-instructions"><strong>Hướng dẫn nhanh</strong><span>Chỉ thay đổi dữ liệu trong ô xanh. Thêm gene hoặc nhóm bằng nút bên dưới; sau khi thêm hàng/cột, kiểm tra lại vùng dữ liệu.</span><span>Nhóm calibrator được dùng làm mốc ΔCt trung bình để tính ΔΔCt cho các nhóm còn lại.</span></section>
    <section className="content-panel qpcr-settings"><div className="panel-heading"><div><span className="panel-index">ANALYSIS SETTINGS</span><h2>Thiết lập phép tính</h2></div></div><div className="qpcr-settings-grid"><label className="field-label">Gene reference<select value={referenceGene} onChange={event => setReferenceGene(event.target.value)}>{genes.map(gene => <option key={gene}>{gene}</option>)}</select></label><label className="field-label">Nhóm calibrator<select value={calibratorGroup} onChange={event => setCalibratorGroup(event.target.value)}>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div></section>
    <section className="content-panel qpcr-input-panel"><div className="panel-heading"><div><span className="panel-index">INPUT / CT OR CP</span><h2>Khối nhập liệu</h2><p>Giá trị Ct/Cp, tên mẫu và tên gene có thể chỉnh sửa trực tiếp.</p></div><div className="qpcr-toolbar"><Button variant="outline" onClick={addGene}><Plus size={14} /> Thêm gene</Button><Button variant="outline" onClick={addGroup}><Plus size={14} /> Thêm nhóm</Button></div></div><div className="qpcr-gene-editor">{genes.map((gene, index) => <div key={`${gene}-${index}`}><Input value={gene} onChange={event => updateGene(index, event.target.value)} aria-label={`Tên gene ${index + 1}`} /><button type="button" className="icon-button danger" onClick={() => removeGene(index)} aria-label={`Xoá gene ${gene}`}><Trash2 size={13} /></button></div>)}</div>{groups.map(group => <div className="qpcr-group" key={group.id}><div className="qpcr-group-heading"><Input value={group.name} onChange={event => updateGroup(group.id, { name: event.target.value })} aria-label="Tên nhóm qPCR" /><div><Button variant="outline" onClick={() => addSample(group.id)}><Plus size={13} /> Thêm mẫu</Button>{groups.length > 1 && <button type="button" className="icon-button danger" onClick={() => removeGroup(group.id)} aria-label={`Xoá ${group.name}`}><Trash2 size={14} /></button>}</div></div><div className="qpcr-table-wrap"><table className="qpcr-table"><thead><tr><th>Mẫu</th>{genes.map(gene => <th key={gene} colSpan={3}>{gene}<small>Rep1 · Rep2 · Rep3</small></th>)}<th></th></tr></thead><tbody>{group.samples.map(sample => <tr key={sample.id}><td><Input value={sample.name} onChange={event => updateSample(group.id, sample.id, { name: event.target.value })} aria-label="Tên mẫu" /></td>{genes.map((gene, geneIndex) => <td colSpan={3} key={`${sample.id}-${gene}`}><div className="qpcr-reps">{[0, 1, 2].map(rep => <Input key={rep} value={sample.values[geneIndex * 3 + rep] ?? ""} onChange={event => updateValue(group.id, sample.id, geneIndex * 3 + rep, event.target.value)} inputMode="decimal" aria-label={`${gene} Rep${rep + 1}`} />)}</div><small className="qpcr-inline-stat">x̄ {format(stat([sample.values[geneIndex * 3] ?? "", sample.values[geneIndex * 3 + 1] ?? "", sample.values[geneIndex * 3 + 2] ?? ""]).mean)} · SD {format(stat([sample.values[geneIndex * 3] ?? "", sample.values[geneIndex * 3 + 1] ?? "", sample.values[geneIndex * 3 + 2] ?? ""]).sd)}</small></td>)}<td><button type="button" className="icon-button danger" onClick={() => removeSample(group.id, sample.id)} aria-label={`Xoá mẫu ${sample.name}`}><Trash2 size={13} /></button></td></tr>)}</tbody></table></div></div>)}</section>
    <section className="content-panel qpcr-result-panel"><div className="panel-heading"><div><span className="panel-index">RESULT / 2^-ΔΔCT</span><h2>Kết quả biểu hiện tương đối</h2><p>Expression = 2<sup>−ΔΔCt</sup>; Upper/Lower được ước tính từ SD của các Rep hợp lệ trong từng mẫu.</p></div></div><div className="qpcr-summary-grid">{resultSummary.map(item => <div className="qpcr-summary-card" key={item.gene}><small>{item.gene}</small><strong>{format(item.mean)}</strong><span>SD {format(item.sd)}</span></div>)}</div><div className="qpcr-table-wrap"><table className="qpcr-result-table"><thead><tr><th>Nhóm / mẫu / gene</th><th>ΔCt</th><th>ΔΔCt</th><th>Expression</th><th>Upper</th><th>Lower</th></tr></thead><tbody>{results.map(result => <tr key={result.sample}><td>{result.sample}</td><td>{format(result.deltaCt)}</td><td>{format(result.deltaDeltaCt)}</td><td><strong>{format(result.expression)}</strong></td><td>{format(result.upper)}</td><td>{format(result.lower)}</td></tr>)}</tbody></table></div>{!results.length && <div className="empty-state"><p>Nhập Ct/Cp của gene reference và gene đích để xem kết quả.</p></div>}</section>
  </div>;
}
