import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getFormulaVariables } from "@shared/formulaMath";
import { calculateCellsNeeded, calculateVolumeToTake } from "@/lib/cellCalculations";
import { calculateDilution, CONCENTRATION_UNITS, VOLUME_UNITS, type ConcentrationUnit, type DilutionTarget, type VolumeUnit, volumeToMl } from "@/lib/dilutionMath";
import { parseLocaleNumber } from "@/lib/numberInput";
import { toast } from "sonner";
import { HypoxiaCalculator } from "@/components/HypoxiaCalculator";
import { CustomCalculator } from "@/components/CustomCalculator";
import { SpecialExperimentsView, SPECIAL_CATEGORY_LABEL, type SpecialCategory } from "@/components/SpecialExperimentsView";
import { ChemicalMixingView } from "@/components/ChemicalMixingView";
import {
  Archive,
  ArrowLeft,
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

type View = "overview" | "protocols" | "samples" | "calculator" | "special" | "chemicals" | "chemicalStock" | "admin" | "adminAccounts" | "adminLogin" | "userLogin" | "userAccount" | "createProtocol";
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

type FormulaItem = { key: string; label: string; unit: string };

type CalculatorDefinition = {
  id: string;
  dbId?: number;
  config?: unknown;
  name: string;
  category: string;
  formula: string;
  description: string;
  status?: string;
  color: string;
};
type CalculatorRecord = { id: number; slug: string; name: string; category: string; formula: string; description: string; config: unknown; status: string; active: number };

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


type TeamMember = { id: number; username?: string | null; name: string; email: string; role: "admin" | "user" | "researcher" | "viewer"; approvalStatus: "pending" | "approved" | "rejected"; loginMethod?: string | null; lastActive: string };

const initialTeam: TeamMember[] = [];

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "protocols", label: "Quy trình", icon: ClipboardList },
  { id: "samples", label: "Mẫu & lý thuyết", icon: FlaskConical },
  { id: "calculator", label: "Công cụ tính", icon: Calculator },
  { id: "chemicals", label: "Pha hoá chất", icon: FlaskConical },
  { id: "special", label: "Thí nghiệm điều kiện đặc trưng", icon: Beaker },
  { id: "admin", label: "Quản lý nội dung", icon: Settings2 },
  { id: "adminAccounts", label: "Quản trị Admin", icon: ShieldCheck },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(value);
}

type CellUnit = "cell/mL" | "cell/giếng" | "cell/flask" | "cell";
type DilutionSettings = { mode: DilutionMode; factor: string; initial: string; added: string };
type DilutionMode = "factor" | "volumes";

function UserAvatar({ name }: { name?: string | null }) {
  const initials = (name || "Lab").split(" ").map(part => part[0]).slice(-2).join("").toUpperCase();
  return <span className="avatar">{initials || "LV"}</span>;
}

type ProtocolRecord = { id: number; title: string; category: string; tag: string; status: Protocol["status"]; version: string; updatedAt: Date | string; owner: string; summary: string; duration: string; steps: unknown; notes: unknown };
type SampleRecord = { id: number; code: string; name: string; groupName: string; status: string; updatedAt: Date | string; description: string; properties: unknown; theory: string };

function toProtocol(record: ProtocolRecord): Protocol {
  return { id: String(record.id), title: record.title, category: record.category, tag: record.tag, status: record.status, version: record.version, updatedAt: new Date(record.updatedAt).toLocaleDateString("vi-VN"), owner: record.owner, summary: record.summary, duration: record.duration, steps: Array.isArray(record.steps) ? record.steps as Protocol["steps"] : [], notes: Array.isArray(record.notes) ? record.notes as string[] : [] };
}

function toSample(record: SampleRecord): Sample {
  return { id: String(record.id), code: record.code, name: record.name, group: record.groupName, status: record.status, updatedAt: new Date(record.updatedAt).toLocaleDateString("vi-VN"), description: record.description, properties: Array.isArray(record.properties) ? record.properties as Sample["properties"] : [], theory: record.theory };
}


