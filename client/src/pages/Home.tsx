import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getFormulaVariables } from "@shared/formulaMath";
import { calculateCellsNeeded, calculateVolumeToTake } from "@/lib/cellCalculations";
import { toast } from "sonner";
import { HypoxiaCalculator } from "@/components/HypoxiaCalculator";
import { CustomCalculator } from "@/components/CustomCalculator";
import { SpecialExperimentsView, SPECIAL_CATEGORY_LABEL, type SpecialCategory } from "@/components/SpecialExperimentsView";
import {
  Archive,
  ArrowLeft,
  BarChart3,
  Beaker,
  BookOpen,
  Calculator,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  FilePenLine,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type View = "overview" | "protocols" | "samples" | "calculator" | "special" | "admin" | "adminAccounts" | "createProtocol";
type Protocol = {
  id: string;
  title: string;
  category: string;
  tag: string;
  status: "Đã duyệt" | "Bản nháp";
  version: string;
  updatedAt: string;
  owner: string;
  summary: string;
  duration: string;
  steps: ProtocolStep[];
  notes: string[];
};
type ProtocolStep = { title: string; detail: string; time: string };
type Sample = {
  id: string;
  code: string;
  name: string;
  group: string;
  status: string;
  updatedAt: string;
  description: string;
  properties: { label: string; value: string }[];
  theory: string;
};

type CalculatorDefinition = {
  id: string;
  dbId?: number;
  config?: unknown;
  name: string;
  category: string;
  formula: string;
  description: string;
  color: string;
};
type CalculatorRecord = { id: number; slug: string; name: string; category: string; formula: string; description: string; config: unknown; active: number };

const initialProtocols: Protocol[] = [];
const initialSamples: Sample[] = [];

const calculators: CalculatorDefinition[] = [
  { id: "dilution", name: "Pha loãng nồng độ", category: "Dung dịch", formula: "C₁V₁ = C₂V₂", description: "Tính thể tích stock cần lấy hoặc nồng độ sau pha loãng.", color: "teal" },
  { id: "viability", name: "Cell viability", category: "Cell culture", formula: "Sống / Tổng × 100", description: "Tính tỷ lệ sống từ số tế bào sống và tổng số tế bào.", color: "amber" },
  { id: "molarity", name: "Molarity → mass", category: "Hóa chất", formula: "m = C × V × MW", description: "Quy đổi nồng độ mol sang khối lượng chất cần cân.", color: "blue" },
  { id: "manual-cell-count", name: "Đếm tế bào bằng buồng đếm thủ công", category: "Cell counting", formula: "(TB trung bình / ô) × pha loãng × 10⁴", description: "Tính mật độ tế bào từ số đếm trong các ô của buồng đếm.", color: "teal" },
  { id: "cells-needed", name: "Tính số lượng tế bào cần", category: "Cell seeding", formula: "Mật độ × số đơn vị × thể tích", description: "Tính tổng số tế bào cần chuẩn bị cho kế hoạch seed.", color: "amber" },
  { id: "volume-to-take", name: "Tính thể tích cần lấy", category: "Cell seeding", formula: "N mong muốn / N tổng × V tổng", description: "Tính thể tích suspension cần hút để đạt số tế bào mong muốn.", color: "blue" },
];

type ExperimentRun = { run: string; date: string; ct: number; efficiency: number };
const experimentSeries: ExperimentRun[] = [];

type TeamMember = { id: number; name: string; email: string; role: "admin" | "researcher" | "viewer"; approvalStatus: "pending" | "approved" | "rejected"; loginMethod?: string | null; lastActive: string };

const initialTeam: TeamMember[] = [];

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "protocols", label: "Quy trình", icon: ClipboardList },
  { id: "samples", label: "Mẫu & lý thuyết", icon: FlaskConical },
  { id: "calculator", label: "Công cụ tính", icon: Calculator },
  { id: "special", label: "Thí nghiệm điều kiện đặc trưng", icon: Beaker },
  { id: "admin", label: "Quản trị nội dung", icon: Settings2 },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(value);
}

type VolumeUnit = "L" | "mL" | "µL";
type CellUnit = "cell/mL" | "cell/giếng" | "cell/flask" | "cell";
type DilutionSettings = { mode: DilutionMode; factor: string; initial: string; added: string };
type DilutionMode = "factor" | "volumes";
function volumeToMl(value: number, unit: VolumeUnit) { return unit === "L" ? value * 1000 : unit === "µL" ? value / 1000 : value; }
function mlToVolume(value: number, unit: VolumeUnit) { return unit === "L" ? value / 1000 : unit === "µL" ? value * 1000 : value; }

function UserAvatar({ name }: { name?: string | null }) {
  const initials = (name || "Lab").split(" ").map(part => part[0]).slice(-2).join("").toUpperCase();
  return <span className="avatar">{initials || "LV"}</span>;
}

type ProtocolRecord = { id: number; title: string; category: string; tag: string; status: Protocol["status"]; version: string; updatedAt: Date | string; owner: string; summary: string; duration: string; steps: unknown; notes: unknown };
type SampleRecord = { id: number; code: string; name: string; groupName: string; status: string; updatedAt: Date | string; description: string; properties: unknown; theory: string };
type RunRecord = { runCode: string; runDate: string; ctMean: string | number; efficiency: string | number };

function toProtocol(record: ProtocolRecord): Protocol {
  return { id: String(record.id), title: record.title, category: record.category, tag: record.tag, status: record.status, version: record.version, updatedAt: new Date(record.updatedAt).toLocaleDateString("vi-VN"), owner: record.owner, summary: record.summary, duration: record.duration, steps: Array.isArray(record.steps) ? record.steps as Protocol["steps"] : [], notes: Array.isArray(record.notes) ? record.notes as string[] : [] };
}

function toSample(record: SampleRecord): Sample {
  return { id: String(record.id), code: record.code, name: record.name, group: record.groupName, status: record.status, updatedAt: new Date(record.updatedAt).toLocaleDateString("vi-VN"), description: record.description, properties: Array.isArray(record.properties) ? record.properties as Sample["properties"] : [], theory: record.theory };
}

function toRun(record: RunRecord): ExperimentRun {
  return { run: record.runCode, date: record.runDate, ct: Number(record.ctMean), efficiency: Number(record.efficiency) };
}

