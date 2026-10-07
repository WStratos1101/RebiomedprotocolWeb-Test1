import { useState } from "react";
import { Beaker, Calculator, ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HypoxiaCalculator } from "./HypoxiaCalculator";
import "./special.css";

export type SpecialCategory = "Hypoxia" | "HighPressure";
export const SPECIAL_CATEGORY_LABEL: Record<SpecialCategory, string> = {
  Hypoxia: "Nuôi cấy Hypoxia",
  HighPressure: "Nuôi cấy áp suất cao",
};

type ProtocolSummary = { id: string; title: string; owner: string; summary: string; category: string; steps: { title: string }[] };
type ToolSummary = { id: string; name: string; formula: string; description: string; category: string; protocolOnly?: boolean };

export function SpecialExperimentsView({
  protocols, tools, category, setCategory, openProtocol, openTool, createProtocol, createTool,
}: {
  protocols: ProtocolSummary[];
  tools: ToolSummary[];
  category: SpecialCategory;
  setCategory: (category: SpecialCategory) => void;
  openProtocol: (protocol: ProtocolSummary) => void;
  openTool: (toolId: string) => void;
  createProtocol: (category: SpecialCategory) => void;
  createTool: (category: SpecialCategory) => void;
}) {
  const [showHypoxia, setShowHypoxia] = useState(false);
  const groupProtocols = protocols.filter(protocol => protocol.category === category);
  const groupTools = tools.filter(tool => tool.category === category && !tool.protocolOnly);
  const selectCategory = (next: SpecialCategory) => { setCategory(next); setShowHypoxia(false); };
  return <div className="special-page">
    <div className="special-intro"><span className="panel-index">CONDITION LAB / EXPERIMENT LIBRARY</span><h1>Thí nghiệm <em>điều kiện đặc trưng.</em></h1><p>Quy trình và công cụ tính được phân theo điều kiện nuôi — để thiết kế, ghi chép và rà soát ngay cùng một nơi.</p></div>
    <nav className="special-tabs" aria-label="Điều kiện nuôi cấy">
      {(["Hypoxia", "HighPressure"] as const).map(key => <button key={key} type="button" onClick={() => selectCategory(key)} className={category === key ? "active" : ""} aria-current={category === key ? "page" : undefined}>{SPECIAL_CATEGORY_LABEL[key]}<ChevronRight size={14} /></button>)}
    </nav>
    <div className="special-branch"><div><span className="panel-index">CONDITION / {category.toUpperCase()}</span><h2>{SPECIAL_CATEGORY_LABEL[category]}</h2><p>{category === "Hypoxia" ? "Theo dõi dự trữ O₂ pha khí trong hệ kín và lưu quy trình vận hành phù hợp từng tế bào." : "Không gian lưu quy trình và phương trình cho hệ nuôi áp suất cao; mọi tham số cần được kiểm định theo thiết bị thực tế."}</p></div><span className="special-badge"><ShieldCheck size={14} /> Thao tác công khai</span></div>
    <div className="special-columns">
      <section className="content-panel special-list"><div className="special-list-head"><div><span className="panel-index">PROTOCOLS</span><h3><strong>Quy trình</strong></h3></div><Button onClick={() => createProtocol(category)} className="primary-cta"><Plus size={15} /> Thêm quy trình</Button></div>{groupProtocols.length ? groupProtocols.map(protocol => <button key={protocol.id} className="special-item" onClick={() => openProtocol(protocol)}><Beaker size={17} /><span><strong>{protocol.title}</strong><small>{protocol.owner} · {protocol.steps.length} bước · {protocol.summary}</small></span><ChevronRight size={14} /></button>) : <p className="special-empty">Chưa có quy trình. Tạo trang mới và viết từng bước cho điều kiện này.</p>}</section>
      <section className="content-panel special-list"><div className="special-list-head"><div><span className="panel-index">CALCULATORS / {String(groupTools.length).padStart(2, "0")}</span><h3>Công cụ tính</h3></div><Button onClick={() => createTool(category)} className="primary-cta"><Plus size={15} /> Thêm tool</Button></div>{groupTools.length ? groupTools.map(tool => <button key={tool.id} className="special-item" onClick={() => tool.id === "hypoxia-headspace" ? setShowHypoxia(current => !current) : openTool(tool.id)}><Calculator size={17} /><span><strong>{tool.name}</strong><small>{tool.description}</small></span><ChevronRight size={14} /></button>) : <p className="special-empty">Chưa có tool. Thêm công thức số học để tính ngay trên web.</p>}</section>
    </div>
    {category === "Hypoxia" && showHypoxia && <div className="special-hypoxia"><HypoxiaCalculator /></div>}
  </div>;
}
