import { useState } from "react";
import { CalendarDays, Check, FilePenLine, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type JournalDraft = { workDate: string; workDone: string; protocol: string; cellsSeeded: string };
const emptyDraft = (): JournalDraft => ({ workDate: new Date().toISOString().slice(0, 10), workDone: "", protocol: "", cellsSeeded: "" });

export function ExperimentJournal({ userId, userName }: { userId?: number; userName?: string | null }) {
  const logsQuery = trpc.experimentLogs.list.useQuery(undefined, { enabled: Boolean(userId), retry: false });
  const [draft, setDraft] = useState<JournalDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const createMutation = trpc.experimentLogs.create.useMutation({ onSuccess: async () => { await logsQuery.refetch(); setDraft(emptyDraft()); toast.success("Đã lưu nhật ký thí nghiệm vào lịch sử."); }, onError: error => toast.error(`Không thể lưu nhật ký: ${error.message}`) });
  const updateMutation = trpc.experimentLogs.update.useMutation({ onSuccess: async () => { await logsQuery.refetch(); setEditingId(null); setDraft(emptyDraft()); toast.success("Đã cập nhật nhật ký."); }, onError: error => toast.error(error.message) });
  const deleteMutation = trpc.experimentLogs.delete.useMutation({ onSuccess: async () => { await logsQuery.refetch(); toast.success("Đã xoá nhật ký."); }, onError: error => toast.error(error.message) });
  const deleteManyMutation = trpc.experimentLogs.deleteMany.useMutation({ onSuccess: async () => { await logsQuery.refetch(); setSelectedIds(new Set()); toast.success("Đã xoá các nhật ký đã chọn."); }, onError: error => toast.error(`Không thể xoá nhật ký: ${error.message}`) });
  const logs = logsQuery.data ?? [];
  const allSelected = logs.length > 0 && selectedIds.size === logs.length;
  const setField = (key: keyof JournalDraft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const toggleSelected = (id: number) => setSelectedIds(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(logs.map(log => log.id)));
  const confirmDelete = (message: string) => window.confirm(message) && window.confirm("Xác nhận lần cuối: thao tác xoá nhật ký không thể hoàn tác.");
  const deleteSelected = () => { if (!selectedIds.size) return toast.info("Hãy chọn ít nhất một nhật ký để xoá."); if (confirmDelete(`Xoá ${selectedIds.size} nhật ký đã chọn?`)) deleteManyMutation.mutate({ ids: Array.from(selectedIds) }); };
  const deleteAll = () => { if (!logs.length) return; if (confirmDelete(`Xoá toàn bộ ${logs.length} nhật ký của bạn?`)) deleteManyMutation.mutate({}); };
  const save = () => {
    if (!draft.workDate || !draft.workDone.trim() || !draft.protocol.trim() || !draft.cellsSeeded.trim()) {
      toast.error("Vui lòng điền đủ ngày làm, công việc, quy trình và số lượng tế bào đã seed.");
      return;
    }
    if (editingId) updateMutation.mutate({ id: editingId, ...draft });
    else createMutation.mutate(draft);
  };
  const edit = (log: typeof logs[number]) => { setEditingId(log.id); setDraft({ workDate: log.workDate, workDone: log.workDone, protocol: log.protocol, cellsSeeded: log.cellsSeeded }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const cancelEdit = () => { setEditingId(null); setDraft(emptyDraft()); };
  if (!userId) return <><PageIntro eyebrow="EXPERIMENT JOURNAL / PRIVATE WORKSPACE" title={<>Nhật ký <em>Thí nghiệm.</em></>} description="Đăng nhập User để lưu công việc và kết quả seed vào nhật ký riêng của bạn." /><section className="content-panel journal-login-note"><CalendarDays size={24} /><div><h2>Nhật ký riêng theo account</h2><p>Mỗi tài khoản có một bảng độc lập. Chỉ chủ tài khoản mới có thể xem, sửa hoặc xoá các dòng nhật ký.</p></div></section></>;
  return <>
    <PageIntro eyebrow="EXPERIMENT JOURNAL / PRIVATE WORKSPACE" title={<>Nhật ký <em>Thí nghiệm.</em></>} description={`Không gian ghi chép riêng của ${userName || "bạn"}. Dữ liệu chỉ thuộc về account đang đăng nhập.`} action={<span className="owner-chip"><CalendarDays size={14} /> ACCOUNT PRIVATE</span>} />
    <section className="journal-layout">
      <section className="content-panel journal-editor">
        <div className="panel-heading"><div><span className="panel-index">{editingId ? "EDIT ENTRY" : "NEW ENTRY"}</span><h2>{editingId ? "Chỉnh sửa nhật ký" : "Ghi lại một ngày làm việc"}</h2></div><FilePenLine size={20} /></div>
        <div className="journal-fields"><label className="field-label">Ngày làm<Input type="date" value={draft.workDate} onChange={event => setField("workDate", event.target.value)} /></label><label className="field-label">Số lượng tế bào đã seed<Input value={draft.cellsSeeded} onChange={event => setField("cellsSeeded", event.target.value)} placeholder="Ví dụ: 2 × 10⁵ cell/giếng" /></label></div>
        <label className="field-label">Công việc đã làm<Textarea value={draft.workDone} onChange={event => setField("workDone", event.target.value)} placeholder="Ghi các việc đã thực hiện, quan sát hoặc kết quả chính…" /></label>
        <label className="field-label">Quy trình đã làm<Textarea value={draft.protocol} onChange={event => setField("protocol", event.target.value)} placeholder="Tên quy trình, phiên bản hoặc các bước đã dùng…" /></label>
        <div className="journal-actions"><span>Chỉ account chủ mới được điều chỉnh hoặc xoá.</span><div>{editingId && <Button variant="outline" onClick={cancelEdit}>Huỷ</Button>}<Button className="primary-cta" onClick={save} disabled={createMutation.isPending || updateMutation.isPending}><Save size={15} /> {editingId ? "Lưu thay đổi" : "Lưu nhật ký"}</Button></div></div>
      </section>
      <section className="content-panel journal-list">
        <div className="panel-heading"><div><span className="panel-index">MY EXPERIMENT LOG / {logs.length} ENTRIES</span><h2>Lịch sử thí nghiệm</h2></div><Plus size={20} /></div>
        {logs.length === 0 ? <div className="empty-state"><CalendarDays size={25} /><h3>Chưa có nhật ký</h3><p>Bắt đầu bằng cách lưu công việc hôm nay.</p></div> : <>
          <div className="journal-bulk-actions"><label><input type="checkbox" checked={allSelected} onChange={toggleAll} /> <span>{allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}</span></label><span>{selectedIds.size} đã chọn</span><Button variant="outline" disabled={!selectedIds.size || deleteManyMutation.isPending} onClick={deleteSelected}><Trash2 size={14} /> Xoá lựa chọn</Button><Button variant="outline" disabled={deleteManyMutation.isPending} onClick={deleteAll}><Trash2 size={14} /> Xoá toàn bộ</Button></div>
          <div className="journal-entries">{logs.map(log => <article className={`journal-entry ${selectedIds.has(log.id) ? "selected" : ""}`} key={log.id}><label className="journal-select"><input type="checkbox" checked={selectedIds.has(log.id)} onChange={() => toggleSelected(log.id)} aria-label={`Chọn nhật ký ${log.id}`} />{selectedIds.has(log.id) && <Check size={12} />}</label><div className="journal-entry-date"><strong>{new Date(`${log.workDate}T00:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}</strong><small>{new Date(`${log.workDate}T00:00:00`).toLocaleDateString("vi-VN", { year: "numeric" })}</small></div><div className="journal-entry-body"><h3>{log.protocol}</h3><p>{log.workDone}</p><span><strong>Seed:</strong> {log.cellsSeeded}</span></div><div className="journal-entry-actions"><button className="icon-button" onClick={() => edit(log)} aria-label="Chỉnh sửa nhật ký"><FilePenLine size={15} /></button><button className="icon-button danger" onClick={() => { if (confirmDelete("Xoá nhật ký này?")) deleteMutation.mutate({ id: log.id }); }} aria-label="Xoá nhật ký"><Trash2 size={15} /></button></div></article>)}</div>
        </>}
      </section>
    </section>
  </>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: React.ReactNode; description: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
