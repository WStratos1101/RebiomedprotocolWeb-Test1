import { useMemo, useState } from "react";
import { AlertTriangle, Check, ClipboardCheck, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type FeedbackCategory = "chemical" | "equipment" | "supplies";
type AdminOption = { id: number; name: string; username?: string | null };
type FeedbackRecord = { id: number; reporterId: number; category: string; itemName: string; condition: string; remainingAmount?: string | null; remainingUnit?: string | null; usageCategory?: string | null; description?: string | null; resolvedById?: number | null; resolvedAt?: Date | string | null; createdAt: Date | string };

const categoryLabels: Record<FeedbackCategory, string> = { chemical: "Hoá chất", equipment: "Thiết bị", supplies: "Vật tư" };
const categoryItems: FeedbackCategory[] = ["chemical", "equipment", "supplies"];

export function FeedbackView({ userId, userName }: { userId?: number; userName?: string | null }) {
  const mineQuery = trpc.feedbacks.mine.useQuery(undefined, { enabled: Boolean(userId), retry: false });
  const [category, setCategory] = useState<FeedbackCategory>("chemical");
  const [itemName, setItemName] = useState("");
  const [condition, setCondition] = useState("Hết hoàn toàn");
  const [remainingAmount, setRemainingAmount] = useState("");
  const [remainingUnit, setRemainingUnit] = useState("mL" as "µL" | "mL" | "L" | "mg" | "g");
  const [usageCategory, setUsageCategory] = useState("");
  const [description, setDescription] = useState("");
  const createMutation = trpc.feedbacks.create.useMutation({ onSuccess: async () => { await mineQuery.refetch(); setItemName(""); setRemainingAmount(""); setUsageCategory(""); setDescription(""); toast.success("Đã gửi phản ánh tới Admin."); }, onError: error => toast.error(error.message) });
  const submit = () => {
    if (!itemName.trim()) return toast.error(`Vui lòng nhập tên ${categoryLabels[category].toLowerCase()}.`);
    createMutation.mutate({ category, itemName, condition, remainingAmount: category === "chemical" && condition === "Sắp hết" ? remainingAmount : undefined, remainingUnit: category === "chemical" && condition === "Sắp hết" ? remainingUnit : undefined, usageCategory: category === "supplies" ? usageCategory : undefined, description: category === "equipment" ? description : undefined });
  };
  const changeCategory = (next: FeedbackCategory) => { setCategory(next); setCondition(next === "chemical" ? "Hết hoàn toàn" : next === "equipment" ? "Không hoạt động" : "Hết"); };
  const mine = (mineQuery.data ?? []) as FeedbackRecord[];
  if (!userId) return <><PageIntro eyebrow="WORKSPACE / FEEDBACK" title={<>Gửi <em>phản ánh.</em></>} description="Đăng nhập tài khoản User để gửi phản ánh tới Admin." /><section className="content-panel journal-login-note"><ShieldAlert size={24} /><div><h2>Cần đăng nhập để gửi phản ánh</h2><p>Phản ánh được gắn với account gửi và chỉ Admin mới xem được hàng đợi xử lý chung.</p></div></section></>;
  return <><PageIntro eyebrow="WORKSPACE / FEEDBACK" title={<>Gửi <em>phản ánh.</em></>} description={`Gửi thông tin thiếu hụt hoặc sự cố tới Admin. Phản ánh của ${userName || "account này"} sẽ được theo dõi tập trung.`} /><section className="content-panel feedback-panel"><div className="panel-heading"><div><span className="panel-index">NEW FEEDBACK</span><h2>Chọn loại phản ánh</h2></div><ShieldAlert size={20} /></div><div className="feedback-category-tabs">{categoryItems.map(item => <button key={item} type="button" className={category === item ? "active" : ""} onClick={() => changeCategory(item)}>{categoryLabels[item]}</button>)}</div><div className="feedback-form-grid"><label className="field-label">{category === "chemical" ? "Tên hoá chất" : category === "equipment" ? "Tên thiết bị" : "Tên vật tư"}<Input value={itemName} onChange={event => setItemName(event.target.value)} placeholder={`Nhập tên ${categoryLabels[category].toLowerCase()}`} /></label><label className="field-label">Tình trạng<select value={condition} onChange={event => setCondition(event.target.value)}>{category === "chemical" ? <><option>Hết hoàn toàn</option><option>Sắp hết</option></> : category === "equipment" ? <><option>Không hoạt động</option><option>Lỗi hoạt động</option></> : <option>Hết</option>}</select></label>{category === "chemical" && condition === "Sắp hết" && <div className="feedback-inline-fields"><label className="field-label">Ước lượng phần hoá chất còn lại<Input value={remainingAmount} onChange={event => setRemainingAmount(event.target.value)} placeholder="Ví dụ: 250" /></label><label className="field-label">Đơn vị<select value={remainingUnit} onChange={event => setRemainingUnit(event.target.value as typeof remainingUnit)}><option>µL</option><option>mL</option><option>L</option><option>mg</option><option>g</option></select></label></div>}{category === "supplies" && <label className="field-label">Phân loại sử dụng<Input value={usageCategory} onChange={event => setUsageCategory(event.target.value)} placeholder="Ví dụ: Nuôi cấy tế bào / PPE / lấy mẫu" /></label>}{category === "equipment" && <label className="field-label feedback-wide">Miêu tả nhanh<Textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Mô tả ngắn lỗi hoặc tình trạng thiết bị…" /></label>}</div><div className="editor-footer"><span><AlertTriangle size={14} /> Admin sẽ tiếp nhận và xác nhận xử lý.</span><Button className="primary-cta" onClick={submit} disabled={createMutation.isPending}><Send size={15} /> Gửi phản ánh</Button></div></section><section className="content-panel feedback-panel"><div className="panel-heading"><div><span className="panel-index">MY FEEDBACK / {mine.length}</span><h2>Phản ánh đã gửi</h2></div></div>{mine.length ? <div className="feedback-list">{mine.map(item => <FeedbackCard key={item.id} item={item} />)}</div> : <div className="empty-state"><p>Chưa có phản ánh nào.</p></div>}</section></>;
}

export function AdminFeedbackView({ admins, team }: { admins: AdminOption[]; team: AdminOption[] }) {
  const query = trpc.feedbacks.adminList.useQuery(undefined, { retry: false, refetchInterval: 15000 });
  const resolveMutation = trpc.feedbacks.resolve.useMutation({ onSuccess: async () => { await query.refetch(); toast.success("Đã xác nhận phản ánh. Thao tác này không thể hoàn tác."); }, onError: error => toast.error(error.message) });
  const [handlers, setHandlers] = useState<Record<number, number>>({});
  const records = (query.data ?? []) as FeedbackRecord[];
  const grouped = useMemo(() => Object.fromEntries(categoryItems.map(category => [category, records.filter(item => item.category === category)])) as Record<FeedbackCategory, FeedbackRecord[]>, [records]);
  const displayName = (id: number) => team.find(member => member.id === id)?.name || team.find(member => member.id === id)?.username || `Account #${id}`;
  const resolve = (item: FeedbackRecord) => { const handledById = handlers[item.id] ?? admins[0]?.id; if (!handledById) return toast.error("Chưa có Admin để chọn xử lý."); if (window.confirm("Xác nhận phản ánh này đã được xử lý? Sau khi xác nhận không thể hoàn tác.")) resolveMutation.mutate({ id: item.id, handledById }); };
  return <><PageIntro eyebrow="ADMIN / FEEDBACK CONTROL" title={<>Các <em>phản ánh.</em></>} description="Tất cả Admin theo dõi chung một danh sách. Phản ánh đã xác nhận được lưu trong 30 giờ rồi tự động xoá." /><section className="content-panel feedback-admin-panel"><div className="panel-heading"><div><span className="panel-index">SHARED ADMIN QUEUE / {records.length}</span><h2>Danh sách phản ánh</h2></div><ClipboardCheck size={20} /></div>{categoryItems.map(category => <section className="feedback-admin-group" key={category}><div className="feedback-group-heading"><h3>{categoryLabels[category]}</h3><span>{grouped[category].length} mục</span></div>{grouped[category].length ? grouped[category].map(item => <article className={`feedback-admin-card ${item.resolvedAt ? "resolved" : "pending"}`} key={item.id}><div className="feedback-card-main"><strong>{item.itemName}</strong><span>{item.condition}{item.remainingAmount ? ` · Còn ${item.remainingAmount} ${item.remainingUnit || ""}` : ""}{item.usageCategory ? ` · ${item.usageCategory}` : ""}</span>{item.description && <p>{item.description}</p>}<small>Người gửi: {displayName(item.reporterId)} · {new Date(item.createdAt).toLocaleString("vi-VN")}</small></div>{item.resolvedAt ? <div className="feedback-resolved"><Check size={14} /> Đã xử lý bởi {displayName(item.resolvedById || 0)}<small>{new Date(item.resolvedAt).toLocaleString("vi-VN")}</small></div> : <div className="feedback-resolve-actions"><select value={handlers[item.id] ?? admins[0]?.id ?? ""} onChange={event => setHandlers(current => ({ ...current, [item.id]: Number(event.target.value) }))} aria-label="Chọn Admin xử lý">{admins.map(admin => <option key={admin.id} value={admin.id}>{admin.name || admin.username}</option>)}</select><Button className="primary-cta" onClick={() => resolve(item)} disabled={resolveMutation.isPending}><Check size={14} /> Xác nhận</Button></div>}</article>) : <div className="feedback-empty">Không có phản ánh.</div>}</section>)}</section></>;
}

function FeedbackCard({ item }: { item: FeedbackRecord }) {
  return <article className={`feedback-card ${item.resolvedAt ? "resolved" : "pending"}`}><div><strong>{categoryLabels[item.category as FeedbackCategory]} · {item.itemName}</strong><span>{item.condition}{item.remainingAmount ? ` · Còn ${item.remainingAmount} ${item.remainingUnit || ""}` : ""}{item.usageCategory ? ` · ${item.usageCategory}` : ""}</span>{item.description && <p>{item.description}</p>}</div><small>{item.resolvedAt ? `Đã xử lý lúc ${new Date(item.resolvedAt).toLocaleString("vi-VN")}` : "Đang chờ Admin xử lý"}</small></article>;
}

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: React.ReactNode; description: string }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>;
}