export default function Home() {
  const user = { name: "Lab editor", role: "admin" as const };
  const role = "admin" as const;
  const isAdmin = true;
  const canEdit = true;
  const contentQuery = trpc.content.all.useQuery(undefined, { retry: false });
  const createDraftMutation = trpc.content.createDraft.useMutation({ onSuccess: async (_, variables) => { await contentQuery.refetch(); toast.success("Nội dung đã được lưu vào bản nháp."); if (variables.kind === "protocol" && (variables.category === "Hypoxia" || variables.category === "HighPressure")) { setSpecialCategory(variables.category); setView("special"); } }, onError: error => toast.error(error.message) });
  const createCalculatorMutation = trpc.content.createCalculator.useMutation({ onSuccess: async (_, variables) => { await contentQuery.refetch(); toast.success("Phương trình đã được tạo thành tool."); if (variables.category === "Hypoxia" || variables.category === "HighPressure") { setSpecialCategory(variables.category); setView("special"); } }, onError: error => toast.error(error.message) });
  const deleteCalculatorMutation = trpc.content.deleteCalculator.useMutation({ onSuccess: async () => { await contentQuery.refetch(); toast.success("Đã xoá công thức tính."); }, onError: error => toast.error(error.message) });
  const updateDraftMutation = trpc.content.updateDraft.useMutation({ onSuccess: async () => { await contentQuery.refetch(); toast.success("Nội dung đã được cập nhật."); }, onError: error => toast.error(error.message) });
  const deleteProtocolMutation = trpc.content.deleteProtocol.useMutation({ onSuccess: async () => { await contentQuery.refetch(); toast.success("Đã xóa quy trình khỏi kho."); }, onError: error => toast.error(error.message) });
  const [view, setView] = useState<View>("overview");
  const [specialCategory, setSpecialCategory] = useState<SpecialCategory>("Hypoxia");
  const [draftCategory, setDraftCategory] = useState<"Custom" | SpecialCategory>("Custom");
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [protocols, setProtocols] = useState(initialProtocols);
  const [samples, setSamples] = useState(initialSamples);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [selectedCalc, setSelectedCalc] = useState("dilution");
  const [c1, setC1] = useState("10");
  const [v1, setV1] = useState("20");
  const [c2, setC2] = useState("2");
  const [v2, setV2] = useState("100");
  const [volumeUnits, setVolumeUnits] = useState<Record<string, VolumeUnit>>({ dilution: "µL", molarity: "L", "cells-needed": "mL", "volume-to-take": "mL", "manual-cell-count": "µL" });
  const [cellUnits, setCellUnits] = useState<Record<string, CellUnit>>({ "cells-needed": "cell/mL", "volume-to-take": "cell" });
  const [dilutionSettings, setDilutionSettings] = useState<Record<string, DilutionSettings>>({ "manual-cell-count": { mode: "factor", factor: "2", initial: "1", added: "1" } });
  const [resultMode, setResultMode] = useState<"v1" | "v2">("v1");
  const [recent, setRecent] = useState<string[]>([]);
  const [draftType, setDraftType] = useState<"Quy trình" | "Mẫu" | "Lý thuyết" | "Phương trình">("Quy trình");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftOwner, setDraftOwner] = useState("Lab editor");
  const [draftBody, setDraftBody] = useState("");
  const [draftFormula, setDraftFormula] = useState("");
  const [draftInputUnits, setDraftInputUnits] = useState<Record<string, string>>({});
  const [draftOutputUnit, setDraftOutputUnit] = useState("");
  const [draftSteps, setDraftSteps] = useState<ProtocolStep[]>([{ title: "", detail: "", time: "" }]);
  const [runs, setRuns] = useState<ExperimentRun[]>(experimentSeries);
  const [calculatorTools, setCalculatorTools] = useState<CalculatorDefinition[]>(calculators);
  const volumeUnit = volumeUnits[selectedCalc] ?? "mL";
  const setVolumeUnit = (unit: VolumeUnit) => setVolumeUnits(current => ({ ...current, [selectedCalc]: unit }));
  const cellUnit = cellUnits[selectedCalc] ?? "cell/mL";
  const setCellUnit = (unit: CellUnit) => setCellUnits(current => ({ ...current, [selectedCalc]: unit }));
  const dilutionConfig = dilutionSettings[selectedCalc] ?? { mode: "factor" as DilutionMode, factor: "2", initial: "1", added: "1" };
  const dilutionMode = dilutionConfig.mode;
  const setDilutionMode = (mode: DilutionMode) => setDilutionSettings(current => ({ ...current, [selectedCalc]: { ...dilutionConfig, mode } }));
  const dilutionFactorValue = dilutionConfig.factor;
  const setDilutionFactorValue = (value: string) => setDilutionSettings(current => ({ ...current, [selectedCalc]: { ...dilutionConfig, factor: value } }));
  const dilutionInitialVolume = dilutionConfig.initial;
  const setDilutionInitialVolume = (value: string) => setDilutionSettings(current => ({ ...current, [selectedCalc]: { ...dilutionConfig, initial: value } }));
  const dilutionAddedVolume = dilutionConfig.added;
  const setDilutionAddedVolume = (value: string) => setDilutionSettings(current => ({ ...current, [selectedCalc]: { ...(current[selectedCalc] ?? dilutionConfig), added: value } }));

  useEffect(() => {
    if (!contentQuery.data) return;
    setProtocols((contentQuery.data.protocols as ProtocolRecord[]).map(toProtocol));
    setSamples((contentQuery.data.samples as SampleRecord[]).map(toSample));
    setRuns((contentQuery.data.runs as RunRecord[]).map(toRun));
    const databaseCalculators = (contentQuery.data.calculators as CalculatorRecord[]).filter(item => item.active !== 0).map(item => ({ id: item.slug, dbId: item.id, config: item.config, name: item.name, category: item.category, formula: item.formula, description: item.description, color: item.category === "Cell counting" ? "teal" : item.category === "Cell seeding" ? "amber" : "blue" }));
    setCalculatorTools(databaseCalculators);
    if (!databaseCalculators.some(item => item.id === selectedCalc)) setSelectedCalc(databaseCalculators[0]?.id ?? "");
  }, [contentQuery.data]);

  const filteredProtocols = useMemo(() => protocols.filter(item => `${item.title} ${item.category} ${item.tag} ${item.summary}`.toLowerCase().includes(search.toLowerCase())), [protocols, search]);
  const filteredSamples = useMemo(() => samples.filter(item => `${item.name} ${item.code} ${item.group} ${item.description}`.toLowerCase().includes(search.toLowerCase())), [samples, search]);
  const calculationResult = useMemo(() => {
    const values = [Number(c1), Number(v1), Number(c2), Number(v2)];
    const positive = (value: number) => Number.isFinite(value) && value > 0;
    const dilutionFactor = dilutionMode === "factor" ? Number(dilutionFactorValue) : (Number(dilutionInitialVolume) + Number(dilutionAddedVolume)) / Number(dilutionInitialVolume);
    if (selectedCalc === "dilution") {
      if (![values[0], values[2], volumeToMl(values[1], volumeUnit), volumeToMl(values[3], volumeUnit)].every(positive)) return null;
      return resultMode === "v1" ? mlToVolume((values[2] * volumeToMl(values[3], volumeUnit)) / values[0], volumeUnit) : mlToVolume((values[0] * volumeToMl(values[1], volumeUnit)) / values[2], volumeUnit);
    }
    if (selectedCalc === "viability") return positive(values[0]) && positive(values[1]) ? (values[0] / values[1]) * 100 : null;
    if (selectedCalc === "molarity") return positive(values[0]) && positive(values[1]) && positive(values[2]) ? values[0] * (volumeToMl(values[1], volumeUnit) / 1000) * values[2] : null;
    if (selectedCalc === "manual-cell-count") return [values[0], values[1], dilutionFactor].every(positive) && (dilutionMode !== "volumes" || (positive(Number(dilutionInitialVolume)) && Number(dilutionAddedVolume) >= 0)) ? (values[0] / values[1]) * dilutionFactor * 10000 : null;
    if (selectedCalc === "cells-needed") return calculateCellsNeeded(values[0], cellUnit, values[1], values[2], volumeUnit);
    if (selectedCalc === "volume-to-take") return calculateVolumeToTake(values[0], values[1], cellUnit, values[2], volumeUnit, values[3]);
    return null;
  }, [c1, v1, c2, v2, volumeUnit, cellUnit, dilutionMode, dilutionFactorValue, dilutionInitialVolume, dilutionAddedVolume, resultMode, selectedCalc]);

  const currentView = navItems.find(item => item.id === view);
  const openProtocol = (protocol: Protocol) => { setSelectedProtocol(protocol); setView("protocols"); };
  const openSample = (sample: Sample) => { setSelectedSample(sample); setView("samples"); };
  const editProtocol = (protocol: Protocol) => { setEditingId(protocol.id); setDraftType("Quy trình"); setDraftCategory(protocol.category === "Hypoxia" || protocol.category === "HighPressure" ? protocol.category : "Custom"); if (protocol.category === "Hypoxia" || protocol.category === "HighPressure") setSpecialCategory(protocol.category); setDraftTitle(protocol.title); setDraftOwner(protocol.owner); setDraftBody(protocol.summary); setDraftSteps(protocol.steps.length ? protocol.steps : [{ title: "", detail: "", time: "" }]); setSelectedProtocol(null); setView("createProtocol"); };
  const editSample = (sample: Sample) => { setEditingId(sample.id); setDraftType("Mẫu"); setDraftTitle(sample.name); setDraftBody(sample.description); setSelectedSample(null); setView("admin"); };
  const startCreateProtocol = (category: "Custom" | SpecialCategory = "Custom") => { setDraftCategory(category); setDraftType("Quy trình"); setEditingId(null); setDraftTitle(""); setDraftOwner("Lab editor"); setDraftBody(""); setDraftSteps([{ title: "", detail: "", time: "" }]); setView("createProtocol"); };
  const startCreateSample = () => { setDraftType("Mẫu"); setEditingId(null); setDraftTitle(""); setDraftOwner("Lab editor"); setDraftBody(""); setView("admin"); };
  const startCreateCalculator = (category: "Custom" | SpecialCategory = "Custom") => { setDraftCategory(category); setDraftType("Phương trình"); setEditingId(null); setDraftTitle(""); setDraftOwner("Lab editor"); setDraftBody(""); setDraftFormula(""); setDraftInputUnits({}); setDraftOutputUnit(""); setView("admin"); };
  const handleSaveDraft = () => {
    if (!draftTitle.trim()) return toast.error("Vui lòng nhập tên nội dung.");
    if (draftType === "Quy trình" && !draftOwner.trim()) return toast.error("Vui lòng nhập tên người viết quy trình.");
    if (!canEdit) return toast.error("Viewer chỉ có quyền tra cứu.");
    if (draftType === "Phương trình") {
      if (!draftFormula.trim()) return toast.error("Nhập công thức trước khi lưu tool.");
      let variables: string[];
      try { variables = getFormulaVariables(draftFormula); } catch (error) { return toast.error(error instanceof Error ? error.message : "Công thức không hợp lệ."); }
      createCalculatorMutation.mutate({ name: draftTitle, formula: draftFormula, description: draftBody, category: draftCategory, inputUnits: Object.fromEntries(variables.map(variable => [variable, draftInputUnits[variable] ?? ""])), outputUnit: draftOutputUnit });
    } else {
      const kind = draftType === "Quy trình" ? "protocol" : "sample";
      const steps = kind === "protocol" ? draftSteps.filter(step => step.title.trim()) : undefined;
      if (editingId) updateDraftMutation.mutate({ id: Number(editingId), kind, title: draftTitle, body: draftBody, owner: draftOwner, steps });
      else createDraftMutation.mutate({ kind, title: draftTitle, body: draftBody, owner: draftOwner, category: kind === "protocol" ? draftCategory : "Custom", steps });
    }
    setEditingId(null);
    setDraftTitle(""); setDraftOwner("Lab editor"); setDraftBody("");
  };
  const confirmTwice = (message: string) => window.confirm(`${message}\n\nXác nhận lần 1/2`) && window.confirm(`${message}\n\nXác nhận lần 2/2 — thao tác không thể hoàn tác.`);
  const clearCalculationHistory = () => { if (recent.length && confirmTwice("Xoá toàn bộ lịch sử phép tính?")) setRecent([]); };
  const deleteCalculation = (index: number) => { if (confirmTwice("Xoá phép tính này khỏi lịch sử?")) setRecent(current => current.filter((_, position) => position !== index)); };
  const handleDeleteCalculator = (id: string) => { const dbId = calculatorTools.find(calculator => calculator.id === id)?.dbId; if (isAdmin && dbId && confirmTwice("Xoá công thức tính này?")) deleteCalculatorMutation.mutate({ id: dbId }); };
  const handleDeleteProtocol = (id: string) => { if (!isAdmin) return toast.error("Chỉ Admin mới có quyền xóa quy trình."); deleteProtocolMutation.mutate({ id: Number(id) }); setSelectedProtocol(null); };
  const runCalculation = () => { if (!canEdit) return toast.error("Viewer chỉ có quyền tra cứu."); if (calculationResult === null) return toast.error("Tool này cần các trường số hợp lệ hoặc chưa có bộ tính tự động."); const unit = selectedCalc === "viability" ? "%" : selectedCalc === "molarity" ? "g" : selectedCalc === "volume-to-take" || selectedCalc === "dilution" ? volumeUnit : selectedCalc === "manual-cell-count" ? "cell/mL" : selectedCalc === "cells-needed" ? "cells" : volumeUnit; const label = `${formatNumber(calculationResult)} ${unit}`; const line = `${calculatorTools.find(calc => calc.id === selectedCalc)?.name || "Calculation"} · ${label} · ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`; setRecent(current => [line, ...current].slice(0, 4)); toast.success("Đã tính và lưu vào lịch sử phiên."); };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand-lockup"><span className="brand-mark">LV</span><span>labvault</span></div>
          <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Đóng menu"><X size={18} /></button>
          <div className="workspace-badge"><span className="status-dot" /> PUBLIC LAB WORKSPACE <span className="workspace-code">#07</span></div>
        </div>
        <div className="nav-caption">Workspace</div>
        <nav className="main-nav">
          {navItems.filter(item => item.id !== "admin" || isAdmin).map(item => { const Icon = item.icon; return <div key={item.id}><button className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => { setView(item.id); setSelectedProtocol(null); setSelectedSample(null); setMobileNav(false); }}><Icon size={17} /><span>{item.label}</span>{item.id === "protocols" && <span className="nav-count">{protocols.length}</span>}</button>{item.id === "special" && <div className="special-subnav">{(["Hypoxia", "HighPressure"] as const).map(key => <button key={key} className={view === "special" && specialCategory === key ? "active" : ""} onClick={() => { setSpecialCategory(key); setView("special"); setMobileNav(false); }}>{SPECIAL_CATEGORY_LABEL[key]}</button>)}</div>}</div>; })}
        </nav>
        <div className="sidebar-rule" />
        <div className="nav-caption">Ghim nhanh</div>
        <div className="pinned-list"><button onClick={() => openProtocol(protocols[0])}><span className="pin-line teal" />qPCR / DNA quantification</button><button onClick={() => openSample(samples[0])}><span className="pin-line amber" />HeLa cell lysate</button><button onClick={() => { setView("calculator"); setSelectedCalc("dilution"); }}><span className="pin-line blue" />Pha loãng nồng độ</button></div>
        <div className="sidebar-bottom"><div className="sync-note"><span className="sync-icon"><Check size={12} /></span><span><strong>Đã đồng bộ</strong><small>{contentQuery.isFetching ? "Đang cập nhật…" : "Chỉnh sửa trực tiếp"}</small></span></div><button className="user-row" onClick={() => toast.success("Chỉnh sửa trực tiếp đang bật cho workspace này.")}><UserAvatar name={user?.name} /><span><strong>{user?.name || "Lab member"}</strong><small>{role === "admin" ? "Admin" : role === "viewer" ? "Viewer" : "Researcher"}</small></span><span className="panel-index">PUBLIC</span></button></div>
      </aside>
      {mobileNav && <button className="mobile-overlay" onClick={() => setMobileNav(false)} aria-label="Đóng menu" />}

      <main className="main-canvas">
        <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Mở menu"><Menu size={20} /></button><div className="breadcrumb"><span>LabVault</span><ChevronRight size={13} /><strong>{currentView?.label}</strong></div></div><div className="topbar-actions"><div className="global-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm quy trình, mẫu, chủ đề…" /><kbd>⌘ K</kbd></div><div className="topbar-avatar"><UserAvatar name={user?.name} /></div></div></header>
        <div className="page-wrap">
          {view === "overview" && <Overview userName={user?.name} role={role} protocols={protocols} samples={samples} runs={runs} openProtocol={openProtocol} openSample={openSample} setView={setView} />}
          {view === "protocols" && <ProtocolsView protocols={filteredProtocols} selected={selectedProtocol} setSelected={setSelectedProtocol} openProtocol={openProtocol} onEdit={editProtocol} onDelete={handleDeleteProtocol} onCreate={() => startCreateProtocol()} canEdit={canEdit} canDelete={isAdmin} search={search} />}
          {view === "samples" && <SamplesView samples={filteredSamples} selected={selectedSample} setSelected={setSelectedSample} openSample={openSample} onCreate={startCreateSample} search={search} />}
          {view === "calculator" && <CalculatorView tools={calculatorTools} onDesign={() => startCreateCalculator()} selectedCalc={selectedCalc} setSelectedCalc={setSelectedCalc} c1={c1} v1={v1} c2={c2} v2={v2} setC1={setC1} setV1={setV1} setC2={setC2} setV2={setV2} resultMode={resultMode} setResultMode={setResultMode} result={calculationResult} runCalculation={runCalculation} recent={recent} clearHistory={clearCalculationHistory} deleteCalculation={deleteCalculation} canCalculate={canEdit} volumeUnit={volumeUnit} setVolumeUnit={setVolumeUnit} cellUnit={cellUnit} setCellUnit={setCellUnit} dilutionMode={dilutionMode} setDilutionMode={setDilutionMode} dilutionFactorValue={dilutionFactorValue} setDilutionFactorValue={setDilutionFactorValue} dilutionInitialVolume={dilutionInitialVolume} setDilutionInitialVolume={setDilutionInitialVolume} dilutionAddedVolume={dilutionAddedVolume} setDilutionAddedVolume={setDilutionAddedVolume} />}
          {view === "special" && <SpecialExperimentsView protocols={protocols} tools={calculatorTools} category={specialCategory} setCategory={setSpecialCategory} openProtocol={protocol => { const full = protocols.find(item => item.id === protocol.id); if (full) openProtocol(full); }} openTool={id => { setSelectedCalc(id); setView("calculator"); }} createProtocol={startCreateProtocol} createTool={startCreateCalculator} />}
          {view === "admin" && isAdmin && <AdminView protocols={protocols} samples={samples} draftOwner={draftOwner} setDraftOwner={setDraftOwner} calculators={calculatorTools} onDeleteCalculator={handleDeleteCalculator} onCreateProtocol={() => startCreateProtocol()} draftType={draftType} setDraftType={setDraftType} draftTitle={draftTitle} setDraftTitle={setDraftTitle} draftBody={draftBody} setDraftBody={setDraftBody} draftFormula={draftFormula} setDraftFormula={setDraftFormula} draftInputUnits={draftInputUnits} setDraftInputUnits={setDraftInputUnits} draftOutputUnit={draftOutputUnit} setDraftOutputUnit={setDraftOutputUnit} onSave={handleSaveDraft} draftCategory={draftCategory} setDraftCategory={setDraftCategory} onDeleteProtocol={handleDeleteProtocol} onEditSample={editSample} />}
          {view === "createProtocol" && canEdit && <ProtocolEditorPage title={draftTitle} owner={draftOwner} body={draftBody} steps={draftSteps} category={draftCategory} setTitle={setDraftTitle} setOwner={setDraftOwner} setBody={setDraftBody} setSteps={setDraftSteps} onSave={handleSaveDraft} onCancel={() => setView(draftCategory === "Custom" ? "protocols" : "special")} />}
        </div>
      </main>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: React.ReactNode; description: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Overview({ userName, role, protocols, samples, runs, openProtocol, openSample, setView }: { userName?: string | null; role: "admin" | "researcher" | "viewer"; protocols: Protocol[]; samples: Sample[]; runs: ExperimentRun[]; openProtocol: (p: Protocol) => void; openSample: (s: Sample) => void; setView: (v: View) => void }) {
  return <>
    <PageIntro eyebrow={`02 OCTOBER 2026 · LAB CONTROL DESK · ${role.toUpperCase()}`} title={<>Chào {userName?.split(" ").slice(-1)[0] || "bạn"}, <em>mình bắt đầu nhé.</em></>} description="Mọi thứ đội ngũ cần để tái lập một thí nghiệm — ở đúng nơi, đúng phiên bản." action={<div className="intro-actions"><span className="last-sync"><span className="status-dot" /> Live sync</span><Button onClick={() => setView("calculator")} className="primary-cta"><Calculator size={16} /> Mở calculator</Button></div>} />
    <section className="signal-strip"><div className="signal-main"><span className="signal-kicker">Signal / 01</span><h2>Kho đang vận hành ổn định</h2><p>{protocols.filter(protocol => protocol.status === "Đã duyệt").length} quy trình đã duyệt · {samples.length} mẫu có dữ liệu · {runs.length} run đã đồng bộ</p></div><div className="signal-stat"><strong>{protocols.length ? "98.6%" : "—"}</strong><span>compliance score</span></div><div className="signal-stat"><strong>{runs.length ? "14" : "—"} <small>{runs.length ? "min" : ""}</small></strong><span>tra cứu trung bình</span></div><div className="signal-visual"><span className="bar bar-1" /><span className="bar bar-2" /><span className="bar bar-3" /><span className="bar bar-4" /><span className="bar bar-5" /><span className="bar bar-6" /></div></section>
    <div className="overview-grid"><section className="content-panel focus-panel"><div className="panel-heading"><div><span className="panel-index">01 / FOCUS</span><h2>Quy trình dùng gần đây</h2></div><button className="text-button" onClick={() => setView("protocols")}>Xem tất cả <ArrowLeft size={14} className="flip-x" /></button></div><div className="protocol-list">{protocols.slice(0, 3).map((protocol, index) => <button className="protocol-row" key={protocol.id} onClick={() => openProtocol(protocol)}><span className="row-number">0{index + 1}</span><span className="row-main"><strong>{protocol.title}</strong><span>{protocol.category} <i>·</i> {protocol.duration}</span></span><span className={`status-pill ${protocol.status === "Đã duyệt" ? "approved" : "draft"}`}>{protocol.status}</span><ChevronRight size={16} /></button>)}</div></section><section className="content-panel sample-panel"><div className="panel-heading"><div><span className="panel-index">02 / SAMPLE INDEX</span><h2>Mẫu mới cập nhật</h2></div><button className="icon-button" onClick={() => setView("samples")}><MoreHorizontal size={18} /></button></div><div className="sample-stack">{samples.slice(0, 3).map(sample => <button className="sample-row" key={sample.id} onClick={() => openSample(sample)}><span className="sample-symbol"><Beaker size={16} /></span><span><strong>{sample.name}</strong><small>{sample.code} · {sample.updatedAt}</small></span><ChevronRight size={15} /></button>)}</div><div className="mini-theory"><Sparkles size={15} /><span><strong>Lab note</strong> — “Matrix matching” giúp giảm bias khi đọc assay màu.</span></div></section></div>
    <ExperimentChart runs={runs} />
    <section className="quick-tools"><div className="quick-title"><span className="panel-index">03 / QUICK ACCESS</span><h2>Công cụ & tri thức</h2><p>Đi thẳng đến phần bạn cần trong ca làm việc.</p></div><button onClick={() => setView("calculator")} className="tool-card tool-teal"><span className="tool-icon"><Calculator size={19} /></span><strong>Pha loãng nồng độ</strong><small>C₁V₁ = C₂V₂</small><ChevronRight size={16} /></button><button onClick={() => setView("protocols")} className="tool-card tool-cream"><span className="tool-icon"><BookOpen size={19} /></span><strong>Protocol handbook</strong><small>Guides · notes · versions</small><ChevronRight size={16} /></button><button onClick={() => setView("samples")} className="tool-card tool-ink"><span className="tool-icon"><Archive size={19} /></span><strong>Sample theory</strong><small>Properties · references</small><ChevronRight size={16} /></button></section>
  </>;
}