export default function Home() {
  const authQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const user = authQuery.data;
  const role = user?.role ?? "user";
  const isAdmin = role === "admin";
  const canEdit = true;
  const contentQuery = trpc.content.all.useQuery(undefined, { retry: false });
  const teamQuery = trpc.team.list.useQuery(undefined, { enabled: isAdmin, retry: false });
  const logoutMutation = trpc.auth.logout.useMutation({ onSuccess: async () => { await authQuery.refetch(); setView("overview"); toast.success("Đã đăng xuất admin."); } });
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({ onSuccess: async () => { await authQuery.refetch(); toast.success("Hồ sơ User đã được cập nhật."); }, onError: error => toast.error(error.message) });
  const updateRoleMutation = trpc.team.updateRole.useMutation({ onSuccess: () => teamQuery.refetch(), onError: error => toast.error(error.message) });
  const updateApprovalMutation = trpc.team.updateApproval.useMutation({ onSuccess: () => teamQuery.refetch(), onError: error => toast.error(error.message) });
  const revokeAccessMutation = trpc.team.revokeAccess.useMutation({ onSuccess: () => { teamQuery.refetch(); toast.success("Đã thu hồi quyền truy cập của User."); }, onError: error => toast.error(error.message) });
  const deleteUserMutation = trpc.team.deleteUser.useMutation({ onSuccess: () => { teamQuery.refetch(); toast.success("Đã xoá User."); }, onError: error => toast.error(error.message) });
  const resetPasswordMutation = trpc.team.resetPassword.useMutation({ onSuccess: () => toast.success("Đã đặt lại mật khẩu."), onError: error => toast.error(error.message) });
  const approveProtocolMutation = trpc.content.approveProtocol.useMutation({ onSuccess: async () => { await contentQuery.refetch(); toast.success("Quy trình đã được duyệt."); }, onError: error => toast.error(error.message) });
  const approveSampleMutation = trpc.content.approveSample.useMutation({ onSuccess: async () => { await contentQuery.refetch(); toast.success("Mục lý thuyết đã được duyệt."); }, onError: error => toast.error(error.message) });
  const approveCalculatorMutation = trpc.content.approveCalculator.useMutation({ onSuccess: async () => { await contentQuery.refetch(); toast.success("Công cụ đã được duyệt."); }, onError: error => toast.error(error.message) });
  const createDraftMutation = trpc.content.createDraft.useMutation({ onSuccess: async (_, variables) => { await contentQuery.refetch(); toast.success("Nội dung đã được lưu vào bản nháp."); if (variables.kind === "protocol" && (variables.category === "Hypoxia" || variables.category === "HighPressure")) { setSpecialCategory(variables.category); setView("special"); } }, onError: error => toast.error(error.message) });
  const createCalculatorMutation = trpc.content.createCalculator.useMutation({ onSuccess: async (_, variables) => { await contentQuery.refetch(); toast.success("Phương trình đã được tạo thành tool."); if (variables.category === "Hypoxia" || variables.category === "HighPressure") { setSpecialCategory(variables.category); setView("special"); } }, onError: error => toast.error(error.message) });
  const deleteCalculatorMutation = trpc.content.deleteCalculator.useMutation({ onSuccess: async () => { await contentQuery.refetch(); toast.success("Đã xoá công thức tính."); }, onError: error => toast.error(error.message) });
  const updateCalculatorMutation = trpc.content.updateCalculator.useMutation({ onSuccess: async () => { await contentQuery.refetch(); toast.success("Công cụ đã được cập nhật."); }, onError: error => toast.error(error.message) });
  const updateDraftMutation = trpc.content.updateDraft.useMutation({ onSuccess: async () => { await contentQuery.refetch(); toast.success("Nội dung đã được cập nhật."); }, onError: error => toast.error(error.message) });
  const deleteProtocolMutation = trpc.content.deleteProtocol.useMutation({ onSuccess: async () => { await contentQuery.refetch(); toast.success("Đã xóa quy trình khỏi kho."); }, onError: error => toast.error(error.message) });
  const deleteSampleMutation = trpc.content.deleteSample.useMutation({ onSuccess: async () => { await contentQuery.refetch(); toast.success("Đã xóa mục lý thuyết."); }, onError: error => toast.error(error.message) });
  const [view, setView] = useState<View>("overview");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
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
  const [dilutionTarget, setDilutionTarget] = useState<DilutionTarget>("V1");
  const [dilutionConcentrationMode, setDilutionConcentrationMode] = useState<"stock" | "percent">("stock");
  const [dilutionVolumeUnits, setDilutionVolumeUnits] = useState<Record<"v1" | "v2", VolumeUnit>>({ v1: "µL", v2: "µL" });
  const [dilutionConcentrationUnits, setDilutionConcentrationUnits] = useState<Record<"c1" | "c2", ConcentrationUnit>>({ c1: "mg/mL", c2: "mg/mL" });
  const [recent, setRecent] = useState<string[]>([]);
  const [draftType, setDraftType] = useState<"Quy trình" | "Mẫu" | "Lý thuyết" | "Phương trình">("Quy trình");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftOwner, setDraftOwner] = useState("Lab editor");
  const [draftBody, setDraftBody] = useState("");
  const [draftFormula, setDraftFormula] = useState("");
  const [draftInputUnits, setDraftInputUnits] = useState<Record<string, string>>({});
  const [draftOutputUnit, setDraftOutputUnit] = useState("");
  const [draftItems, setDraftItems] = useState<FormulaItem[]>([]);
  const [draftSteps, setDraftSteps] = useState<ProtocolStep[]>([{ title: "", detail: "", time: "" }]);
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
  const activeDilutionConcentrationUnits = dilutionConcentrationMode === "percent" ? { c1: "%" as const, c2: "%" as const } : dilutionConcentrationUnits;

  useEffect(() => {
    if (!contentQuery.data) return;
    setProtocols((contentQuery.data.protocols as ProtocolRecord[]).map(toProtocol));
    setSamples((contentQuery.data.samples as SampleRecord[]).map(toSample));
    const databaseCalculators = (contentQuery.data.calculators as CalculatorRecord[]).filter(item => item.active !== 0).map(item => ({ id: item.slug, dbId: item.id, config: item.config, name: item.name, category: item.category, formula: item.formula, description: item.description, status: item.status, color: item.category === "Cell counting" ? "teal" : item.category === "Cell seeding" ? "amber" : "blue" }));
    setCalculatorTools(databaseCalculators);
    if (!databaseCalculators.some(item => item.id === selectedCalc)) setSelectedCalc(databaseCalculators[0]?.id ?? "");
  }, [contentQuery.data]);

  const filteredProtocols = useMemo(() => protocols.filter(item => `${item.title} ${item.category} ${item.tag} ${item.summary}`.toLowerCase().includes(search.toLowerCase())), [protocols, search]);
  const filteredSamples = useMemo(() => samples.filter(item => `${item.name} ${item.code} ${item.group} ${item.description}`.toLowerCase().includes(search.toLowerCase())), [samples, search]);
  const calculationResult = useMemo(() => {
    const values = [parseLocaleNumber(c1), parseLocaleNumber(v1), parseLocaleNumber(c2), parseLocaleNumber(v2)];
    const positive = (value: number) => Number.isFinite(value) && value > 0;
    const initialVolume = parseLocaleNumber(dilutionInitialVolume);
    const dilutionFactor = dilutionMode === "factor" ? parseLocaleNumber(dilutionFactorValue) : (initialVolume + parseLocaleNumber(dilutionAddedVolume)) / initialVolume;
    if (selectedCalc === "dilution") return calculateDilution(dilutionTarget, { c1: values[0], v1: values[1], c2: values[2], v2: values[3], c1Unit: activeDilutionConcentrationUnits.c1, c2Unit: activeDilutionConcentrationUnits.c2, v1Unit: dilutionVolumeUnits.v1, v2Unit: dilutionVolumeUnits.v2 });
    if (selectedCalc === "viability") return positive(values[0]) && positive(values[1]) ? (values[0] / values[1]) * 100 : null;
    if (selectedCalc === "molarity") return positive(values[0]) && positive(values[1]) && positive(values[2]) ? values[0] * (volumeToMl(values[1], volumeUnit) / 1000) * values[2] : null;
    if (selectedCalc === "manual-cell-count") return [values[0], values[1], dilutionFactor].every(positive) && (dilutionMode !== "volumes" || (positive(initialVolume) && parseLocaleNumber(dilutionAddedVolume) >= 0)) ? (values[0] / values[1]) * dilutionFactor * 10000 : null;
    if (selectedCalc === "cells-needed") return calculateCellsNeeded(values[0], cellUnit, values[1], values[2], volumeUnit);
    if (selectedCalc === "volume-to-take") return calculateVolumeToTake(values[0], values[1], cellUnit, values[2], volumeUnit, values[3]);
    return null;
  }, [c1, v1, c2, v2, volumeUnit, cellUnit, dilutionMode, dilutionFactorValue, dilutionInitialVolume, dilutionAddedVolume, dilutionTarget, dilutionVolumeUnits, dilutionConcentrationUnits, dilutionConcentrationMode, activeDilutionConcentrationUnits, selectedCalc]);

  const currentView = navItems.find(item => item.id === view);
  const openProtocol = (protocol: Protocol) => { setSelectedProtocol(protocol); setView("protocols"); };
  const openSample = (sample: Sample) => { setSelectedSample(sample); setView("samples"); };
  const editProtocol = (protocol: Protocol) => { setEditingId(protocol.id); setDraftType("Quy trình"); setDraftCategory(protocol.category === "Hypoxia" || protocol.category === "HighPressure" ? protocol.category : "Custom"); if (protocol.category === "Hypoxia" || protocol.category === "HighPressure") setSpecialCategory(protocol.category); setDraftTitle(protocol.title); setDraftOwner(protocol.owner); setDraftBody(protocol.summary); setDraftSteps(protocol.steps.length ? protocol.steps : [{ title: "", detail: "", time: "" }]); setSelectedProtocol(null); setView("createProtocol"); };
  const editSample = (sample: Sample) => { setEditingId(sample.id); setDraftType("Mẫu"); setDraftTitle(sample.name); setDraftBody(sample.description); setSelectedSample(null); setView("admin"); };
  const startCreateProtocol = (category: "Custom" | SpecialCategory = "Custom") => { setDraftCategory(category); setDraftType("Quy trình"); setEditingId(null); setDraftTitle(""); setDraftOwner("Lab editor"); setDraftBody(""); setDraftSteps([{ title: "", detail: "", time: "" }]); setView("createProtocol"); };
  const startCreateSample = () => { setDraftType("Mẫu"); setEditingId(null); setDraftTitle(""); setDraftOwner("Lab editor"); setDraftBody(""); setView("admin"); };
  const startCreateCalculator = (category: "Custom" | SpecialCategory = "Custom") => { setDraftCategory(category); setDraftType("Phương trình"); setEditingId(null); setDraftTitle(""); setDraftOwner("Lab editor"); setDraftBody(""); setDraftFormula(""); setDraftInputUnits({}); setDraftOutputUnit(""); setDraftItems([]); setView("admin"); };
  const editCalculator = (calculator: CalculatorDefinition) => { const config = calculator.config && typeof calculator.config === "object" ? calculator.config as { inputUnits?: Record<string, string>; outputUnit?: string; units?: Record<string, string>; variables?: FormulaItem[] } : {}; const configuredUnits = config.inputUnits ?? config.units ?? {}; let formulaVariables: string[] = []; try { formulaVariables = getFormulaVariables(calculator.formula); } catch { /* legacy display formulas are still editable */ } const items = config.variables?.length ? config.variables : formulaVariables.map(key => ({ key, label: key, unit: configuredUnits[key] ?? "" })); setDraftType("Phương trình"); setDraftCategory(calculator.category === "Hypoxia" || calculator.category === "HighPressure" ? calculator.category : "Custom"); setEditingId(String(calculator.dbId ?? calculator.id)); setDraftTitle(calculator.name); setDraftBody(calculator.description); setDraftFormula(calculator.formula); setDraftInputUnits(formulaVariables.length ? configuredUnits : {}); setDraftItems(items); setDraftOutputUnit(config.outputUnit ?? ""); setView("admin"); };
  const handleSaveDraft = () => {
    if (!draftTitle.trim()) return toast.error("Vui lòng nhập tên nội dung.");
    if (draftType === "Quy trình" && !draftOwner.trim()) return toast.error("Vui lòng nhập tên người viết quy trình.");
    if (!canEdit) return toast.error("Viewer chỉ có quyền tra cứu.");
    if (draftType === "Phương trình") {
      if (!draftFormula.trim()) return toast.error("Nhập công thức trước khi lưu tool.");
      let variables: string[];
      try { variables = getFormulaVariables(draftFormula); } catch (error) { return toast.error(error instanceof Error ? error.message : "Công thức không hợp lệ."); }
      const formulaItems = variables.map(variable => draftItems.find(item => item.key === variable) ?? { key: variable, label: variable, unit: draftInputUnits[variable] ?? "" });
      const inputUnits = Object.fromEntries(formulaItems.map(item => [item.key, item.unit]));
      if (editingId) {
        const dbId = calculatorTools.find(calculator => String(calculator.dbId) === editingId || calculator.id === editingId)?.dbId;
        if (!dbId) return toast.error("Không tìm thấy công cụ cần sửa.");
        updateCalculatorMutation.mutate({ id: dbId, name: draftTitle, formula: draftFormula, description: draftBody, inputUnits, outputUnit: draftOutputUnit, variables: formulaItems });
      } else createCalculatorMutation.mutate({ name: draftTitle, formula: draftFormula, description: draftBody, category: draftCategory, inputUnits, outputUnit: draftOutputUnit, variables: formulaItems });
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
  const handleEditCalculator = (id: string) => { const calculator = calculatorTools.find(item => item.id === id); if (calculator) editCalculator(calculator); };
  const handleDeleteCalculator = (id: string) => { const dbId = calculatorTools.find(calculator => calculator.id === id)?.dbId; if (isAdmin && dbId && confirmTwice("Xoá công thức tính này?")) deleteCalculatorMutation.mutate({ id: dbId }); };
  const handleDeleteProtocol = (id: string) => { if (!isAdmin) return toast.error("Chỉ Admin mới có quyền xóa quy trình."); deleteProtocolMutation.mutate({ id: Number(id) }); setSelectedProtocol(null); };
  const runCalculation = () => { if (!canEdit) return toast.error("Viewer chỉ có quyền tra cứu."); if (calculationResult === null) return toast.error("Tool này cần các trường số hợp lệ hoặc chưa có bộ tính tự động."); const unit = selectedCalc === "viability" ? "%" : selectedCalc === "molarity" ? "g" : selectedCalc === "dilution" ? (dilutionTarget.startsWith("C") ? activeDilutionConcentrationUnits[dilutionTarget.toLowerCase() as "c1" | "c2"] : dilutionVolumeUnits[dilutionTarget.toLowerCase() as "v1" | "v2"]) : selectedCalc === "volume-to-take" ? volumeUnit : selectedCalc === "manual-cell-count" ? "cell/mL" : selectedCalc === "cells-needed" ? "cells" : volumeUnit; const label = `${formatNumber(calculationResult)} ${unit}`; const line = `${calculatorTools.find(calc => calc.id === selectedCalc)?.name || "Calculation"} · ${label} · ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`; setRecent(current => [line, ...current].slice(0, 4)); toast.success("Đã tính và lưu vào lịch sử phiên."); };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand-lockup"><span className="brand-mark">RP</span><span className="brand-copy"><span className="brand-name">Rebiomed Protocol</span><small>From Stratos with Manus AI</small></span></div>
          <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Đóng menu"><X size={18} /></button>
          <div className="workspace-badge"><span className="status-dot" /> PUBLIC LAB WORKSPACE <span className="workspace-code">#07</span></div>
        </div>
        <div className="nav-caption">Workspace</div>
        <nav className="main-nav">
          {navItems.filter(item => item.id !== "adminAccounts" || isAdmin).map(item => { const Icon = item.icon; return <div key={item.id}><button className={`nav-item ${view === item.id || (item.id === "chemicals" && view === "chemicalStock") ? "active" : ""}`} onClick={() => { setView(item.id); setSelectedProtocol(null); setSelectedSample(null); setMobileNav(false); }}><Icon size={17} /><span>{item.label}</span>{item.id === "protocols" && <span className="nav-count">{protocols.length}</span>}</button>{item.id === "special" && <div className="special-subnav">{(["Hypoxia", "HighPressure"] as const).map(key => <button key={key} className={view === "special" && specialCategory === key ? "active" : ""} onClick={() => { setSpecialCategory(key); setView("special"); setMobileNav(false); }}>{SPECIAL_CATEGORY_LABEL[key]}</button>)}</div>}{item.id === "chemicals" && <div className="special-subnav chemical-subnav"><button className={view === "chemicals" ? "active" : ""} onClick={() => { setView("chemicals"); setMobileNav(false); }}>Hoá chất</button><button className={view === "chemicalStock" ? "active" : ""} onClick={() => { setView("chemicalStock"); setMobileNav(false); }}>Hoá chất stock</button></div>}</div>; })}
        </nav>
        <div className="sidebar-rule" />
        <div className="sidebar-bottom"><div className="sync-note"><span className="sync-icon"><Check size={12} /></span><span><strong>Đã đồng bộ</strong><small>{contentQuery.isFetching ? "Đang cập nhật…" : "Chỉnh sửa trực tiếp"}</small></span></div></div>
      </aside>
      {mobileNav && <button className="mobile-overlay" onClick={() => setMobileNav(false)} aria-label="Đóng menu" />}

      <main className="main-canvas">
        <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Mở menu"><Menu size={20} /></button><div className="breadcrumb"><span>Rebiomed Protocol</span><ChevronRight size={13} /><strong>{currentView?.label}</strong></div></div><div className="topbar-actions"><div className="global-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm quy trình, mẫu, chủ đề…" /><kbd>⌘ K</kbd></div><div className="account-menu"><button className="topbar-avatar" onClick={() => setAccountMenuOpen(current => !current)} aria-label="Mở tài khoản" aria-expanded={accountMenuOpen}><UserAvatar name={user?.name ?? (isAdmin ? "Admin" : "User")} /></button>{accountMenuOpen && <div className="account-popover"><div className="account-popover-head"><UserAvatar name={user?.name ?? (isAdmin ? "Admin" : "User")} /><div><strong>{user?.name || (isAdmin ? "Admin" : "Khách")}</strong><small>{user?.email || (isAdmin ? "Tài khoản quản trị" : "Chưa đăng nhập")}</small></div></div>{user ? <><button onClick={() => { setView(isAdmin ? "adminAccounts" : "userAccount"); setAccountMenuOpen(false); }}>Trang cá nhân</button><button className="account-logout" onClick={() => { logoutMutation.mutate(); setAccountMenuOpen(false); }}>Đăng xuất</button></> : <><button onClick={() => { setView("userLogin"); setAccountMenuOpen(false); }}>Đăng nhập User</button><button onClick={() => { setView("adminLogin"); setAccountMenuOpen(false); }}>Đăng nhập Admin</button></>}</div>}</div></div></header>
        <div className="page-wrap">
          {view === "overview" && <Overview userName={user?.name ?? null} role={isAdmin ? "admin" : "user"} protocols={protocols} samples={samples} openProtocol={openProtocol} openSample={openSample} setView={setView} />}
          {view === "protocols" && <ProtocolsView protocols={filteredProtocols} selected={selectedProtocol} setSelected={setSelectedProtocol} openProtocol={openProtocol} onEdit={editProtocol} onDelete={handleDeleteProtocol} onCreate={() => startCreateProtocol()} canEdit={canEdit} canEditApproved={isAdmin} canDelete={isAdmin || selectedProtocol?.status === "Bản nháp"} search={search} />}
          {view === "samples" && <SamplesView samples={filteredSamples} selected={selectedSample} setSelected={setSelectedSample} openSample={openSample} onCreate={startCreateSample} onDelete={id => deleteSampleMutation.mutate({ id: Number(id) })} canManageApproved={isAdmin} search={search} />}
          {view === "calculator" && <CalculatorView tools={calculatorTools} onDesign={() => startCreateCalculator()} selectedCalc={selectedCalc} setSelectedCalc={setSelectedCalc} c1={c1} v1={v1} c2={c2} v2={v2} setC1={setC1} setV1={setV1} setC2={setC2} setV2={setV2} dilutionTarget={dilutionTarget} setDilutionTarget={setDilutionTarget} dilutionConcentrationMode={dilutionConcentrationMode} setDilutionConcentrationMode={setDilutionConcentrationMode} dilutionVolumeUnits={dilutionVolumeUnits} setDilutionVolumeUnits={setDilutionVolumeUnits} dilutionConcentrationUnits={dilutionConcentrationUnits} setDilutionConcentrationUnits={setDilutionConcentrationUnits} result={calculationResult} runCalculation={runCalculation} recent={recent} clearHistory={clearCalculationHistory} deleteCalculation={deleteCalculation} canCalculate={canEdit} volumeUnit={volumeUnit} setVolumeUnit={setVolumeUnit} cellUnit={cellUnit} setCellUnit={setCellUnit} dilutionMode={dilutionMode} setDilutionMode={setDilutionMode} dilutionFactorValue={dilutionFactorValue} setDilutionFactorValue={setDilutionFactorValue} dilutionInitialVolume={dilutionInitialVolume} setDilutionInitialVolume={setDilutionInitialVolume} dilutionAddedVolume={dilutionAddedVolume} setDilutionAddedVolume={setDilutionAddedVolume} />}
          {view === "chemicals" && <ChemicalMixingView initialTab="chemicals" />}
          {view === "chemicalStock" && <ChemicalMixingView initialTab="stock" />}
          {view === "special" && <SpecialExperimentsView protocols={protocols} tools={calculatorTools} category={specialCategory} setCategory={setSpecialCategory} openProtocol={protocol => { const full = protocols.find(item => item.id === protocol.id); if (full) openProtocol(full); }} openTool={id => { setSelectedCalc(id); setView("calculator"); }} createProtocol={startCreateProtocol} createTool={startCreateCalculator} />}
          {view === "admin" && <AdminView isAdmin={isAdmin} protocols={protocols} samples={samples} draftOwner={draftOwner} setDraftOwner={setDraftOwner} calculators={calculatorTools} onEditCalculator={handleEditCalculator} onDeleteCalculator={handleDeleteCalculator} onCreateProtocol={() => startCreateProtocol()} draftType={draftType} setDraftType={setDraftType} draftTitle={draftTitle} setDraftTitle={setDraftTitle} draftBody={draftBody} setDraftBody={setDraftBody} draftFormula={draftFormula} setDraftFormula={setDraftFormula} draftInputUnits={draftInputUnits} setDraftInputUnits={setDraftInputUnits} draftItems={draftItems} setDraftItems={setDraftItems} draftOutputUnit={draftOutputUnit} setDraftOutputUnit={setDraftOutputUnit} onSave={handleSaveDraft} draftCategory={draftCategory} setDraftCategory={setDraftCategory} onDeleteProtocol={handleDeleteProtocol} onEditSample={editSample} />}
          {view === "adminLogin" && <AdminLoginView onSuccess={async () => { await authQuery.refetch(); setView("adminAccounts"); }} />}
          {view === "userLogin" && <UserLoginView onSuccess={async () => { await authQuery.refetch(); setView("userAccount"); }} />}
          {view === "userAccount" && user && !isAdmin && <UserAccountView user={user} onSave={(email, currentPassword, newPassword) => updateProfileMutation.mutate({ email, currentPassword, newPassword: newPassword || undefined })} onLogout={() => logoutMutation.mutate()} />}
          {view === "adminAccounts" && isAdmin && <><AdminAccountsView canManagePasswords={user?.username?.toLowerCase() === "wstratos"} viewerId={user?.id ?? 0} team={(teamQuery.data ?? []).map(member => ({ ...member, name: member.name ?? "(chưa đặt tên)", email: member.email ?? "", lastActive: member.lastSignedIn ? new Date(member.lastSignedIn).toLocaleDateString("vi-VN") : "—", role: member.role as TeamMember["role"] }))} onApprovalChange={(id, status) => updateApprovalMutation.mutate({ id, approvalStatus: status })} onRoleChange={(id, roleValue) => updateRoleMutation.mutate({ id, role: roleValue })} onRevokeAccess={id => revokeAccessMutation.mutate({ id })} onDeleteUser={id => deleteUserMutation.mutate({ id })} onResetPassword={(id, password) => resetPasswordMutation.mutate({ id, password })} /><AdminReviewView protocols={protocols} samples={samples} calculators={calculatorTools} onApproveProtocol={id => approveProtocolMutation.mutate({ id })} onApproveSample={id => approveSampleMutation.mutate({ id })} onApproveCalculator={id => approveCalculatorMutation.mutate({ id })} /></>}
          {view === "createProtocol" && canEdit && <ProtocolEditorPage title={draftTitle} owner={draftOwner} body={draftBody} steps={draftSteps} category={draftCategory} setTitle={setDraftTitle} setOwner={setDraftOwner} setBody={setDraftBody} setSteps={setDraftSteps} onSave={handleSaveDraft} onCancel={() => setView(draftCategory === "Custom" ? "protocols" : "special")} />}
        </div>
      </main>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: React.ReactNode; description: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Overview({ userName, role, protocols, samples, openProtocol, openSample, setView }: { userName?: string | null; role: "admin" | "user"; protocols: Protocol[]; samples: Sample[]; openProtocol: (p: Protocol) => void; openSample: (s: Sample) => void; setView: (v: View) => void }) {
  return <>
    <PageIntro eyebrow={`02 OCTOBER 2026 · LAB CONTROL DESK · ${role.toUpperCase()}`} title={<>Chào {userName?.split(" ").slice(-1)[0] || "bạn"}, <em>mình bắt đầu nhé.</em></>} description="Mọi thứ đội ngũ cần để tái lập một thí nghiệm — ở đúng nơi, đúng phiên bản." action={<div className="intro-actions"><span className="last-sync"><span className="status-dot" /> Live sync</span><Button onClick={() => setView("calculator")} className="primary-cta"><Calculator size={16} /> Mở calculator</Button></div>} />
    <section className="content-panel welcome-card"><div><span className="panel-index">WELCOME / LAB DESK</span><p>Chào {userName?.trim() || "bạn"}. Hãy bắt đầu thí nghiệm và đón chờ những phát hiện mới</p></div><Sparkles size={24} /></section>
    <div className="overview-grid"><section className="content-panel focus-panel"><div className="panel-heading"><div><span className="panel-index">01 / FOCUS</span><h2>Quy trình dùng gần đây</h2></div><button className="text-button" onClick={() => setView("protocols")}>Xem tất cả <ArrowLeft size={14} className="flip-x" /></button></div><div className="protocol-list">{protocols.slice(0, 3).map((protocol, index) => <button className="protocol-row" key={protocol.id} onClick={() => openProtocol(protocol)}><span className="row-number">0{index + 1}</span><span className="row-main"><strong>{protocol.title}</strong><span>{protocol.category} <i>·</i> {protocol.duration}</span></span><span className={`status-pill ${protocol.status === "Đã duyệt" ? "approved" : "draft"}`}>{protocol.status}</span><ChevronRight size={16} /></button>)}</div></section><section className="content-panel sample-panel"><div className="panel-heading"><div><span className="panel-index">02 / SAMPLE INDEX</span><h2>Mẫu mới cập nhật</h2></div><button className="icon-button" onClick={() => setView("samples")}><MoreHorizontal size={18} /></button></div><div className="sample-stack">{samples.slice(0, 3).map(sample => <button className="sample-row" key={sample.id} onClick={() => openSample(sample)}><span className="sample-symbol"><Beaker size={16} /></span><span><strong>{sample.name}</strong><small>{sample.code} · {sample.updatedAt}</small></span><ChevronRight size={15} /></button>)}</div><div className="mini-theory"><Sparkles size={15} /><span><strong>Lab note</strong> — “Matrix matching” giúp giảm bias khi đọc assay màu.</span></div></section></div>
    <section className="quick-tools"><div className="quick-title"><span className="panel-index">03 / QUICK ACCESS</span><h2>Công cụ & tri thức</h2><p>Đi thẳng đến phần bạn cần trong ca làm việc.</p></div><button onClick={() => setView("calculator")} className="tool-card tool-teal"><span className="tool-icon"><Calculator size={19} /></span><strong>Pha loãng nồng độ</strong><small>C₁V₁ = C₂V₂</small><ChevronRight size={16} /></button><button onClick={() => setView("protocols")} className="tool-card tool-cream"><span className="tool-icon"><BookOpen size={19} /></span><strong>Protocol handbook</strong><small>Guides · notes · versions</small><ChevronRight size={16} /></button><button onClick={() => setView("samples")} className="tool-card tool-ink"><span className="tool-icon"><Archive size={19} /></span><strong>Sample theory</strong><small>Properties · references</small><ChevronRight size={16} /></button></section>
  </>;
}

function ProtocolsView({ protocols, selected, setSelected, openProtocol, onEdit, onDelete, onCreate, canEdit, canEditApproved, canDelete, search }: { protocols: Protocol[]; selected: Protocol | null; setSelected: (p: Protocol | null) => void; openProtocol: (p: Protocol) => void; onEdit: (protocol: Protocol) => void; onDelete: (id: string) => void; onCreate: () => void; canEdit: boolean; canEditApproved: boolean; canDelete: boolean; search: string }) {
  if (selected) return <ProtocolDetail protocol={selected} onBack={() => setSelected(null)} onEdit={() => onEdit(selected)} onDelete={onDelete} canEdit={canEdit && (canEditApproved || selected.status === "Bản nháp")} canDelete={canDelete} />;
  return <><PageIntro eyebrow="PROTOCOL HANDBOOK / 12 ENTRIES" title={<>Quy trình <em>đã được kiểm chứng.</em></>} description="Các phiên bản thao tác được review và lưu theo từng assay, để mỗi lần chạy đều có cùng một điểm bắt đầu." action={canEdit ? <Button className="primary-cta" onClick={onCreate}><Plus size={16} /> Thêm quy trình</Button> : <span className="last-sync"><ShieldCheck size={13} /> Viewer · read only</span>} /><div className="filter-row"><div className="filter-label"><ClipboardList size={15} /> {protocols.length} protocol {search && <span>cho “{search}”</span>}</div><div className="filter-chips"><button className="filter-chip active">Tất cả</button><button className="filter-chip">Đã duyệt <span>2</span></button><button className="filter-chip">Bản nháp <span>1</span></button></div></div><div className="protocol-cards">{protocols.map(protocol => <button key={protocol.id} className="protocol-card" onClick={() => openProtocol(protocol)}><div className="protocol-card-top"><span className="protocol-tag">{protocol.tag}</span><span className={`status-pill ${protocol.status === "Đã duyệt" ? "approved" : "draft"}`}>{protocol.status}</span></div><h2>{protocol.title}</h2><p>{protocol.summary}</p><div className="protocol-card-meta"><span><Clock3 size={13} /> {protocol.duration}</span><span><FilePenLine size={13} /> {protocol.version}</span><span className="meta-owner"><UserRound size={13} /> {protocol.owner}</span><ChevronRight size={16} /></div></button>)}</div></>;
}

function ProtocolDetail({ protocol, onBack, onEdit, onDelete, canEdit, canDelete }: { protocol: Protocol; onBack: () => void; onEdit: () => void; onDelete: (id: string) => void; canEdit: boolean; canDelete: boolean }) {
  return <><button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Tất cả quy trình</button><div className="detail-header"><div><span className="protocol-tag">{protocol.tag}</span><h1>{protocol.title}</h1><p>{protocol.summary}</p><div className="detail-meta"><span className={`status-pill ${protocol.status === "Đã duyệt" ? "approved" : "draft"}`}>{protocol.status}</span><span>Version {protocol.version}</span><span>Updated {protocol.updatedAt}</span><span>Owner {protocol.owner}</span></div></div><div className="detail-actions">{canEdit && <Button variant="outline" onClick={onEdit}><FilePenLine size={15} /> Chỉnh sửa</Button>}{canDelete && <button className="icon-button danger" onClick={() => onDelete(protocol.id)}><Trash2 size={16} /></button>}</div></div><div className="detail-layout"><section className="content-panel steps-panel"><div className="panel-heading"><div><span className="panel-index">RUNBOOK / SEQUENCE</span><h2>Trình tự thực hiện</h2></div><span className="duration-chip"><Clock3 size={14} /> {protocol.duration}</span></div><div className="step-list">{protocol.steps.map((step, index) => <div className="step-item" key={step.title}><div className="step-marker"><span>0{index + 1}</span></div><div className="step-content"><div className="step-heading"><h3>{step.title}</h3><span>{step.time}</span></div><p>{step.detail}</p></div></div>)}</div></section><aside className="detail-side"><div className="content-panel note-panel"><div className="panel-index">CHECK BEFORE RUN</div><h3>Lưu ý quan trọng</h3><ul>{protocol.notes.map(note => <li key={note}>{note}</li>)}</ul></div><div className="content-panel related-panel"><div className="panel-index">RELATED DATA</div><h3>Được dùng cùng</h3><button><Beaker size={16} /><span><strong>DNA standard mix</strong><small>Reference sample</small></span><ChevronRight size={14} /></button><button><Calculator size={16} /><span><strong>qPCR efficiency</strong><small>Calculator</small></span><ChevronRight size={14} /></button></div></aside></div></>;
}

function SamplesView({ samples, selected, setSelected, openSample, onCreate, onDelete, canManageApproved, search }: { samples: Sample[]; selected: Sample | null; setSelected: (s: Sample | null) => void; openSample: (s: Sample) => void; onCreate: () => void; onDelete: (id: string) => void; canManageApproved: boolean; search: string }) {
  if (selected) return <SampleDetail sample={selected} onBack={() => setSelected(null)} onDelete={() => onDelete(selected.id)} canDelete={canManageApproved || selected.status === "Bản nháp"} />;
  return <><PageIntro eyebrow="SAMPLE INDEX / REFERENCE LIBRARY" title={<>Mẫu có <em>context.</em></>} description="Từ đặc tính vật lý đến lý thuyết nền — mọi reference đều nằm cạnh nơi đội ngũ sử dụng nó." action={<Button className="primary-cta" onClick={onCreate}><Plus size={16} /> Thêm mẫu</Button>} /><div className="sample-filter"><span><FlaskConical size={15} /> {samples.length} entries</span><div><button className="filter-chip active">Tất cả mẫu</button><button className="filter-chip">Cell lysate</button><button className="filter-chip">Nucleic acid</button></div></div><div className="sample-grid">{samples.map(sample => <button className="sample-card" key={sample.id} onClick={() => openSample(sample)}><div className="sample-card-icon"><Beaker size={22} /></div><div className="sample-card-code">{sample.code}</div><h2>{sample.name}</h2><p>{sample.description}</p><div className="property-preview">{sample.properties.slice(0, 2).map(prop => <span key={prop.label}><small>{prop.label}</small><strong>{prop.value}</strong></span>)}</div><div className="sample-card-footer"><span>{sample.group}</span><span>{sample.updatedAt} <ChevronRight size={14} /></span></div></button>)}</div>{search && samples.length === 0 && <div className="empty-state"><Search size={24} /><h3>Chưa có reference phù hợp</h3><p>Thử một từ khóa khác hoặc bỏ bộ lọc tìm kiếm.</p></div>}</>;
}

function SampleDetail({ sample, onBack, onDelete, canDelete }: { sample: Sample; onBack: () => void; onDelete: () => void; canDelete: boolean }) {
  return <><button className="back-link" onClick={onBack}><ArrowLeft size={15} /> Tất cả mẫu</button><div className="detail-header sample-detail-header"><div><div className="sample-card-code">{sample.code}</div><h1>{sample.name}</h1><p>{sample.description}</p><div className="detail-meta"><span className="status-pill approved">{sample.status}</span><span>{sample.group}</span><span>Updated {sample.updatedAt}</span></div></div><div className="sample-card-icon large"><Beaker size={28} /></div>{canDelete && <button className="icon-button danger" onClick={onDelete} aria-label={`Xóa ${sample.name}`}><Trash2 size={16} /></button>}</div><div className="sample-detail-grid"><section className="content-panel"><div className="panel-index">01 / PROPERTIES</div><h2>Đặc tính & dữ liệu tham chiếu</h2><div className="properties-grid">{sample.properties.map(prop => <div key={prop.label}><small>{prop.label}</small><strong>{prop.value}</strong></div>)}</div></section><section className="content-panel theory-panel"><div className="panel-index">02 / THEORY NOTE</div><h2>Lý thuyết về mẫu</h2><p>{sample.theory}</p><div className="theory-source"><BookOpen size={15} /><span>Internal lab note · Reviewed by Lab owner</span></div></section></div></>;
}

function CalculatorView({ tools, onDesign, selectedCalc, setSelectedCalc, c1, v1, c2, v2, setC1, setV1, setC2, setV2, dilutionTarget, setDilutionTarget, dilutionConcentrationMode, setDilutionConcentrationMode, dilutionVolumeUnits, setDilutionVolumeUnits, dilutionConcentrationUnits, setDilutionConcentrationUnits, result, runCalculation, recent, clearHistory, deleteCalculation, canCalculate, volumeUnit, setVolumeUnit, cellUnit, setCellUnit, dilutionMode, setDilutionMode, dilutionFactorValue, setDilutionFactorValue, dilutionInitialVolume, setDilutionInitialVolume, dilutionAddedVolume, setDilutionAddedVolume }: { tools: CalculatorDefinition[]; onDesign: () => void; selectedCalc: string; setSelectedCalc: (id: string) => void; c1: string; v1: string; c2: string; v2: string; setC1: (v: string) => void; setV1: (v: string) => void; setC2: (v: string) => void; setV2: (v: string) => void; dilutionTarget: DilutionTarget; setDilutionTarget: (target: DilutionTarget) => void; dilutionConcentrationMode: "stock" | "percent"; setDilutionConcentrationMode: (mode: "stock" | "percent") => void; dilutionVolumeUnits: Record<"v1" | "v2", VolumeUnit>; setDilutionVolumeUnits: (units: Record<"v1" | "v2", VolumeUnit>) => void; dilutionConcentrationUnits: Record<"c1" | "c2", ConcentrationUnit>; setDilutionConcentrationUnits: (units: Record<"c1" | "c2", ConcentrationUnit>) => void; result: number | null; runCalculation: () => void; recent: string[]; clearHistory: () => void; deleteCalculation: (index: number) => void; canCalculate: boolean; volumeUnit: VolumeUnit; setVolumeUnit: (unit: VolumeUnit) => void; cellUnit: CellUnit; setCellUnit: (unit: CellUnit) => void; dilutionMode: DilutionMode; setDilutionMode: (mode: DilutionMode) => void; dilutionFactorValue: string; setDilutionFactorValue: (value: string) => void; dilutionInitialVolume: string; setDilutionInitialVolume: (value: string) => void; dilutionAddedVolume: string; setDilutionAddedVolume: (value: string) => void }) {
  const activeCalc = tools.find(calc => calc.id === selectedCalc) || tools[0];
  const isDilution = selectedCalc === "dilution";
  const isManualCount = selectedCalc === "manual-cell-count";
  const isCellsNeeded = selectedCalc === "cells-needed";
  const isVolumeToTake = selectedCalc === "volume-to-take";
  const renderField = (label: string, help: string, value: string, setter: (value: string) => void, unit: string) => <label>{label}<span>{help}</span><div><Input value={value} onChange={event => setter(event.target.value)} inputMode="decimal" /><b>{unit}</b></div></label>;
  const renderDilutionField = (label: string, help: string, value: string, setter: (value: string) => void, unit: string, options: readonly string[], setUnit: (value: string) => void, disabled: boolean) => <label>{label}<span>{help}</span><div className="dilution-field-unit"><Input value={value} onChange={event => setter(event.target.value)} inputMode="decimal" disabled={disabled} placeholder={disabled ? "Tự tính" : undefined} /><select value={unit} onChange={event => setUnit(event.target.value)} aria-label={`Đơn vị ${label}`}>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></div></label>;
  const unitSelect = (label: string, value: string, options: readonly string[], setter: (value: string) => void) => <label className="field-label">{label}<select value={value} onChange={event => setter(event.target.value)}>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>;
  const activeConcentrationUnits = dilutionConcentrationMode === "percent" ? { c1: "%" as const, c2: "%" as const } : dilutionConcentrationUnits;
  const concentrationOptions = dilutionConcentrationMode === "percent" ? ["%"] : CONCENTRATION_UNITS.filter(unit => unit !== "%");
  const dilutionResultUnit = dilutionTarget.startsWith("C") ? activeConcentrationUnits[dilutionTarget.toLowerCase() as "c1" | "c2"] : dilutionVolumeUnits[dilutionTarget.toLowerCase() as "v1" | "v2"];
  const dilutionEquation = dilutionTarget === "C1" ? "(C₂ × V₂) / V₁" : dilutionTarget === "V1" ? "(C₂ × V₂) / C₁" : dilutionTarget === "C2" ? "(C₁ × V₁) / V₂" : "(C₁ × V₁) / C₂";
  if (!tools.length) return <><PageIntro eyebrow="CALCULATION DESK" title={<>Công cụ <em>tính toán.</em></>} description="Chưa có công thức tính nào." action={<Button onClick={onDesign}>Tạo công thức</Button>} /></>;
  const calculatorPicker = <nav className="calculator-picker" aria-label="Chọn công cụ tính">{tools.map(tool => <button key={tool.id} className={tool.id === activeCalc.id ? "active" : ""} onClick={() => setSelectedCalc(tool.id)}>{tool.name}</button>)}</nav>;
  if (activeCalc.id === "hypoxia-headspace") return <><PageIntro eyebrow="CONDITION TOOL / HYPOXIA" title={<>Ước tính O₂ <em>trong hệ kín.</em></>} description="Kiểm tra ngân sách O₂ pha khí, không dự đoán pO₂ tại tế bào." />{calculatorPicker}<HypoxiaCalculator /></>;
  if (["Custom", "Hypoxia", "HighPressure"].includes(activeCalc.category)) return <><PageIntro eyebrow="CUSTOM CALCULATOR" title={<>Công cụ tính <em>theo công thức.</em></>} description="Nhập biến rồi tính ngay bằng công thức đã lưu." />{calculatorPicker}<CustomCalculator key={activeCalc.id} name={activeCalc.name} formula={activeCalc.formula} description={activeCalc.description} config={activeCalc.config} /></>;
  return <><PageIntro eyebrow={`CALCULATION DESK / ${tools.length} TOOLS`} title={<>Số liệu rõ ràng, <em>quyết định chắc tay.</em></>} description="Các công thức nhỏ, những điểm kiểm tra quan trọng — được gói trong một workflow nhất quán." action={<Button className="primary-cta" onClick={onDesign}><FilePenLine size={16} /> Thiết kế page công cụ</Button>} /><div className="calculator-layout"><aside className="calculator-nav content-panel"><div className="panel-index">AVAILABLE TOOLS</div>{tools.map(calc => <button key={calc.id} className={`calc-nav-item ${selectedCalc === calc.id ? "active" : ""}`} onClick={() => setSelectedCalc(calc.id)}><span className={`calc-dot ${calc.color}`} /><span><strong>{calc.name}</strong><small>{calc.category}</small></span><ChevronRight size={14} /></button>)}<div className="calculator-tip"><Sparkles size={14} /><span>Công thức được cấu hình bởi owner và version hóa cùng protocol.</span></div></aside><section className="calc-workbench"><div className="formula-card"><span className="panel-index">FORMULA / {activeCalc.id.toUpperCase()}</span><div className="formula-title"><div><h2>{activeCalc.name}</h2><p>{activeCalc.description}</p></div><div className="formula">{activeCalc.formula}</div></div></div><div className="calc-form-card content-panel">{(selectedCalc === "molarity" || isCellsNeeded || isVolumeToTake || (isManualCount && dilutionMode === "volumes")) && unitSelect("Đơn vị thể tích", volumeUnit, VOLUME_UNITS, value => setVolumeUnit(value as VolumeUnit))}{(isCellsNeeded || isVolumeToTake) && unitSelect(isVolumeToTake ? "Đơn vị số tế bào hiện có" : "Đơn vị mục tiêu", cellUnit, ["cell", "cell/mL", "cell/giếng", "cell/flask"], value => setCellUnit(value as CellUnit))}{isManualCount && <div className="result-toggle"><span>Cách tính hệ số pha loãng</span><button className={dilutionMode === "factor" ? "active" : ""} onClick={() => setDilutionMode("factor")}>Dùng hệ số</button><button className={dilutionMode === "volumes" ? "active" : ""} onClick={() => setDilutionMode("volumes")}>Từ thể tích ban đầu + thể tích pha thêm</button></div>}<div className="calc-input-grid">{isDilution ? <div className="dilution-tool"><div className="result-toggle dilution-mode-toggle"><span>Cách tính pha loãng nồng độ</span><button className={dilutionConcentrationMode === "stock" ? "active" : ""} onClick={() => setDilutionConcentrationMode("stock")}>Đơn vị stock</button><button className={dilutionConcentrationMode === "percent" ? "active" : ""} onClick={() => setDilutionConcentrationMode("percent")}>% stock</button></div><div className="dilution-target-tabs" role="tablist" aria-label="Chọn đại lượng cần tính">{(["C1", "V1", "C2", "V2"] as DilutionTarget[]).map(target => <button type="button" key={target} className={dilutionTarget === target ? "active" : ""} onClick={() => setDilutionTarget(target)}>Tính {target.replace("1", "₁").replace("2", "₂")}</button>)}</div><p className="dilution-note">Nhập ba đại lượng đã biết; đại lượng đang chọn sẽ được tự tính. Đổi đơn vị ngay trên từng ô.</p><div className="calc-input-grid">{renderDilutionField("C₁", "Nồng độ stock", c1, setC1, activeConcentrationUnits.c1, concentrationOptions, value => { if (dilutionConcentrationMode === "stock") setDilutionConcentrationUnits({ ...dilutionConcentrationUnits, c1: value as ConcentrationUnit }); }, dilutionTarget === "C1")}{renderDilutionField("V₁", "Thể tích stock", v1, setV1, dilutionVolumeUnits.v1, VOLUME_UNITS, value => setDilutionVolumeUnits({ ...dilutionVolumeUnits, v1: value as VolumeUnit }), dilutionTarget === "V1")}{renderDilutionField("C₂", "Nồng độ mong muốn", c2, setC2, activeConcentrationUnits.c2, concentrationOptions, value => { if (dilutionConcentrationMode === "stock") setDilutionConcentrationUnits({ ...dilutionConcentrationUnits, c2: value as ConcentrationUnit }); }, dilutionTarget === "C2")}{renderDilutionField("V₂", "Thể tích cuối", v2, setV2, dilutionVolumeUnits.v2, VOLUME_UNITS, value => setDilutionVolumeUnits({ ...dilutionVolumeUnits, v2: value as VolumeUnit }), dilutionTarget === "V2")}</div></div> : selectedCalc === "viability" ? <>{renderField("Sống", "Số tế bào sống", c1, setC1, "cells")}{renderField("Tổng", "Tổng số tế bào", v1, setV1, "cells")}</> : isManualCount ? <>{renderField("Tổng số tế bào đếm được", "Tổng trong các ô đã đếm", c1, setC1, "cells")}{renderField("Số ô đã đếm", "Số ô lớn / ô vuông", v1, setV1, "ô")}{dilutionMode === "factor" ? renderField("Hệ số pha loãng", "Ví dụ 2 nếu pha 1:1", dilutionFactorValue, setDilutionFactorValue, "×") : <>{renderField("Thể tích ban đầu", "Thể tích mẫu trước pha", dilutionInitialVolume, setDilutionInitialVolume, volumeUnit)}{renderField("Thể tích pha thêm", "Thể tích dung dịch pha thêm", dilutionAddedVolume, setDilutionAddedVolume, volumeUnit)}</>}</> : isCellsNeeded ? <>{renderField("Mật độ mục tiêu", "Mật độ tế bào cần seed", c1, setC1, cellUnit)}{cellUnit !== "cell" && renderField("Số đơn vị", "Số giếng hoặc flask", v1, setV1, "đơn vị")}{cellUnit === "cell/mL" && renderField("Thể tích / đơn vị", "Thể tích môi trường mỗi đơn vị", c2, setC2, volumeUnit)}</> : isVolumeToTake ? <>{renderField("Số tế bào mong muốn", "Tổng số tế bào cần lấy", c1, setC1, "cell")}{renderField(cellUnit === "cell" ? "Tổng số tế bào hiện có" : "Số tế bào hiện có theo đơn vị", cellUnit === "cell" ? "Tổng toàn bộ tế bào, không phụ thuộc số giếng/flask" : "Nhập mật độ hoặc số tế bào mỗi giếng/flask", v1, setV1, cellUnit)}{renderField("Tổng thể tích hiện có", "V của suspension", c2, setC2, volumeUnit)}{(cellUnit === "cell/giếng" || cellUnit === "cell/flask") && renderField("Số giếng / flask hiện có", "Để quy đổi số tế bào mỗi đơn vị về tổng số", v2, setV2, cellUnit === "cell/giếng" ? "giếng" : "flask")}</> : <>{renderField("C", "Nồng độ mol", c1, setC1, "M")}{renderField("V", "Thể tích dung dịch", v1, setV1, volumeUnit)}{renderField("MW", "Khối lượng phân tử", c2, setC2, "g/mol")}</>}</div><div className="calc-result"><div><span className="panel-index">RESULT / {isDilution ? dilutionTarget : activeCalc.name}</span><strong>{result === null ? "—" : formatNumber(result)} <small>{isDilution ? dilutionResultUnit : selectedCalc === "viability" ? "%" : selectedCalc === "molarity" ? "g" : selectedCalc === "volume-to-take" ? volumeUnit : selectedCalc === "manual-cell-count" ? "cell/mL" : selectedCalc === "cells-needed" ? "cells" : volumeUnit}</small></strong></div><div className="result-equation">{isDilution ? dilutionEquation : activeCalc.formula}</div></div><div className="calc-actions"><Button disabled={!canCalculate} onClick={runCalculation} className="primary-cta"><Gauge size={16} /> {canCalculate ? "Tính & lưu kết quả" : "Viewer chỉ được xem"}</Button><span><ShieldCheck size={14} /> Kiểm tra đầu vào tự động</span></div></div><div className="history-card content-panel"><div className="panel-heading"><div><span className="panel-index">SESSION HISTORY</span><h2>Lần tính gần đây</h2></div><button className="text-button" onClick={clearHistory}>Xóa lịch sử</button></div>{recent.length ? recent.map((item, index) => <div className="history-row" key={`${item}-${index}`}><span className="history-number">0{index + 1}</span><span>{item}</span><button type="button" className="icon-button danger" onClick={() => deleteCalculation(index)} aria-label={`Xóa phép tính ${index + 1}`}><Trash2 size={14} /></button></div>) : <div className="empty-state"><p>Chưa có phép tính trong phiên này.</p></div>}</div></section></div></>;
}

function AdminView({ isAdmin, protocols, samples, draftOwner, setDraftOwner, draftCategory, setDraftCategory, calculators, onEditCalculator, onDeleteCalculator, onCreateProtocol, draftType, setDraftType, draftTitle, setDraftTitle, draftBody, setDraftBody, draftFormula, setDraftFormula, draftInputUnits, setDraftInputUnits, draftItems, setDraftItems, draftOutputUnit, setDraftOutputUnit, onSave, onDeleteProtocol, onEditSample }: { isAdmin: boolean; protocols: Protocol[]; samples: Sample[]; draftOwner: string; setDraftOwner: (value: string) => void; draftCategory: "Custom" | SpecialCategory; setDraftCategory: (value: "Custom" | SpecialCategory) => void; calculators: CalculatorDefinition[]; onEditCalculator: (id: string) => void; onDeleteCalculator: (id: string) => void; onCreateProtocol: () => void; draftType: "Quy trình" | "Mẫu" | "Lý thuyết" | "Phương trình"; setDraftType: (t: "Quy trình" | "Mẫu" | "Lý thuyết" | "Phương trình") => void; draftTitle: string; setDraftTitle: (s: string) => void; draftBody: string; setDraftBody: (s: string) => void; draftFormula: string; setDraftFormula: (s: string) => void; draftInputUnits: Record<string, string>; setDraftInputUnits: (value: Record<string, string>) => void; draftItems: FormulaItem[]; setDraftItems: (value: FormulaItem[]) => void; draftOutputUnit: string; setDraftOutputUnit: (value: string) => void; onSave: () => void; onDeleteProtocol: (id: string) => void; onEditSample: (sample: Sample) => void }) {
  const formulaVariables = (() => { try { return draftFormula.trim() ? getFormulaVariables(draftFormula) : []; } catch { return []; } })();
  return <><PageIntro eyebrow="OWNER CONSOLE / CONTENT CONTROL" title={<>Chủ động giữ kho <em>luôn đúng.</em></>} description="Phân bổ nội dung thành các page, từng bước quy trình và từng phương trình tool — không cần viết code." action={<div className="intro-actions"><Button className="primary-cta" onClick={onCreateProtocol}><Plus size={16} /> Thiết kế quy trình theo bước</Button><div className="owner-chip"><ShieldCheck size={15} /> Public editor</div></div>} /><div className="admin-layout"><section className="content-panel editor-panel"><div className="panel-heading"><div><span className="panel-index">PAGE TYPES / CONTENT BLOCKS</span><h2>Thêm nội dung vào kho</h2></div><span className="draft-badge">Server saved</span></div><div className="editor-tabs">{(["Quy trình", "Mẫu", "Lý thuyết", "Phương trình"] as const).map(type => <button key={type} className={draftType === type ? "active" : ""} onClick={() => setDraftType(type)}>{type}</button>)}</div>{(draftType === "Quy trình" || draftType === "Phương trình") && <label className="field-label">Nhóm nội dung<select value={draftCategory} onChange={event => setDraftCategory(event.target.value as "Custom" | SpecialCategory)}><option value="Custom">Thư viện chung</option><option value="Hypoxia">Nuôi cấy Hypoxia</option><option value="HighPressure">Nuôi cấy áp suất cao</option></select></label>}<label className="field-label">Tiêu đề / tên reference<Input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder={draftType === "Quy trình" ? "VD: Western blot — membrane transfer" : "VD: Recombinant protein R-102"} /></label>{draftType === "Quy trình" && <label className="field-label">Người viết quy trình<Input value={draftOwner} onChange={event => setDraftOwner(event.target.value)} placeholder="VD: Nguyễn Văn A" /></label>}<label className="field-label">Mô tả hoặc ghi chú nội bộ<Textarea value={draftBody} onChange={e => setDraftBody(e.target.value)} placeholder="Viết thông tin để team có thể dùng ngay…" rows={6} /></label>{draftType === "Phương trình" && <label className="field-label">Phương trình<Input value={draftFormula} onChange={e => setDraftFormula(e.target.value)} placeholder="VD: N_mong_muon / N_tong * V_tong" /><small>Biến dùng chữ không dấu/ASCII; hỗ trợ +, -, *, /, ^, sqrt(...) và dấu ngoặc. Dùng danh sách mục bên dưới để chọn biến; nhãn đơn vị không tự quy đổi.</small></label>}{draftType === "Phương trình" && <div className="formula-item-editor"><div className="formula-item-heading"><strong>Các mục dùng trong phép tính</strong><small>Thêm từng đại lượng, đặt mã biến để chọn đưa vào phương trình.</small></div>{draftItems.map((item, index) => <div className="formula-item-row" key={`${item.key}-${index}`}><Input value={item.key} onChange={event => { const next = [...draftItems]; next[index] = { ...item, key: event.target.value }; setDraftItems(next); }} placeholder="Mã biến: V_mau" /><Input value={item.label} onChange={event => { const next = [...draftItems]; next[index] = { ...item, label: event.target.value }; setDraftItems(next); }} placeholder="Tên hiển thị: Thể tích mẫu" /><Input value={item.unit} onChange={event => { const next = [...draftItems]; next[index] = { ...item, unit: event.target.value }; setDraftItems(next); }} placeholder="Đơn vị: mL" /><button type="button" className="icon-button" onClick={() => setDraftItems(draftItems.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Xóa mục ${item.label || item.key}`}><Trash2 size={14} /></button></div>)}<div className="formula-item-actions"><Button type="button" onClick={() => setDraftItems([...draftItems, { key: `x_${draftItems.length + 1}`, label: "", unit: "" }])}><Plus size={14} /> Thêm mục</Button>{draftItems.length > 0 && <select value="" onChange={event => { const key = event.target.value; if (!key) return; setDraftFormula(draftFormula ? `${draftFormula} * ${key}` : key); }}><option value="">Chọn mục để thêm vào phương trình</option>{draftItems.map(item => <option key={item.key} value={item.key}>{item.label || item.key} · {item.key}</option>)}</select>}</div><label className="field-label">Đơn vị kết quả<Input value={draftOutputUnit} onChange={event => setDraftOutputUnit(event.target.value)} placeholder="VD: giờ" /></label></div>}<div className="editor-footer"><span><FilePenLine size={14} /> Thay đổi được lưu trực tiếp vào kho dữ liệu</span><Button onClick={onSave} className="primary-cta"><Check size={15} /> Lưu {draftType === "Phương trình" ? "tool" : "bản nháp"}</Button></div></section><aside className="content-panel inventory-panel"><div className="panel-heading"><div><span className="panel-index">CONTENT INVENTORY</span><h2>Đang quản lý</h2></div><MoreHorizontal size={18} /></div><div className="inventory-group"><span className="inventory-label">Quy trình <b>{protocols.length}</b></span>{protocols.slice(0, 4).map(protocol => <div className="inventory-row" key={protocol.id}><span className="inventory-dot teal" /><span>{protocol.title}</span>{(isAdmin || protocol.status === "Bản nháp") && <button onClick={() => onDeleteProtocol(protocol.id)} aria-label={`Xóa ${protocol.title}`}><Trash2 size={13} /></button>}</div>)}</div><div className="inventory-group"><span className="inventory-label">Mẫu & lý thuyết <b>{samples.length}</b></span>{samples.slice(0, 3).map(sample => <div className="inventory-row" key={sample.id}><span className="inventory-dot amber" /><span>{sample.name}</span>{(isAdmin || sample.status === "Bản nháp") && <button onClick={() => onEditSample(sample)} aria-label={`Sửa ${sample.name}`}><FilePenLine size={13} /></button>}</div>)}</div><div className="inventory-group"><span className="inventory-label">Công thức tính <b>{calculators.length}</b></span>{calculators.map(calculator => <div className="inventory-row" key={calculator.id}><span className="inventory-dot blue" /><span>{calculator.name}</span>{(isAdmin || calculator.status === "Bản nháp") && <button onClick={() => onEditCalculator(calculator.id)} aria-label={`Sửa ${calculator.name}`}><FilePenLine size={13} /></button>}{(isAdmin || calculator.status === "Bản nháp") && <button onClick={() => onDeleteCalculator(calculator.id)} aria-label={`Xóa ${calculator.name}`}><Trash2 size={13} /></button>}</div>)}</div><div className="admin-note"><ShieldCheck size={15} /><span><strong>Public page editor</strong>Mọi người đều có thể mở và chỉnh sửa page.</span></div></aside></div><section className="content-panel team-panel"><div className="panel-heading"><div><span className="panel-index">EDITOR MAP / 04 MODULES</span><h2>Các loại nội dung</h2></div></div><div className="role-guide"><span><b className="role-admin">Quy trình</b> Page + các bước chi tiết</span><span><b className="role-researcher">Mẫu & lý thuyết</b> Reference + context</span><span><b className="role-viewer">Phương trình</b> Tạo tool tính mới</span></div></section></>;
}

function UserLoginView({ onSuccess }: { onSuccess: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = trpc.auth.userLogin.useMutation({ onSuccess, onError: error => toast.error(error.message) });
  return <><PageIntro eyebrow="USER ACCESS / SIGN-IN" title={<>Đăng nhập <em>tài khoản User.</em></>} description="Đăng nhập để quản lý email và mật khẩu của tài khoản nghiên cứu. Username không thể thay đổi." /><section className="content-panel auth-card-inline"><div className="panel-heading"><div><span className="panel-index">USER LOGIN</span><h2>Truy cập tài khoản</h2></div><UserRound size={20} /></div><label className="field-label">Username hoặc email<Input value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="Username hoặc email" autoComplete="username" /></label><label className="field-label">Mật khẩu<Input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label><div className="editor-footer"><span>Tài khoản mới cần được Admin duyệt trước khi đăng nhập.</span><Button className="primary-cta" onClick={() => loginMutation.mutate({ identifier, password })}>Đăng nhập User</Button></div></section></>;
}

function UserAccountView({ user, onSave, onLogout }: { user: { id: number; username?: string | null; name?: string | null; email?: string | null }; onSave: (email: string, currentPassword: string, newPassword: string) => void; onLogout: () => void }) {
  const [email, setEmail] = useState(user.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const submit = () => {
    if (!email.trim()) return toast.error("Vui lòng nhập email.");
    if (!currentPassword) return toast.error("Nhập mật khẩu hiện tại để xác nhận thay đổi.");
    if (newPassword && newPassword !== confirmPassword) return toast.error("Mật khẩu mới nhập lại không khớp.");
    if (newPassword && newPassword.length < 8) return toast.error("Mật khẩu mới cần tối thiểu 8 ký tự.");
    onSave(email.trim(), currentPassword, newPassword);
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
  };
  return <><PageIntro eyebrow="USER ACCOUNT / SETTINGS" title={<>Tài khoản <em>của bạn.</em></>} description="Cập nhật email hoặc đặt lại mật khẩu. Username là định danh cố định và chỉ được xem." action={<Button variant="outline" onClick={onLogout}>Đăng xuất</Button>} /><section className="content-panel account-panel"><div className="panel-heading"><div><span className="panel-index">ACCOUNT PROFILE</span><h2>{user.name || user.username || "User"}</h2></div><UserRound size={22} /></div><label className="field-label">Username<Input value={user.username ?? ""} readOnly disabled /><small>Username không thể thay đổi.</small></label><label className="field-label">Email<Input value={email} onChange={event => setEmail(event.target.value)} type="email" autoComplete="email" /></label><div className="account-divider"><span className="panel-index">PASSWORD CHANGE</span><p>Nhập mật khẩu hiện tại để đổi email hoặc mật khẩu.</p></div><label className="field-label">Mật khẩu hiện tại<Input value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} type="password" autoComplete="current-password" /></label><div className="account-password-grid"><label className="field-label">Mật khẩu mới<Input value={newPassword} onChange={event => setNewPassword(event.target.value)} type="password" autoComplete="new-password" placeholder="Để trống nếu chỉ đổi email" /></label><label className="field-label">Nhập lại mật khẩu mới<Input value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" /></label></div><div className="editor-footer"><span>Email mới cần chưa được tài khoản khác sử dụng.</span><Button className="primary-cta" onClick={submit}>Lưu thay đổi</Button></div></section></>;
}

function AdminLoginView({ onSuccess }: { onSuccess: () => void }) {
  const [registering, setRegistering] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = trpc.auth.adminLogin.useMutation({ onSuccess, onError: error => toast.error(error.message) });
  const registerMutation = trpc.auth.register.useMutation({ onSuccess: result => { toast.success(result.message); setRegistering(false); setIdentifier(username); }, onError: error => toast.error(error.message) });
  return <><PageIntro eyebrow="ADMIN ACCESS / SECURE SIGN-IN" title={<>Khu vực <em>quản trị riêng.</em></>} description="Nội dung công khai vẫn dùng được không cần đăng nhập. Chỉ tài khoản Admin mới mở được bảng account và duyệt nội dung." /><section className="content-panel auth-card-inline"><div className="panel-heading"><div><span className="panel-index">{registering ? "REGISTER USER" : "ADMIN LOGIN"}</span><h2>{registering ? "Đăng ký tài khoản User" : "Đăng nhập Admin"}</h2></div><ShieldCheck size={20} /></div>{registering ? <><label className="field-label">Username<Input value={username} onChange={event => setUsername(event.target.value)} placeholder="Ví dụ: lab.user" autoComplete="username" /></label><label className="field-label">Họ và Tên<Input value={name} onChange={event => setName(event.target.value)} placeholder="Nhập họ và tên đầy đủ" /></label><label className="field-label">Email<Input value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" type="email" autoComplete="email" /></label><label className="field-label">Mật khẩu<Input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" /></label><div className="editor-footer"><Button variant="outline" onClick={() => setRegistering(false)}>Quay lại đăng nhập</Button><Button className="primary-cta" onClick={() => registerMutation.mutate({ username, name, email, password })}>Tạo tài khoản User</Button></div></> : <><label className="field-label">Username hoặc email<Input value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="Username hoặc email admin" autoComplete="username" /></label><label className="field-label">Mật khẩu<Input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label><div className="editor-footer"><Button variant="outline" onClick={() => setRegistering(true)}>Đăng ký User</Button><Button className="primary-cta" onClick={() => loginMutation.mutate({ identifier, password })}>Đăng nhập Admin</Button></div></>}</section></>;
}

function AdminAccountsView({ team, onApprovalChange, onRoleChange, onRevokeAccess, onDeleteUser, canManagePasswords, viewerId, onResetPassword }: { team: TeamMember[]; onApprovalChange: (id: number, status: TeamMember["approvalStatus"]) => void; onRoleChange: (id: number, role: "admin" | "user") => void; onRevokeAccess: (id: number) => void; onDeleteUser: (id: number) => void; canManagePasswords: boolean; viewerId: number; onResetPassword: (id: number, password: string) => void }) {
  const pending = team.filter(member => member.approvalStatus === "pending");
  const [revealed, setRevealed] = useState<{ id: number; password: string } | null>(null);
  const [viewTarget, setViewTarget] = useState<TeamMember | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [resetTarget, setResetTarget] = useState<TeamMember | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const viewPasswordMutation = trpc.team.viewPassword.useMutation({
    onSuccess: (result, input) => {
      if (result.available && result.password !== null) setRevealed({ id: input.id, password: result.password });
      else toast.info("Mật khẩu hiện tại không thể khôi phục. Có thể đặt lại mật khẩu mới.");
      viewPasswordMutation.reset();
    },
    onError: error => { toast.error(error.message); viewPasswordMutation.reset(); },
  });
  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(null), 30_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);
  const isProtectedAdmin = (member: TeamMember) => member.username?.toLowerCase() === "wstratos";
  const canView = (member: TeamMember) => member.loginMethod === "email" && (canManagePasswords || member.role !== "admin" || member.id === viewerId);
  const revoke = (member: TeamMember) => {
    if (window.confirm(`Thu hồi quyền truy cập của User ${member.username || member.name}? Tài khoản sẽ không thể đăng nhập cho đến khi được Admin duyệt lại.`)) onRevokeAccess(member.id);
  };
  const deleteUser = (member: TeamMember) => {
    if (window.confirm(`Xoá User ${member.username || member.name}? Thao tác này xoá vĩnh viễn tài khoản.`) && window.confirm("Xác nhận lần cuối: xoá tài khoản User này?")) onDeleteUser(member.id);
  };
  const submitView = (event: React.FormEvent) => {
    event.preventDefault();
    if (!viewTarget || !currentPassword) return;
    viewPasswordMutation.mutate({ id: viewTarget.id, currentPassword });
    setCurrentPassword("");
    setViewTarget(null);
  };
  const credentialActions = (member: TeamMember) => canView(member) ? <>
    <Button variant="outline" disabled={viewPasswordMutation.isPending} onClick={() => { setRevealed(null); setViewTarget(member); setCurrentPassword(""); }}>Xem mật khẩu</Button>
    <Button variant="outline" onClick={() => { setRevealed(null); setResetTarget(member); setNewPassword(""); setPasswordConfirmation(""); }}>Đặt lại mật khẩu</Button>
    {revealed?.id === member.id && <span className="password-reveal"><code>{revealed.password}</code><button type="button" onClick={() => setRevealed(null)}>Ẩn</button></span>}
  </> : null;
  const submitReset = (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetTarget || newPassword.length < 8 || newPassword !== passwordConfirmation) {
      toast.error("Mật khẩu phải có ít nhất 8 ký tự và hai lần nhập phải khớp.");
      return;
    }
    onResetPassword(resetTarget.id, newPassword);
    setNewPassword("");
    setPasswordConfirmation("");
    setResetTarget(null);
    setRevealed(null);
  };
  return <>
    <PageIntro eyebrow="ADMIN / ACCOUNT MANAGEMENT" title={<>Quản lý <em>tài khoản workspace.</em></>} description="Duyệt tài khoản, điều chỉnh quyền và quản lý User." />
    <section className="content-panel team-panel">
      <div className="panel-heading"><div><span className="panel-index">PENDING ACCOUNTS / {pending.length}</span><h2>Tài khoản mới đăng ký</h2></div><span className="team-policy">{team.length} tài khoản</span></div>
      {pending.length ? pending.map(member => <div className="team-row" key={member.id}>
        <UserAvatar name={member.name} /><span className="team-identity"><strong>{member.username || member.name}</strong><small>{member.name} · {member.email} · đăng ký {member.lastActive}</small></span>
        <Button variant="outline" onClick={() => onApprovalChange(member.id, "rejected")}>Từ chối</Button>
        <Button className="primary-cta" onClick={() => onApprovalChange(member.id, "approved")}>Duyệt</Button>
        <Button variant="outline" onClick={() => deleteUser(member)}>Xoá User</Button>{credentialActions(member)}
      </div>) : <div className="empty-state"><Check size={24} /><h3>Không có tài khoản chờ duyệt</h3><p>Tài khoản User mới sẽ xuất hiện ở đây.</p></div>}
    </section>
    <section className="content-panel team-panel">
      <div className="panel-heading"><div><span className="panel-index">ACCOUNT DIRECTORY</span><h2>Tất cả tài khoản</h2></div></div>
      {team.map(member => <div className="team-row" key={member.id}>
        <UserAvatar name={member.name} /><span className="team-identity"><strong>{member.username || member.name}</strong><small>{member.name} · {member.email || "Chưa có email"} · {member.loginMethod || "email"}</small></span>
        <span className={`role-pill ${member.role === "admin" ? "admin" : "user"}`}>{member.role === "admin" ? "Admin" : "User"}</span>
        <select disabled={isProtectedAdmin(member)} value={member.role === "admin" ? "admin" : "user"} onChange={event => { setRevealed(null); onRoleChange(member.id, event.target.value as "admin" | "user"); }} aria-label={`Quyền của ${member.username || member.name}`}><option value="user">User</option><option value="admin">Admin</option></select>
        {!isProtectedAdmin(member) && member.role !== "admin" && member.approvalStatus === "approved" && <><Button variant="outline" onClick={() => revoke(member)}>Thu hồi quyền</Button><Button variant="outline" onClick={() => deleteUser(member)}>Xoá User</Button></>}
        {!isProtectedAdmin(member) && member.role !== "admin" && member.approvalStatus === "rejected" && <><Button variant="outline" onClick={() => onApprovalChange(member.id, "approved")}>Khôi phục quyền</Button><Button variant="outline" onClick={() => deleteUser(member)}>Xoá User</Button></>}
        {credentialActions(member)}
      </div>)}
    </section>
    {viewTarget && <section className="content-panel team-panel" aria-label="Xem mật khẩu">
      <h2>Xem mật khẩu · {viewTarget.username || viewTarget.name}</h2>
      <form onSubmit={submitView} className="password-reset-form">
        <label className="field-label">Xác nhận mật khẩu Admin của bạn<Input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required /></label>
        <Button type="button" variant="outline" onClick={() => { setViewTarget(null); setCurrentPassword(""); }}>Huỷ</Button>
        <Button type="submit" className="primary-cta">Xác nhận và xem</Button>
      </form>
    </section>}
    {resetTarget && <section className="content-panel team-panel" aria-label="Đặt lại mật khẩu">
      <h2>Đặt lại mật khẩu · {resetTarget.username || resetTarget.name}</h2>
      <form onSubmit={submitReset} className="password-reset-form">
        <label className="field-label">Mật khẩu mới<Input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={8} required /></label>
        <label className="field-label">Nhập lại mật khẩu<Input type="password" autoComplete="new-password" value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} minLength={8} required /></label>
        <Button type="button" variant="outline" onClick={() => { setResetTarget(null); setNewPassword(""); setPasswordConfirmation(""); }}>Huỷ</Button>
        <Button type="submit" className="primary-cta">Lưu mật khẩu mới</Button>
      </form>
    </section>}
  </>;
}
function AdminReviewView({ protocols, samples, calculators, onApproveProtocol, onApproveSample, onApproveCalculator }: { protocols: Protocol[]; samples: Sample[]; calculators: CalculatorDefinition[]; onApproveProtocol: (id: number) => void; onApproveSample: (id: number) => void; onApproveCalculator: (id: number) => void }) {
  const draftProtocols = protocols.filter(item => item.status !== "Đã duyệt");
  const draftSamples = samples.filter(item => item.status === "Bản nháp");
  const draftCalculators = calculators.filter(item => item.status === "Bản nháp");
  return <section className="content-panel team-panel"><div className="panel-heading"><div><span className="panel-index">CONTENT REVIEW / {draftProtocols.length + draftSamples.length + draftCalculators.length}</span><h2>Duyệt bản nháp</h2></div><span className="team-policy">Admin approval</span></div>{draftProtocols.map(item => <div className="team-row" key={`protocol-${item.id}`}><span className="inventory-dot teal" /><span className="team-identity"><strong>{item.title}</strong><small>Quy trình · {item.owner}</small></span><Button className="primary-cta" onClick={() => onApproveProtocol(Number(item.id))}>Duyệt</Button></div>)}{draftSamples.map(item => <div className="team-row" key={`sample-${item.id}`}><span className="inventory-dot amber" /><span className="team-identity"><strong>{item.name}</strong><small>Mục lý thuyết · {item.group}</small></span><Button className="primary-cta" onClick={() => onApproveSample(Number(item.id))}>Duyệt</Button></div>)}{draftCalculators.map(item => <div className="team-row" key={`calculator-${item.id}`}><span className="inventory-dot blue" /><span className="team-identity"><strong>{item.name}</strong><small>Công cụ tính · {item.category}</small></span><Button className="primary-cta" onClick={() => onApproveCalculator(item.dbId ?? 0)}>Duyệt</Button></div>)}{!draftProtocols.length && !draftSamples.length && !draftCalculators.length && <div className="empty-state"><Check size={24} /><h3>Không có bản nháp chờ duyệt</h3><p>Các nội dung mới sẽ xuất hiện ở đây.</p></div>}</section>;
}

function ProtocolEditorPage({ title, owner, body, steps, category, setTitle, setOwner, setBody, setSteps, onSave, onCancel }: { title: string; owner: string; body: string; steps: ProtocolStep[]; category: "Custom" | SpecialCategory; setTitle: (value: string) => void; setOwner: (value: string) => void; setBody: (value: string) => void; setSteps: React.Dispatch<React.SetStateAction<ProtocolStep[]>>; onSave: () => void; onCancel: () => void }) {
  const updateStep = (index: number, key: keyof ProtocolStep, value: string) => setSteps(current => current.map((step, stepIndex) => stepIndex === index ? { ...step, [key]: value } : step));
  return <><button className="back-link" onClick={onCancel}><ArrowLeft size={15} /> {category === "Custom" ? "Quay lại danh sách quy trình" : "Quay lại thí nghiệm điều kiện đặc trưng"}</button><PageIntro eyebrow="PROTOCOL BUILDER / STEP-BY-STEP" title={<>Thiết kế <em>quy trình theo bước.</em></>} description="Mỗi bước có tên, hướng dẫn chi tiết và thời gian riêng; có thể thêm, xóa hoặc sắp xếp lại trước khi lưu." action={<Button className="primary-cta" onClick={() => setSteps(current => [...current, { title: "", detail: "", time: "" }])}><Plus size={16} /> Thêm bước</Button>} /><section className="content-panel editor-panel"><div className="panel-heading"><div><span className="panel-index">PROTOCOL PAGE / STRUCTURE</span><h2>Thông tin chung</h2></div><span className="draft-badge">{category === "Custom" ? "Bản nháp" : SPECIAL_CATEGORY_LABEL[category]}</span></div><label className="field-label">Tên quy trình<Input value={title} onChange={event => setTitle(event.target.value)} placeholder="VD: Perfusion" /></label><label className="field-label">Người viết quy trình<Input value={owner} onChange={event => setOwner(event.target.value)} placeholder="VD: Nguyễn Văn A" /></label><label className="field-label">Tóm tắt quy trình<Textarea value={body} onChange={event => setBody(event.target.value)} placeholder="Mục tiêu, phạm vi và điều kiện áp dụng…" rows={4} /></label><div className="step-editor-list">{steps.map((step, index) => <div className="step-editor-card" key={`draft-step-${index}`}><div className="step-editor-head"><span className="step-marker"><span>{String(index + 1).padStart(2, "0")}</span></span><strong>Bước {index + 1}</strong>{steps.length > 1 && <button className="icon-button danger" onClick={() => setSteps(current => current.filter((_, stepIndex) => stepIndex !== index))} aria-label={`Xóa bước ${index + 1}`}><Trash2 size={15} /></button>}</div><div className="step-editor-grid"><label className="field-label">Tên bước<Input value={step.title} onChange={event => updateStep(index, "title", event.target.value)} placeholder="VD: Cân gan" /></label><label className="field-label">Thời gian / điều kiện<Input value={step.time} onChange={event => updateStep(index, "time", event.target.value)} placeholder="VD: 10 phút · 4°C" /></label></div><label className="field-label">Hướng dẫn chi tiết<Textarea value={step.detail} onChange={event => updateStep(index, "detail", event.target.value)} placeholder="Mô tả thao tác, thể tích, tốc độ ly tâm, nhiệt độ…" rows={4} /></label></div>)}</div><div className="editor-footer"><span><FilePenLine size={14} /> Các bước được lưu riêng trong database</span><div><Button variant="outline" onClick={onCancel}>Hủy</Button><Button onClick={onSave} className="primary-cta"><Check size={15} /> Lưu bản nháp</Button></div></div></section></>;
}
