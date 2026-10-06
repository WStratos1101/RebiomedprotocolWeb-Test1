import { useState } from "react";
import { CalendarDays, Check, Eye, FileDown, FilePenLine, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { exportJournalData, type JournalExportFormat } from "@/lib/journalExport";

type JournalTemplate = { id: string; name: string; fields: string[] };
type JournalDraft = { templateName: string; experimentName: string; cellType: string; chemicalsUsed: string; cultureConditions: string; startTime: string; endTime: string; result: string; workDate: string; workDone: string; protocol: string; cellsSeeded: string; note: string; numericNote: string; issue: string };
const templateFieldOptions = [
  ["experimentName", "Tên thí nghiệm"], ["cellType", "Loại tế bào"], ["chemicalsUsed", "Hoá chất sử dụng"],
  ["cultureConditions", "Điều kiện nuôi/xử lý"], ["startTime", "Thời gian bắt đầu"], ["endTime", "Thời gian kết thúc"], ["result", "Kết quả"],
] as const;
const defaultTemplate: JournalTemplate = { id: "standard", name: "Nhật ký thí nghiệm chuẩn", fields: templateFieldOptions.map(([key]) => key) };
const emptyDraft = (): JournalDraft => ({ templateName: "", experimentName: "", cellType: "", chemicalsUsed: "", cultureConditions: "", startTime: "", endTime: "", result: "", workDate: new Date().toISOString().slice(0, 10), workDone: "", protocol: "", cellsSeeded: "", note: "", numericNote: "", issue: "" });

export function ExperimentJournal({ userId, userName }: { userId?: number; userName?: string | null }) {
  const logsQuery = trpc.experimentLogs.list.useQuery(undefined, { enabled: Boolean(userId), retry: 3, retryDelay: attempt => Math.min(1000 * 2 ** attempt, 5000), refetchOnWindowFocus: false, staleTime: 15000 });
  const [draft, setDraft] = useState<JournalDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState<JournalExportFormat | null>(null);
  const [templates, setTemplates] = useState<JournalTemplate[]>(() => { try { const saved = window.localStorage.getItem("rebiomed-journal-templates"); return saved ? [defaultTemplate, ...(JSON.parse(saved) as JournalTemplate[])] : [defaultTemplate]; } catch { return [defaultTemplate]; } });
  const [selectedTemplateId, setSelectedTemplateId] = useState("standard");
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateFields, setTemplateFields] = useState<string[]>(defaultTemplate.fields);
  const createMutation = trpc.experimentLogs.create.useMutation({ onSuccess: async () => { await logsQuery.refetch(); setDraft(emptyDraft()); toast.success("Đã lưu nhật ký thí nghiệm vào lịch sử."); }, onError: error => toast.error(`Không thể lưu nhật ký: ${error.message}`) });
  const updateMutation = trpc.experimentLogs.update.useMutation({ onSuccess: async () => { await logsQuery.refetch(); setEditingId(null); setDraft(emptyDraft()); toast.success("Đã cập nhật nhật ký."); }, onError: error => toast.error(error.message) });
  const deleteMutation = trpc.experimentLogs.delete.useMutation({ onSuccess: async () => { await logsQuery.refetch(); toast.success("Đã xoá nhật ký."); }, onError: error => toast.error(error.message) });
  const deleteManyMutation = trpc.experimentLogs.deleteMany.useMutation({ onSuccess: async () => { await logsQuery.refetch(); setSelectedIds(new Set()); toast.success("Đã xoá các nhật ký đã chọn."); }, onError: error => toast.error(`Không thể xoá nhật ký: ${error.message}`) });
  const logs = logsQuery.data ?? [];
  const activeTemplate = templates.find(template => template.id === selectedTemplateId) ?? defaultTemplate;
  const hasTemplateField = (key: string) => activeTemplate.fields.includes(key);
  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name) return toast.error("Vui lòng nhập tên template.");
    const template = { id: `template-${Date.now()}`, name, fields: templateFields };
    const next = [...templates.filter(item => item.id !== "standard"), template];
    setTemplates([defaultTemplate, ...next.filter(item => item.id !== "standard")]);
    window.localStorage.setItem("rebiomed-journal-templates", JSON.stringify(next.filter(item => item.id !== "standard")));
    setSelectedTemplateId(template.id); setDraft(current => ({ ...current, templateName: template.name })); setTemplateName(""); setTemplateEditorOpen(false); toast.success("Đã tạo template nhật ký.");
  };
  const allSelected = logs.length > 0 && selectedIds.size === logs.length;
  const setField = (key: keyof JournalDraft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const toggleSelected = (id: number) => setSelectedIds(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(logs.map(log => log.id)));
  const confirmDelete = (message: string) => window.confirm(message) && window.confirm("Xác nhận lần cuối: thao tác xoá nhật ký không thể hoàn tác.");
  const deleteSelected = () => { if (!selectedIds.size) return toast.info("Hãy chọn ít nhất một nhật ký để xoá."); if (confirmDelete(`Xoá ${selectedIds.size} nhật ký đã chọn?`)) deleteManyMutation.mutate({ ids: Array.from(selectedIds) }); };
  const deleteAll = () => { if (!logs.length) return; if (confirmDelete(`Xoá toàn bộ ${logs.length} nhật ký của bạn?`)) deleteManyMutation.mutate({}); };
  const exportData = async (format: JournalExportFormat) => {
    if (!logs.length) return toast.info("Chưa có nhật ký để xuất.");
    setExporting(format);
    try {
      await exportJournalData(logs, userName, format);
      toast.success(format === "preview" ? "Đã mở tab bản xem trước." : "Đã mở tab xem trước và tải file Excel về máy.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xuất dữ liệu nhật ký.");
    } finally {
      setExporting(null);
    }
  };
  const save = () => {
    if (editingId) updateMutation.mutate({ id: editingId, ...draft });
    else createMutation.mutate(draft);
  };
  const edit = (log: typeof logs[number]) => { setEditingId(log.id); setDraft({ templateName: log.templateName ?? "", experimentName: log.experimentName ?? "", cellType: log.cellType ?? "", chemicalsUsed: log.chemicalsUsed ?? "", cultureConditions: log.cultureConditions ?? "", startTime: log.startTime ?? "", endTime: log.endTime ?? "", result: log.result ?? "", workDate: log.workDate, workDone: log.workDone, protocol: log.protocol, cellsSeeded: log.cellsSeeded, note: log.note ?? "", numericNote: log.numericNote ?? "", issue: log.issue ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cancelEdit = () => { setEditingId(null); setDraft(emptyDraft()); };
  if (!userId) return <><PageIntro eyebrow="EXPERIMENT JOURNAL / PRIVATE WORKSPACE" title={<>Nhật ký <em>Thí nghiệm.</em></>} description="Đăng nhập User để lưu công việc và kết quả seed vào nhật ký riêng của bạn." /><section className="content-panel journal-login-note"><CalendarDays size={24} /><div><h2>Nhật ký riêng theo account</h2><p>Mỗi tài khoản có một bảng độc lập. Chỉ chủ tài khoản mới có thể xem, sửa hoặc xoá các dòng nhật ký.</p></div></section></>;
  return <>
    <PageIntro eyebrow="EXPERIMENT JOURNAL / PRIVATE WORKSPACE" title={<>Nhật ký <em>Thí nghiệm.</em></>} description={`Không gian ghi chép riêng của ${userName || "bạn"}. Dữ liệu chỉ thuộc về account đang đăng nhập.`} action={<span className="owner-chip"><CalendarDays size={14} /> ACCOUNT PRIVATE</span>} />
    <section className="journal-layout">
      <section className="content-panel journal-editor">
        <div className="panel-heading"><div><span className="panel-index">{editingId ? "EDIT ENTRY" : "NEW ENTRY"}</span><h2>{editingId ? "Chỉnh sửa nhật ký" : "Ghi lại một ngày làm việc"}</h2></div><FilePenLine size={20} /></div>
        <div className="journal-template-bar"><label className="field-label">Mẫu biểu<select value={selectedTemplateId} onChange={event => { const next = templates.find(template => template.id === event.target.value) ?? defaultTemplate; setSelectedTemplateId(next.id); setDraft(current => ({ ...current, templateName: next.name })); }}>{templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><Button variant="outline" onClick={() => setTemplateEditorOpen(current => !current)}>{templateEditorOpen ? "Đóng tạo template" : "Tạo template"}</Button></div>{templateEditorOpen && <div className="journal-template-editor"><label className="field-label">Tên template<Input value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="Ví dụ: Nuôi cấy Hypoxia" /></label><div className="template-field-checks">{templateFieldOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={templateFields.includes(key)} onChange={() => setTemplateFields(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])} /> {label}</label>)}</div><Button className="primary-cta" onClick={saveTemplate}>Lưu template</Button></div>}<div className="journal-fields"><label className="field-label">Ngày làm<Input type="date" value={draft.workDate} onChange={event => setField("workDate", event.target.value)} /></label><label className="field-label">Số lượng tế bào đã seed<Input value={draft.cellsSeeded} onChange={event => setField("cellsSeeded", event.target.value)} placeholder="Ví dụ: 2 × 10⁵ cell/giếng" /></label></div>
        {hasTemplateField("experimentName") && <label className="field-label">Tên thí nghiệm<Input value={draft.experimentName} onChange={event => setField("experimentName", event.target.value)} placeholder="Tên thí nghiệm" /></label>}
        {hasTemplateField("cellType") && <label className="field-label">Loại tế bào<Input value={draft.cellType} onChange={event => setField("cellType", event.target.value)} placeholder="Ví dụ: HSC primary" /></label>}
        {hasTemplateField("chemicalsUsed") && <label className="field-label">Hoá chất sử dụng<Textarea value={draft.chemicalsUsed} onChange={event => setField("chemicalsUsed", event.target.value)} placeholder="Tên hoá chất, nồng độ hoặc lot…" /></label>}
        {hasTemplateField("cultureConditions") && <label className="field-label">Điều kiện nuôi/xử lý<Textarea value={draft.cultureConditions} onChange={event => setField("cultureConditions", event.target.value)} placeholder="Nhiệt độ, thời gian, O₂, áp suất…" /></label>}
        {hasTemplateField("startTime") && <label className="field-label">Thời gian bắt đầu<Input type="datetime-local" value={draft.startTime} onChange={event => setField("startTime", event.target.value)} /></label>}
        {hasTemplateField("endTime") && <label className="field-label">Thời gian kết thúc<Input type="datetime-local" value={draft.endTime} onChange={event => setField("endTime", event.target.value)} /></label>}
        <label className="field-label">Công việc đã làm<Textarea value={draft.workDone} onChange={event => setField("workDone", event.target.value)} placeholder="Ghi các việc đã thực hiện, quan sát hoặc kết quả chính…" /></label>
        <label className="field-label">Quy trình đã làm<Textarea value={draft.protocol} onChange={event => setField("protocol", event.target.value)} placeholder="Tên quy trình, phiên bản hoặc các bước đã dùng…" /></label>
        {hasTemplateField("result") && <label className="field-label">Kết quả<Textarea value={draft.result} onChange={event => setField("result", event.target.value)} placeholder="Kết quả cuối cùng hoặc kết luận…" /></label>}<label className="field-label">Ghi chú<Textarea value={draft.note} onChange={event => setField("note", event.target.value)} placeholder="Ghi chú chung cho ngày làm việc…" /></label>
        <label className="field-label">Ghi chú số liệu<Textarea value={draft.numericNote} onChange={event => setField("numericNote", event.target.value)} placeholder="Ghi số liệu, kết quả đo hoặc thông số quan trọng…" /></label>
        <label className="field-label">Vấn đề bất cập<Textarea value={draft.issue} onChange={event => setField("issue", event.target.value)} placeholder="Ghi các vấn đề, sai lệch hoặc điều cần cải thiện…" /></label>
        <div className="journal-actions"><span>Chỉ account chủ mới được điều chỉnh hoặc xoá.</span><div>{editingId && <Button variant="outline" onClick={cancelEdit}>Huỷ</Button>}<Button className="primary-cta" onClick={save} disabled={createMutation.isPending || updateMutation.isPending}><Save size={15} /> {editingId ? "Lưu thay đổi" : "Lưu nhật ký"}</Button></div></div>
      </section>
      <section className="content-panel journal-list">
        <div className="panel-heading"><div><span className="panel-index">MY EXPERIMENT LOG / {logs.length} ENTRIES</span><h2>Lịch sử thí nghiệm</h2></div><div className="journal-heading-actions"><button className="icon-button journal-add-button" type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft()); document.querySelector(".journal-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} aria-label="Tạo mục nhật ký mới" title="Tạo mục nhật ký mới"><Plus size={20} /></button><Button variant="outline" disabled={!logs.length || exporting !== null} onClick={() => exportData("preview")} title="Xem trước dữ liệu"><Eye size={14} /> {exporting === "preview" ? "Đang mở…" : "Xem trước"}</Button><Button variant="outline" disabled={!logs.length || exporting !== null} onClick={() => exportData("xlsx")} title="Xuất Excel"><FileDown size={14} /> {exporting === "xlsx" ? "Đang tạo Excel…" : "Excel"}</Button></div></div>
        {logsQuery.error && <div className="journal-error" role="alert"><strong>Không thể tải lịch sử thí nghiệm.</strong><span>{logsQuery.error.message}</span><Button variant="outline" onClick={() => logsQuery.refetch()}>Thử lại</Button></div>}
        {logsQuery.isLoading ? <div className="empty-state"><CalendarDays size={25} /><h3>Đang tải lịch sử</h3><p>Đang kiểm tra kết nối và dữ liệu nhật ký…</p></div> : logsQuery.error ? null : logs.length === 0 ? <div className="empty-state"><CalendarDays size={25} /><h3>Chưa có nhật ký</h3><p>Bắt đầu bằng cách lưu công việc hôm nay.</p></div> : <>
          <div className="journal-bulk-actions"><label><input type="checkbox" checked={allSelected} onChange={toggleAll} /> <span>{allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}</span></label><span>{selectedIds.size} đã chọn</span><Button variant="outline" disabled={!selectedIds.size || deleteManyMutation.isPending} onClick={deleteSelected}><Trash2 size={14} /> Xoá lựa chọn</Button><Button variant="outline" disabled={deleteManyMutation.isPending} onClick={deleteAll}><Trash2 size={14} /> Xoá toàn bộ</Button></div>
          <div className="journal-entries">{logs.map(log => <article className={`journal-entry ${selectedIds.has(log.id) ? "selected" : ""}`} key={log.id}><label className="journal-select"><input type="checkbox" checked={selectedIds.has(log.id)} onChange={() => toggleSelected(log.id)} aria-label={`Chọn nhật ký ${log.id}`} />{selectedIds.has(log.id) && <Check size={12} />}</label><div className="journal-entry-date"><strong>{new Date(`${log.workDate}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</strong><small>{new Date(`${log.workDate}T00:00:00`).toLocaleDateString("vi-VN", { year: "numeric" })}</small></div><div className="journal-entry-body"><h3>{log.protocol}</h3><p>{log.workDone}</p><span><strong>Seed:</strong> {log.cellsSeeded}</span>{log.note && <small className="journal-extra-note"><strong>Ghi chú:</strong> {log.note}</small>}{log.numericNote && <small className="journal-extra-note"><strong>Số liệu:</strong> {log.numericNote}</small>}{log.issue && <small className="journal-extra-note issue"><strong>Bất cập:</strong> {log.issue}</small>}</div><div className="journal-entry-actions"><button className="icon-button" onClick={() => edit(log)} aria-label="Chỉnh sửa nhật ký"><FilePenLine size={15} /></button><button className="icon-button danger" onClick={() => { if (confirmDelete("Xoá nhật ký này?")) deleteMutation.mutate({ id: log.id }); }} aria-label="Xoá nhật ký"><Trash2 size={15} /></button></div></article>)}</div>
        </>}
      </section>
    </section>
  </>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: React.ReactNode; description: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