function ExperimentChart({ runs }: { runs: ExperimentRun[] }) {
  const averageCt = runs.length ? runs.reduce((sum, item) => sum + item.ct, 0) / runs.length : 0;
  const averageEfficiency = runs.length ? runs.reduce((sum, item) => sum + item.efficiency, 0) / runs.length : 0;
  return <section className="content-panel experiment-panel"><div className="panel-heading"><div><span className="panel-index">04 / EXPERIMENT SIGNAL · PROTECTED RUN DATA</span><h2>Độ ổn định qPCR trong các run gần nhất</h2></div><div className="chart-legend"><span><i className="legend-dot teal" /> Ct mean</span><span><i className="legend-dot amber" /> Efficiency %</span></div></div><div className="chart-summary"><div><strong>{averageCt ? averageCt.toFixed(2) : "—"}</strong><span>Ct trung bình</span></div><div><strong>{averageEfficiency ? `${averageEfficiency.toFixed(1)}%` : "—"}</strong><span>efficiency trung bình</span></div><div className="chart-caption"><BarChart3 size={16} /> {runs.length ? `${runs.length} run đã đồng bộ từ MySQL` : "Chưa có run được đồng bộ"}</div></div>{runs.length ? <div className="chart-frame"><ResponsiveContainer width="100%" height={190}><AreaChart data={runs} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}><defs><linearGradient id="ctFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d5c63" stopOpacity={0.22} /><stop offset="100%" stopColor="#0d5c63" stopOpacity={0.02} /></linearGradient><linearGradient id="effFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c9822b" stopOpacity={0.18} /><stop offset="100%" stopColor="#c9822b" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="#e0e4dd" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fill: "#8b958e", fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis yAxisId="ct" domain={[22, 26]} tick={{ fill: "#8b958e", fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis yAxisId="eff" orientation="right" domain={[88, 102]} hide /><Tooltip contentStyle={{ border: "1px solid #d9ddd5", borderRadius: 7, background: "#fffefa", fontSize: 11 }} labelStyle={{ color: "#18221f", fontWeight: 600 }} /><Area yAxisId="ct" type="monotone" dataKey="ct" name="Ct mean" stroke="#0d5c63" strokeWidth={2} fill="url(#ctFill)" dot={{ r: 3, fill: "#0d5c63", strokeWidth: 0 }} /><Area yAxisId="eff" type="monotone" dataKey="efficiency" name="Efficiency %" stroke="#c9822b" strokeWidth={2} fill="url(#effFill)" dot={{ r: 3, fill: "#c9822b", strokeWidth: 0 }} /></AreaChart></ResponsiveContainer></div> : <div className="empty-state"><BarChart3 size={24} /><h3>Chưa có run dữ liệu</h3><p>Khi import run vào kho, biểu đồ sẽ cập nhật tại đây.</p></div>}<div className="chart-footer"><span>Source: protected experimentRuns · chỉ người dùng được cấp quyền mới thấy dữ liệu</span><span className="chart-status"><span className="status-dot" /> {runs.length ? "Within review range" : "Awaiting run"}</span></div></section>;
}

function ProtocolsView({ protocols, selected, setSelected, openProtocol, onEdit, onDelete, onCreate, canEdit, canDelete, search }: { protocols: Protocol[]; selected: Protocol | null; setSelected: (p: Protocol | null) => void; openProtocol: (p: Protocol) => void; onEdit: (protocol: Protocol) => void; onDelete: (id: string) => void; onCreate: () => void; canEdit: boolean; canDelete: boolean; search: string }) {
  if (selected) return <ProtocolDetail protocol={selected} onBack={() => setSelected(null)} onEdit={() => onEdit(selected)} onDelete={onDelete} canEdit={canEdit} canDelete={canDelete} />;
  return <><PageIntro eyebrow="PROTOCOL HANDBOOK / 12 ENTRIES" title={<>Quy trình <em>đã được kiểm chứng.</em></>} description="Các phiên bản thao tác được review và lưu theo từng assay, để mỗi lần chạy đều có cùng một điểm bắt đầu." action={canEdit ? <Button className="primary-cta" onClick={onCreate}><Plus size={16} /> Thêm quy trình</Button> : <span className="last-sync"><ShieldCheck size={13} /> Viewer · read only</span>} /><div className="filter-row"><div className="filter-label"><ClipboardList size={15} /> {protocols.length} protocol {search && <span>cho “{search}”</span>}</div><div className="filter-chips"><button className="filter-chip active">Tất cả</button><button className="filter-chip">Đã duyệt <span>2</span></button><button className="filter-chip">Bản nháp <span>1</span></button></div></div><div className="protocol-cards">{protocols.map(protocol => <button key={protocol.id} className="protocol-card" onClick={() => openProtocol(protocol)}><div className="protocol-card-top"><span className="protocol-tag">{protocol.tag}</span><span className={`status-pill ${protocol.status === "Đã duyệt" ? "approved" : "draft"}`}>{protocol.status}</span></div><h2>{protocol.title}</h2><p>{protocol.summary}</p><div className="protocol-card-meta"><span><Clock3 size={13} /> {protocol.duration}</span><span><FilePenLine size={13} /> {protocol.version}</span><span className="meta-owner"><UserRound size={13} /> {protocol.owner}</span><ChevronRight size={16} /></div></button>)}</div></>;
}

function ProtocolDetail({ protocol, onBack, onEdit, onDelete, canEdit, canDelete }: { protocol: Protocol; onBack: () => void; onEdit: () => void; onDelete: (id: string) => void; canEdit: boolean; canDelete: boolean }) {
  return <><button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Tất cả quy trình</button><div className="detail-header"><div><span className="protocol-tag">{protocol.tag}</span><h1>{protocol.title}</h1><p>{protocol.summary}</p><div className="detail-meta"><span className={`status-pill ${protocol.status === "Đã duyệt" ? "approved" : "draft"}`}>{protocol.status}</span><span>Version {protocol.version}</span><span>Updated {protocol.updatedAt}</span><span>Owner {protocol.owner}</span></div></div><div className="detail-actions">{canEdit && <Button variant="outline" onClick={onEdit}><FilePenLine size={15} /> Chỉnh sửa</Button>}{canDelete && <button className="icon-button danger" onClick={() => onDelete(protocol.id)}><Trash2 size={16} /></button>}</div></div><div className="detail-layout"><section className="content-panel steps-panel"><div className="panel-heading"><div><span className="panel-index">RUNBOOK / SEQUENCE</span><h2>Trình tự thực hiện</h2></div><span className="duration-chip"><Clock3 size={14} /> {protocol.duration}</span></div><div className="step-list">{protocol.steps.map((step, index) => <div className="step-item" key={step.title}><div className="step-marker"><span>0{index + 1}</span></div><div className="step-content"><div className="step-heading"><h3>{step.title}</h3><span>{step.time}</span></div><p>{step.detail}</p></div></div>)}</div></section><aside className="detail-side"><div className="content-panel note-panel"><div className="panel-index">CHECK BEFORE RUN</div><h3>Lưu ý quan trọng</h3><ul>{protocol.notes.map(note => <li key={note}>{note}</li>)}</ul></div><div className="content-panel related-panel"><div className="panel-index">RELATED DATA</div><h3>Được dùng cùng</h3><button><Beaker size={16} /><span><strong>DNA standard mix</strong><small>Reference sample</small></span><ChevronRight size={14} /></button><button><Calculator size={16} /><span><strong>qPCR efficiency</strong><small>Calculator</small></span><ChevronRight size={14} /></button></div></aside></div></>;
}

function SamplesView({ samples, selected, setSelected, openSample, onCreate, search }: { samples: Sample[]; selected: Sample | null; setSelected: (s: Sample | null) => void; openSample: (s: Sample) => void; onCreate: () => void; search: string }) {
  if (selected) return <SampleDetail sample={selected} onBack={() => setSelected(null)} />;
  return <><PageIntro eyebrow="SAMPLE INDEX / REFERENCE LIBRARY" title={<>Mẫu có <em>context.</em></>} description="Từ đặc tính vật lý đến lý thuyết nền — mọi reference đều nằm cạnh nơi đội ngũ sử dụng nó." action={<Button className="primary-cta" onClick={onCreate}><Plus size={16} /> Thêm mẫu</Button>} /><div className="sample-filter"><span><FlaskConical size={15} /> {samples.length} entries</span><div><button className="filter-chip active">Tất cả mẫu</button><button className="filter-chip">Cell lysate</button><button className="filter-chip">Nucleic acid</button></div></div><div className="sample-grid">{samples.map(sample => <button className="sample-card" key={sample.id} onClick={() => openSample(sample)}><div className="sample-card-icon"><Beaker size={22} /></div><div className="sample-card-code">{sample.code}</div><h2>{sample.name}</h2><p>{sample.description}</p><div className="property-preview">{sample.properties.slice(0, 2).map(prop => <span key={prop.label}><small>{prop.label}</small><strong>{prop.value}</strong></span>)}</div><div className="sample-card-footer"><span>{sample.group}</span><span>{sample.updatedAt} <ChevronRight size={14} /></span></div></button>)}</div>{search && samples.length === 0 && <div className="empty-state"><Search size={24} /><h3>Chưa có reference phù hợp</h3><p>Thử một từ khóa khác hoặc bỏ bộ lọc tìm kiếm.</p></div>}</>;
}

function SampleDetail({ sample, onBack }: { sample: Sample; onBack: () => void }) {
  return <><button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Tất cả mẫu</button><div className="detail-header sample-detail-header"><div><div className="sample-card-code">{sample.code}</div><h1>{sample.name}</h1><p>{sample.description}</p><div className="detail-meta"><span className="status-pill approved">{sample.status}</span><span>{sample.group}</span><span>Updated {sample.updatedAt}</span></div></div><div className="sample-card-icon large"><Beaker size={28} /></div></div><div className="sample-detail-grid"><section className="content-panel"><div className="panel-index">01 / PROPERTIES</div><h2>Đặc tính & dữ liệu tham chiếu</h2><div className="properties-grid">{sample.properties.map(prop => <div key={prop.label}><small>{prop.label}</small><strong>{prop.value}</strong></div>)}</div></section><section className="content-panel theory-panel"><div className="panel-index">02 / THEORY NOTE</div><h2>Lý thuyết về mẫu</h2><p>{sample.theory}</p><div className="theory-source"><BookOpen size={15} /><span>Internal lab note · Reviewed by Lab owner</span></div></section></div></>;
}

function CalculatorView({ tools, onDesign, selectedCalc, setSelectedCalc, c1, v1, c2, v2, setC1, setV1, setC2, setV2, resultMode, setResultMode, result, runCalculation, recent, clearHistory, deleteCalculation, canCalculate, volumeUnit, setVolumeUnit, cellUnit, setCellUnit, dilutionMode, setDilutionMode, dilutionFactorValue, setDilutionFactorValue, dilutionInitialVolume, setDilutionInitialVolume, dilutionAddedVolume, setDilutionAddedVolume }: { tools: CalculatorDefinition[]; onDesign: () => void; selectedCalc: string; setSelectedCalc: (id: string) => void; c1: string; v1: string; c2: string; v2: string; setC1: (v: string) => void; setV1: (v: string) => void; setC2: (v: string) => void; setV2: (v: string) => void; resultMode: "v1" | "v2"; setResultMode: (m: "v1" | "v2") => void; result: number | null; runCalculation: () => void; recent: string[]; clearHistory: () => void; deleteCalculation: (index: number) => void; canCalculate: boolean; volumeUnit: VolumeUnit; setVolumeUnit: (unit: VolumeUnit) => void; cellUnit: CellUnit; setCellUnit: (unit: CellUnit) => void; dilutionMode: DilutionMode; setDilutionMode: (mode: DilutionMode) => void; dilutionFactorValue: string; setDilutionFactorValue: (value: string) => void; dilutionInitialVolume: string; setDilutionInitialVolume: (value: string) => void; dilutionAddedVolume: string; setDilutionAddedVolume: (value: string) => void }) {
  const activeCalc = tools.find(calc => calc.id === selectedCalc) || tools[0];
  const isDilution = selectedCalc === "dilution";
  const isManualCount = selectedCalc === "manual-cell-count";
  const isCellsNeeded = selectedCalc === "cells-needed";
  const isVolumeToTake = selectedCalc === "volume-to-take";
  const renderField = (label: string, help: string, value: string, setter: (value: string) => void, unit: string) => <label>{label}<span>{help}</span><div><Input value={value} onChange={event => setter(event.target.value)} inputMode="decimal" /><b>{unit}</b></div></label>;
  const unitSelect = (label: string, value: string, options: string[], setter: (value: string) => void) => <label className="field-label">{label}<select value={value} onChange={event => setter(event.target.value)}>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>;
  if (!tools.length) return <><PageIntro eyebrow="CALCULATION DESK" title={<>Công cụ <em>tính toán.</em></>} description="Chưa có công thức tính nào." action={<Button onClick={onDesign}>Tạo công thức</Button>} /></>;
  const calculatorPicker = <nav className="calculator-picker" aria-label="Chọn công cụ tính">{tools.map(tool => <button key={tool.id} className={tool.id === activeCalc.id ? "active" : ""} onClick={() => setSelectedCalc(tool.id)}>{tool.name}</button>)}</nav>;
  if (activeCalc.id === "hypoxia-headspace") return <><PageIntro eyebrow="CONDITION TOOL / HYPOXIA" title={<>Ước tính O₂ <em>trong hệ kín.</em></>} description="Kiểm tra ngân sách O₂ pha khí, không dự đoán pO₂ tại tế bào." />{calculatorPicker}<HypoxiaCalculator /></>;
  if (["Custom", "Hypoxia", "HighPressure"].includes(activeCalc.category)) return <><PageIntro eyebrow="CUSTOM CALCULATOR" title={<>Công cụ tính <em>theo công thức.</em></>} description="Nhập biến rồi tính ngay bằng công thức đã lưu." />{calculatorPicker}<CustomCalculator key={activeCalc.id} name={activeCalc.name} formula={activeCalc.formula} description={activeCalc.description} config={activeCalc.config} /></>;
  return <><PageIntro eyebrow={`CALCULATION DESK / ${tools.length} TOOLS`} title={<>Số liệu rõ ràng, <em>quyết định chắc tay.</em></>} description="Các công thức nhỏ, những điểm kiểm tra quan trọng — được gói trong một workflow nhất quán." action={<Button className="primary-cta" onClick={onDesign}><FilePenLine size={16} /> Thiết kế page công cụ</Button>} /><div className="calculator-layout"><aside className="calculator-nav content-panel"><div className="panel-index">AVAILABLE TOOLS</div>{tools.map(calc => <button key={calc.id} className={`calc-nav-item ${selectedCalc === calc.id ? "active" : ""}`} onClick={() => setSelectedCalc(calc.id)}><span className={`calc-dot ${calc.color}`} /><span><strong>{calc.name}</strong><small>{calc.category}</small></span><ChevronRight size={14} /></button>)}<div className="calculator-tip"><Sparkles size={14} /><span>Công thức được cấu hình bởi owner và version hóa cùng protocol.</span></div></aside><section className="calc-workbench"><div className="formula-card"><span className="panel-index">FORMULA / {activeCalc.id.toUpperCase()}</span><div className="formula-title"><div><h2>{activeCalc.name}</h2><p>{activeCalc.description}</p></div><div className="formula">{activeCalc.formula}</div></div></div><div className="calc-form-card content-panel">{(isDilution || selectedCalc === "molarity" || isCellsNeeded || isVolumeToTake || (isManualCount && dilutionMode === "volumes")) && unitSelect("Đơn vị thể tích", volumeUnit, ["L", "mL", "µL"], value => setVolumeUnit(value as VolumeUnit))}{(isCellsNeeded || isVolumeToTake) && unitSelect(isVolumeToTake ? "Đơn vị số tế bào hiện có" : "Đơn vị mục tiêu", cellUnit, ["cell", "cell/mL", "cell/giếng", "cell/flask"], value => setCellUnit(value as CellUnit))}{isManualCount && <div className="result-toggle"><span>Cách tính hệ số pha loãng</span><button className={dilutionMode === "factor" ? "active" : ""} onClick={() => setDilutionMode("factor")}>Dùng hệ số</button><button className={dilutionMode === "volumes" ? "active" : ""} onClick={() => setDilutionMode("volumes")}>Từ thể tích ban đầu + thể tích pha thêm</button></div>}<div className="calc-input-grid">{isDilution ? <>{renderField("C₁", "Nồng độ stock", c1, setC1, "mg/mL")}{renderField("V₁", "Thể tích stock", v1, setV1, volumeUnit)}{renderField("C₂", "Nồng độ mong muốn", c2, setC2, "mg/mL")}{renderField("V₂", "Thể tích cuối", v2, setV2, volumeUnit)}</> : selectedCalc === "viability" ? <>{renderField("Sống", "Số tế bào sống", c1, setC1, "cells")}{renderField("Tổng", "Tổng số tế bào", v1, setV1, "cells")}</> : isManualCount ? <>{renderField("Tổng số tế bào đếm được", "Tổng trong các ô đã đếm", c1, setC1, "cells")}{renderField("Số ô đã đếm", "Số ô lớn / ô vuông", v1, setV1, "ô")}{dilutionMode === "factor" ? renderField("Hệ số pha loãng", "Ví dụ 2 nếu pha 1:1", dilutionFactorValue, setDilutionFactorValue, "×") : <>{renderField("Thể tích ban đầu", "Thể tích mẫu trước pha", dilutionInitialVolume, setDilutionInitialVolume, volumeUnit)}{renderField("Thể tích pha thêm", "Thể tích dung dịch pha thêm", dilutionAddedVolume, setDilutionAddedVolume, volumeUnit)}</>}</> : isCellsNeeded ? <>{renderField("Mật độ mục tiêu", "Mật độ tế bào cần seed", c1, setC1, cellUnit)}{cellUnit !== "cell" && renderField("Số đơn vị", "Số giếng hoặc flask", v1, setV1, "đơn vị")}{cellUnit === "cell/mL" && renderField("Thể tích / đơn vị", "Thể tích môi trường mỗi đơn vị", c2, setC2, volumeUnit)}</> : isVolumeToTake ? <>{renderField("Số tế bào mong muốn", "Tổng số tế bào cần lấy", c1, setC1, "cell")}{renderField(cellUnit === "cell" ? "Tổng số tế bào hiện có" : "Số tế bào hiện có theo đơn vị", cellUnit === "cell" ? "Tổng toàn bộ tế bào, không phụ thuộc số giếng/flask" : "Nhập mật độ hoặc số tế bào mỗi giếng/flask", v1, setV1, cellUnit)}{renderField("Tổng thể tích hiện có", "V của suspension", c2, setC2, volumeUnit)}{(cellUnit === "cell/giếng" || cellUnit === "cell/flask") && renderField("Số giếng / flask hiện có", "Để quy đổi số tế bào mỗi đơn vị về tổng số", v2, setV2, cellUnit === "cell/giếng" ? "giếng" : "flask")}</> : <>{renderField("C", "Nồng độ mol", c1, setC1, "M")}{renderField("V", "Thể tích dung dịch", v1, setV1, volumeUnit)}{renderField("MW", "Khối lượng phân tử", c2, setC2, "g/mol")}</>}</div>{isDilution && <div className="result-toggle"><span>Tính giá trị</span><button className={resultMode === "v1" ? "active" : ""} onClick={() => setResultMode("v1")}>V₁ — stock volume</button><button className={resultMode === "v2" ? "active" : ""} onClick={() => setResultMode("v2")}>V₂ — final volume</button></div>}<div className="calc-result"><div><span className="panel-index">RESULT / {isDilution ? resultMode === "v1" ? "V₁" : "V₂" : activeCalc.name}</span><strong>{result === null ? "—" : formatNumber(result)} <small>{selectedCalc === "viability" ? "%" : selectedCalc === "molarity" ? "g" : selectedCalc === "dilution" || selectedCalc === "volume-to-take" ? volumeUnit : selectedCalc === "manual-cell-count" ? "cell/mL" : selectedCalc === "cells-needed" ? "cells" : volumeUnit}</small></strong></div><div className="result-equation">{isDilution ? resultMode === "v1" ? `(${c2 || "0"} × ${v2 || "0"}) / ${c1 || "0"}` : `(${c1 || "0"} × ${v1 || "0"}) / ${c2 || "0"}` : activeCalc.formula}</div></div><div className="calc-actions"><Button disabled={!canCalculate} onClick={runCalculation} className="primary-cta"><Gauge size={16} /> {canCalculate ? "Tính & lưu kết quả" : "Viewer chỉ được xem"}</Button><span><ShieldCheck size={14} /> Kiểm tra đầu vào tự động</span></div></div><div className="history-card content-panel"><div className="panel-heading"><div><span className="panel-index">SESSION HISTORY</span><h2>Lần tính gần đây</h2></div><button className="text-button" onClick={clearHistory}>Xóa lịch sử</button></div>{recent.length ? recent.map((item, index) => <div className="history-row" key={`${item}-${index}`}><span className="history-number">0{index + 1}</span><span>{item}</span><button type="button" className="icon-button danger" onClick={() => deleteCalculation(index)} aria-label={`Xóa phép tính ${index + 1}`}><Trash2 size={14} /></button></div>) : <div className="empty-state"><p>Chưa có phép tính trong phiên này.</p></div>}</div></section></div></>;
}

function AdminView({ protocols, samples, draftOwner, setDraftOwner, draftCategory, setDraftCategory, calculators, onDeleteCalculator, onCreateProtocol, draftType, setDraftType, draftTitle, setDraftTitle, draftBody, setDraftBody, draftFormula, setDraftFormula, draftInputUnits, setDraftInputUnits, draftOutputUnit, setDraftOutputUnit, onSave, onDeleteProtocol, onEditSample }: { protocols: Protocol[]; samples: Sample[]; draftOwner: string; setDraftOwner: (value: string) => void; draftCategory: "Custom" | SpecialCategory; setDraftCategory: (value: "Custom" | SpecialCategory) => void; calculators: CalculatorDefinition[]; onDeleteCalculator: (id: string) => void; onCreateProtocol: () => void; draftType: "Quy trình" | "Mẫu" | "Lý thuyết" | "Phương trình"; setDraftType: (t: "Quy trình" | "Mẫu" | "Lý thuyết" | "Phương trình") => void; draftTitle: string; setDraftTitle: (s: string) => void; draftBody: string; setDraftBody: (s: string) => void; draftFormula: string; setDraftFormula: (s: string) => void; draftInputUnits: Record<string, string>; setDraftInputUnits: (value: Record<string, string>) => void; draftOutputUnit: string; setDraftOutputUnit: (value: string) => void; onSave: () => void; onDeleteProtocol: (id: string) => void; onEditSample: (sample: Sample) => void }) {
  const formulaVariables = (() => { try { return draftFormula.trim() ? getFormulaVariables(draftFormula) : []; } catch { return []; } })();
  return <><PageIntro eyebrow="OWNER CONSOLE / CONTENT CONTROL" title={<>Chủ động giữ kho <em>luôn đúng.</em></>} description="Phân bổ nội dung thành các page, từng bước quy trình và từng phương trình tool — không cần viết code." action={<div className="intro-actions"><Button className="primary-cta" onClick={onCreateProtocol}><Plus size={16} /> Thiết kế quy trình theo bước</Button><div className="owner-chip"><ShieldCheck size={15} /> Public editor</div></div>} /><div className="admin-layout"><section className="content-panel editor-panel"><div className="panel-heading"><div><span className="panel-index">PAGE TYPES / CONTENT BLOCKS</span><h2>Thêm nội dung vào kho</h2></div><span className="draft-badge">Server saved</span></div><div className="editor-tabs">{(["Quy trình", "Mẫu", "Lý thuyết", "Phương trình"] as const).map(type => <button key={type} className={draftType === type ? "active" : ""} onClick={() => setDraftType(type)}>{type}</button>)}</div>{(draftType === "Quy trình" || draftType === "Phương trình") && <label className="field-label">Nhóm nội dung<select value={draftCategory} onChange={event => setDraftCategory(event.target.value as "Custom" | SpecialCategory)}><option value="Custom">Thư viện chung</option><option value="Hypoxia">Nuôi cấy Hypoxia</option><option value="HighPressure">Nuôi cấy áp suất cao</option></select></label>}<label className="field-label">Tiêu đề / tên reference<Input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder={draftType === "Quy trình" ? "VD: Western blot — membrane transfer" : "VD: Recombinant protein R-102"} /></label>{draftType === "Quy trình" && <label className="field-label">Người viết quy trình<Input value={draftOwner} onChange={event => setDraftOwner(event.target.value)} placeholder="VD: Nguyễn Văn A" /></label>}<label className="field-label">Mô tả hoặc ghi chú nội bộ<Textarea value={draftBody} onChange={e => setDraftBody(e.target.value)} placeholder="Viết thông tin để team có thể dùng ngay…" rows={6} /></label>{draftType === "Phương trình" && <label className="field-label">Phương trình<Input value={draftFormula} onChange={e => setDraftFormula(e.target.value)} placeholder="VD: N_mong_muon / N_tong * V_tong" /><small>Biến dùng chữ không dấu/ASCII; hỗ trợ +, -, *, /, ^ và dấu ngoặc. Tool sẽ tạo ô nhập cho từng biến; nhãn đơn vị không tự quy đổi.</small></label>}{draftType === "Phương trình" && <div className="formula-unit-grid">{formulaVariables.map(variable => <label className="field-label" key={variable}>Đơn vị {variable}<Input value={draftInputUnits[variable] ?? ""} onChange={event => setDraftInputUnits({ ...draftInputUnits, [variable]: event.target.value })} placeholder="VD: mL, cell, atm" /></label>)}<label className="field-label">Đơn vị kết quả<Input value={draftOutputUnit} onChange={event => setDraftOutputUnit(event.target.value)} placeholder="VD: giờ" /></label></div>}<div className="editor-footer"><span><FilePenLine size={14} /> Thay đổi được lưu trực tiếp vào kho dữ liệu</span><Button onClick={onSave} className="primary-cta"><Check size={15} /> Lưu {draftType === "Phương trình" ? "tool" : "bản nháp"}</Button></div></section><aside className="content-panel inventory-panel"><div className="panel-heading"><div><span className="panel-index">CONTENT INVENTORY</span><h2>Đang quản lý</h2></div><MoreHorizontal size={18} /></div><div className="inventory-group"><span className="inventory-label">Quy trình <b>{protocols.length}</b></span>{protocols.slice(0, 4).map(protocol => <div className="inventory-row" key={protocol.id}><span className="inventory-dot teal" /><span>{protocol.title}</span><button onClick={() => onDeleteProtocol(protocol.id)} aria-label={`Xóa ${protocol.title}`}><Trash2 size={13} /></button></div>)}</div><div className="inventory-group"><span className="inventory-label">Mẫu & lý thuyết <b>{samples.length}</b></span>{samples.slice(0, 3).map(sample => <div className="inventory-row" key={sample.id}><span className="inventory-dot amber" /><span>{sample.name}</span><button onClick={() => onEditSample(sample)} aria-label={`Sửa ${sample.name}`}><FilePenLine size={13} /></button></div>)}</div><div className="inventory-group"><span className="inventory-label">Công thức tính <b>{calculators.length}</b></span>{calculators.map(calculator => <div className="inventory-row" key={calculator.id}><span className="inventory-dot blue" /><span>{calculator.name}</span><button onClick={() => onDeleteCalculator(calculator.id)} aria-label={`Xóa ${calculator.name}`}><Trash2 size={13} /></button></div>)}</div><div className="admin-note"><ShieldCheck size={15} /><span><strong>Public page editor</strong>Mọi người đều có thể mở và chỉnh sửa page.</span></div></aside></div><section className="content-panel team-panel"><div className="panel-heading"><div><span className="panel-index">EDITOR MAP / 04 MODULES</span><h2>Các loại nội dung</h2></div></div><div className="role-guide"><span><b className="role-admin">Quy trình</b> Page + các bước chi tiết</span><span><b className="role-researcher">Mẫu & lý thuyết</b> Reference + context</span><span><b className="role-viewer">Phương trình</b> Tạo tool tính mới</span></div></section></>;
}

function AdminAccountsView({ team, onApprovalChange }: { team: TeamMember[]; onApprovalChange: (id: number, status: TeamMember["approvalStatus"]) => void }) {
  const pending = team.filter(member => member.approvalStatus === "pending");
  return <><PageIntro eyebrow="ADMIN / ACCOUNT REVIEW" title={<>Duyệt <em>tài khoản truy cập.</em></>} description="Kiểm tra các yêu cầu đăng ký email trước khi cấp quyền vào workspace private." action={<div className="owner-chip"><ShieldCheck size={15} /> Admin only</div>} /><section className="content-panel team-panel"><div className="panel-heading"><div><span className="panel-index">PENDING ACCESS / {pending.length}</span><h2>Yêu cầu đang chờ duyệt</h2></div><span className="team-policy">{team.length} tài khoản</span></div>{pending.length ? pending.map(member => <div className="team-row" key={member.id}><UserAvatar name={member.name} /><span className="team-identity"><strong>{member.name}</strong><small>{member.email} · đăng ký {member.lastActive}</small></span><Button variant="outline" onClick={() => onApprovalChange(member.id, "rejected")}>Từ chối</Button><Button className="primary-cta" onClick={() => onApprovalChange(member.id, "approved")}>Duyệt</Button></div>) : <div className="empty-state"><Check size={24} /><h3>Không có yêu cầu mới</h3><p>Các tài khoản email mới sẽ xuất hiện ở đây.</p></div>}</section><section className="content-panel team-panel"><div className="panel-heading"><div><span className="panel-index">ACCOUNT DIRECTORY</span><h2>Tài khoản đã xử lý</h2></div></div>{team.filter(member => member.approvalStatus !== "pending").map(member => <div className="team-row" key={member.id}><UserAvatar name={member.name} /><span className="team-identity"><strong>{member.name}</strong><small>{member.email} · {member.loginMethod || "Manus"}</small></span><span className={`role-pill ${member.approvalStatus}`}>{member.approvalStatus === "approved" ? "Đã duyệt" : "Từ chối"}</span></div>)}</section></>;
}

function ProtocolEditorPage({ title, owner, body, steps, category, setTitle, setOwner, setBody, setSteps, onSave, onCancel }: { title: string; owner: string; body: string; steps: ProtocolStep[]; category: "Custom" | SpecialCategory; setTitle: (value: string) => void; setOwner: (value: string) => void; setBody: (value: string) => void; setSteps: React.Dispatch<React.SetStateAction<ProtocolStep[]>>; onSave: () => void; onCancel: () => void }) {
  const updateStep = (index: number, key: keyof ProtocolStep, value: string) => setSteps(current => current.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step));
  return <><button className="back-link" onClick={onCancel}><ArrowLeft size={15} /> {category === "Custom" ? "Quay lại danh sách quy trình" : "Quay lại thí nghiệm điều kiện đặc trưng"}</button><PageIntro eyebrow="PROTOCOL BUILDER / STEP-BY-STEP" title={<>Thiết kế <em>quy trình theo bước.</em></>} description="Mỗi bước có tên, hướng dẫn chi tiết và thời gian riêng; có thể thêm, xóa hoặc sắp xếp lại trước khi lưu." action={<Button className="primary-cta" onClick={() => setSteps(current => [...current, { title: "", detail: "", time: "" }])}><Plus size={16} /> Thêm bước</Button>} /><section className="content-panel editor-panel"><div className="panel-heading"><div><span className="panel-index">PROTOCOL PAGE / STRUCTURE</span><h2>Thông tin chung</h2></div><span className="draft-badge">{category === "Custom" ? "Bản nháp" : SPECIAL_CATEGORY_LABEL[category]}</span></div><label className="field-label">Tên quy trình<Input value={title} onChange={event => setTitle(event.target.value)} placeholder="VD: Perfusion" /></label><label className="field-label">Người viết quy trình<Input value={owner} onChange={event => setOwner(event.target.value)} placeholder="VD: Nguyễn Văn A" /></label><label className="field-label">Tóm tắt quy trình<Textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Mục tiêu, phạm vi và điều kiện áp dụng…" rows={4} /></label><div className="step-editor-list">{steps.map((step, index) => <div className="step-editor-card" key={`draft-step-${index}`}><div className="step-editor-head"><span className="step-marker"><span>{String(index + 1).padStart(2, "0")}</span></span><strong>Bước {index + 1}</strong>{steps.length > 1 && <button className="icon-button danger" onClick={() => setSteps(current => current.filter((_, stepIndex) => stepIndex !== index))} aria-label={`Xóa bước ${index + 1}`}><Trash2 size={15} /></button>}</div><div className="step-editor-grid"><label className="field-label">Tên bước<Input value={step.title} onChange={event => updateStep(index, "title", event.target.value)} placeholder="VD: Cân gan" /></label><label className="field-label">Thời gian / điều kiện<Input value={step.time} onChange={event => updateStep(index, "time", event.target.value)} placeholder="VD: 10 phút · 4°C" /></label></div><label className="field-label">Hướng dẫn chi tiết<Textarea value={step.detail} onChange={event => updateStep(index, "detail", event.target.value)} placeholder="Mô tả thao tác, thể tích, tốc độ ly tâm, nhiệt độ…" rows={4} /></label></div>)}</div><div className="editor-footer"><span><FilePenLine size={14} /> Các bước được lưu riêng trong database</span><div><Button variant="outline" onClick={onCancel}>Hủy</Button><Button onClick={onSave} className="primary-cta"><Check size={15} /> Lưu bản nháp</Button></div></div></section></>;
}
