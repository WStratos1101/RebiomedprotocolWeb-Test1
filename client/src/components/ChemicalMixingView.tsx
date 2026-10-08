import { useEffect, useMemo, useState } from "react";
import { Beaker, Calculator, Check, FilePenLine, FlaskConical, Info, Plus, Save, Table2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { parseLocaleNumber } from "@/lib/numberInput";
import { toast } from "sonner";
import { seedChemicalRecipes, type ChemicalIngredient, type ChemicalRecipe, type ChemicalUnit } from "@shared/chemicalRecipes";
import { CdnaMasterMixCalculator } from "@/components/CdnaMasterMixCalculator";
import { QdnaMasterMixCalculator } from "@/components/QdnaMasterMixCalculator";
import { IccStainingCalculator } from "@/components/IccStainingCalculator";

type IngredientDraft = {
  name: string;
  quantity: string;
  unit: string;
  stockValue: string;
  stockUnit: string;
  form: string;
  note: string;
  finalTopUp: boolean;
};
type RecipeDraft = {
  name: string;
  group: string;
  baseVolume: string;
  baseUnit: ChemicalUnit;
  stock: string;
  note: string;
  ingredients: IngredientDraft[];
  method: string;
};

type StoredChemicalRecipe = ChemicalRecipe & { dbId?: number };

const format = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 6 }).format(value);
const toMl = (value: number, unit: ChemicalUnit) => unit === "L" ? value * 1000 : unit === "µL" ? value / 1000 : value;
const inputNumber = (value?: number) => value === undefined ? "" : String(value).replace(".", ",");
const emptyIngredient = (): IngredientDraft => ({ name: "", quantity: "", unit: "mL", stockValue: "", stockUnit: "", form: "Lỏng", note: "", finalTopUp: false });
const recipeToDraft = (recipe: StoredChemicalRecipe): RecipeDraft => ({
  name: recipe.name,
  group: recipe.group,
  baseVolume: inputNumber(recipe.baseVolume),
  baseUnit: recipe.baseUnit,
  stock: recipe.stock,
  note: recipe.note ?? "",
  ingredients: recipe.ingredients.map(item => ({ name: item.name, quantity: inputNumber(item.quantity), unit: item.unit ?? "", stockValue: inputNumber(item.stockValue), stockUnit: item.stockUnit ?? "", form: item.form, note: item.note ?? "", finalTopUp: item.finalTopUp ?? false })),
  method: recipe.steps.join("\n"),
});
const newRecipeDraft = (): RecipeDraft => ({ name: "", group: "Dung dịch mới", baseVolume: "100", baseUnit: "mL", stock: "", note: "", ingredients: [emptyIngredient()], method: "" });

type ChemicalTab = "chemicals" | "stock" | "master-cdna" | "master-qdna" | "icc" | "cdna" | "qdna";

export function ChemicalMixingView({ initialTab = "chemicals", isAdmin = false, userId }: { initialTab?: ChemicalTab; isAdmin?: boolean; userId?: number }) {
  const [tab, setTab] = useState<ChemicalTab>(initialTab);
  const [selectedId, setSelectedId] = useState(seedChemicalRecipes[0].id);
  const [totalVolume, setTotalVolume] = useState(String(seedChemicalRecipes[0].baseVolume));
  const [totalUnit, setTotalUnit] = useState<ChemicalUnit>(seedChemicalRecipes[0].baseUnit);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<RecipeDraft>(newRecipeDraft());
  const utils = trpc.useUtils();
  const recipesQuery = trpc.chemicals.list.useQuery(undefined, { retry: false });
  const createMutation = trpc.chemicals.create.useMutation({ onSuccess: async () => { await utils.chemicals.list.invalidate(); setEditorOpen(false); toast.success("Đã thêm cách pha mới."); }, onError: error => toast.error(error.message) });
  const updateMutation = trpc.chemicals.update.useMutation({ onSuccess: async () => { await utils.chemicals.list.invalidate(); setEditorOpen(false); toast.success("Đã cập nhật cách pha."); }, onError: error => toast.error(error.message) });
  const deleteMutation = trpc.chemicals.delete.useMutation({ onSuccess: async () => { await utils.chemicals.list.invalidate(); setEditorOpen(false); toast.success("Đã xoá bản nháp/cách pha."); }, onError: error => toast.error(error.message) });
  const approveMutation = trpc.chemicals.approve.useMutation({ onSuccess: async () => { await utils.chemicals.list.invalidate(); toast.success("Đã duyệt cách pha hoá chất."); }, onError: error => toast.error(error.message) });
  const recipes = (recipesQuery.data?.length ? recipesQuery.data : seedChemicalRecipes) as StoredChemicalRecipe[];
  const selected = recipes.find(recipe => recipe.id === selectedId) ?? recipes[0];

  useEffect(() => setTab(initialTab), [initialTab]);

  useEffect(() => {
    if (!selected) return;
    if (!recipes.some(recipe => recipe.id === selectedId)) setSelectedId(selected.id);
  }, [recipes, selected, selectedId]);

  const scale = useMemo(() => {
    if (!selected) return null;
    const desiredMl = toMl(parseLocaleNumber(totalVolume), totalUnit);
    const baseMl = toMl(selected.baseVolume, selected.baseUnit);
    return Number.isFinite(desiredMl) && desiredMl > 0 && baseMl > 0 ? desiredMl / baseMl : null;
  }, [selected, totalUnit, totalVolume]);

  const chooseRecipe = (id: string) => {
    const recipe = recipes.find(item => item.id === id) ?? recipes[0];
    if (!recipe) return;
    setSelectedId(recipe.id);
    setTotalVolume(inputNumber(recipe.baseVolume));
    setTotalUnit(recipe.baseUnit);
    setEditorOpen(false);
  };
  const openCreate = () => { setEditingId(null); setDraft(newRecipeDraft()); setEditorOpen(true); setTab("chemicals"); };
  const canManage = (recipe: StoredChemicalRecipe) => isAdmin || recipe.status === "Bản nháp";
  const openEdit = (recipe: StoredChemicalRecipe) => { if (!canManage(recipe)) return toast.error("Chỉ Admin được chỉnh sửa cách pha đã duyệt."); setEditingId(recipe.dbId ?? null); setDraft(recipeToDraft(recipe)); setEditorOpen(true); setTab("chemicals"); };
  const deleteRecipe = (recipe: StoredChemicalRecipe) => { if (!recipe.dbId) return toast.error("Bản mẫu không thể xoá."); if (!canManage(recipe)) return toast.error("Chỉ Admin được xoá cách pha đã duyệt."); if (window.confirm(`Xoá cách pha ${recipe.name}?`) && window.confirm("Xác nhận lần cuối: thao tác này không thể hoàn tác.")) deleteMutation.mutate({ id: recipe.dbId }); };
  const approveRecipe = (recipe: StoredChemicalRecipe) => { if (!isAdmin || !recipe.dbId) return; if (window.confirm(`Duyệt cách pha ${recipe.name}?`)) approveMutation.mutate({ id: recipe.dbId }); };
  const updateIngredient = (index: number, patch: Partial<IngredientDraft>) => setDraft(current => ({ ...current, ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  const saveDraft = () => {
    const baseVolume = parseLocaleNumber(draft.baseVolume);
    if (!draft.name.trim() || !draft.group.trim() || !Number.isFinite(baseVolume) || baseVolume <= 0 || !draft.method.trim()) {
      toast.error("Vui lòng nhập tên, nhóm, thể tích gốc hợp lệ và method hướng dẫn pha.");
      return;
    }
    const ingredients: ChemicalIngredient[] = [];
    for (const item of draft.ingredients) {
      const quantity = item.quantity.trim() ? parseLocaleNumber(item.quantity) : undefined;
      const stockValue = item.stockValue.trim() ? parseLocaleNumber(item.stockValue) : undefined;
      if (!item.name.trim() || (quantity !== undefined && !Number.isFinite(quantity)) || (stockValue !== undefined && !Number.isFinite(stockValue))) {
        toast.error("Mỗi chất cần có tên; số liệu nếu nhập phải là số hợp lệ.");
        return;
      }
      ingredients.push({ name: item.name.trim(), quantity, unit: item.unit.trim() || undefined, stockValue, stockUnit: item.stockUnit.trim() || undefined, form: item.form.trim() || "Khác", note: item.note.trim() || undefined, finalTopUp: item.finalTopUp });
    }
    const payload = { name: draft.name.trim(), group: draft.group.trim(), baseVolume, baseUnit: draft.baseUnit, stock: draft.stock.trim(), note: draft.note.trim(), ingredients, method: draft.method.trim() };
    if (editingId) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  };
  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || approveMutation.isPending;

  const isMasterMix = tab === "master-cdna" || tab === "master-qdna" || tab === "cdna" || tab === "qdna";
  if (!selected && !isMasterMix && tab !== "icc") return <div className="empty-state"><Beaker size={24} /><h3>Chưa có công thức pha</h3><p>Hãy tạo cách pha đầu tiên.</p><Button className="primary-cta" onClick={openCreate}><Plus size={15} /> Thêm cách pha</Button></div>;

  return <div className="chemical-page">
    <PageIntro eyebrow="CHEMISTRY WORKBENCH" title={<>Pha <em>hoá chất.</em></>} description="Tính nhanh lượng cần cân/đong theo tổng thể tích và tự biên soạn các cách pha theo từng chất." action={<Button className="primary-cta" onClick={openCreate}><Plus size={15} /> Thêm cách pha</Button>} />
    <div className="chemical-tabs" role="tablist" aria-label="Pha hoá chất">
      <button className={tab === "chemicals" ? "active" : ""} onClick={() => setTab("chemicals")}><Calculator size={16} /> Hoá chất</button>
      <button className={tab === "stock" ? "active" : ""} onClick={() => setTab("stock")}><Table2 size={16} /> Hoá chất stock <span>{recipes.length}</span></button>
      <button className={isMasterMix ? "active" : ""} onClick={() => setTab("master-cdna")}><FlaskConical size={16} /> Master Mix <span>2</span></button>
      <button className={tab === "icc" ? "active" : ""} onClick={() => setTab("icc")}><FlaskConical size={16} /> Nhuộm ICC</button>
    </div>
    {isMasterMix && <div className="master-mix-subtabs" role="tablist" aria-label="Các bảng Master Mix"><button className={tab === "master-cdna" || tab === "cdna" ? "active" : ""} onClick={() => setTab("master-cdna")}>Master Mix cDNA</button><button className={tab === "master-qdna" || tab === "qdna" ? "active" : ""} onClick={() => setTab("master-qdna")}>Master Mix qDNA</button></div>}
    {recipesQuery.isError && <div className="chemical-warning"><Info size={15} /> Không tải được thư viện đã lưu; đang hiển thị dữ liệu mẫu. Các thay đổi mới sẽ được lưu khi database hoạt động trở lại.</div>}
    {editorOpen && <RecipeEditor draft={draft} setDraft={setDraft} updateIngredient={updateIngredient} onAddIngredient={() => setDraft(current => ({ ...current, ingredients: [...current.ingredients, emptyIngredient()] }))} onRemoveIngredient={index => setDraft(current => ({ ...current, ingredients: current.ingredients.filter((_, itemIndex) => itemIndex !== index) }))} onSave={saveDraft} onCancel={() => setEditorOpen(false)} busy={busy} editing={Boolean(editingId)} />}
    {tab === "icc" ? <IccStainingCalculator /> : tab === "master-qdna" || tab === "qdna" ? <QdnaMasterMixCalculator userId={userId} /> : tab === "master-cdna" || tab === "cdna" ? <CdnaMasterMixCalculator userId={userId} /> : tab === "chemicals" ? <div className="chemical-workspace">
      <aside className="chemical-recipe-list content-panel"><div className="panel-index">RECIPES / {recipes.length}</div>{recipes.map(recipe => <button key={recipe.id} className={recipe.id === selected.id ? "active" : ""} onClick={() => chooseRecipe(recipe.id)}><span className="chemical-dot" /><span><strong>{recipe.name}</strong><small>{recipe.group} · {recipe.baseVolume} {recipe.baseUnit}</small></span>{canManage(recipe) && <FilePenLine size={14} className="chemical-list-edit" onClick={event => { event.stopPropagation(); openEdit(recipe); }} />}</button>)}</aside>
      <section className="chemical-calculator"><div className="content-panel chemical-input-panel"><div className="panel-index">TARGET VOLUME</div><div className="chemical-heading"><div><h2>{selected.name}</h2><p>{selected.stock || "Chưa có thông tin stock"}{selected.note ? ` · ${selected.note}` : ""} <span className={`status-pill ${selected.status === "Đã duyệt" ? "approved" : "draft"}`}>{selected.status ?? "Đã duyệt"}</span></p></div><FlaskConical size={28} /></div><div className="chemical-input-row"><label className="field-label">Tổng thể tích cần<Input value={totalVolume} onChange={event => setTotalVolume(event.target.value)} inputMode="decimal" /><small>Công thức gốc: {selected.baseVolume} {selected.baseUnit}</small></label><label className="field-label">Đơn vị<select value={totalUnit} onChange={event => setTotalUnit(event.target.value as ChemicalUnit)}><option value="L">L</option><option value="mL">mL</option><option value="µL">µL</option></select></label></div>{scale === null && <div className="chemical-warning"><Info size={15} /> Nhập tổng thể tích dương để tính.</div>}</div><div className="content-panel chemical-result-panel"><div className="panel-heading"><div><span className="panel-index">RESULT / SCALED AMOUNTS</span><h2>Lượng cần cân / đong</h2></div>{scale !== null && <span className="chemical-scale">× {format(scale)}</span>}</div><div className="chemical-table-wrap"><table className="chemical-table"><thead><tr><th>Hoá chất</th><th>Loại</th><th>Lượng cần</th><th>Stock gốc</th><th>Ghi chú</th></tr></thead><tbody>{selected.ingredients.map((ingredient, index) => { const quantity = scale !== null && ingredient.quantity !== undefined ? ingredient.quantity * scale : null; const displayed = quantity === null ? "Theo method" : `${format(quantity)} ${ingredient.unit ?? ""}`; const stock = ingredient.stockValue !== undefined ? `${format(ingredient.stockValue)} ${ingredient.stockUnit ?? ""}` : "—"; return <tr key={`${ingredient.name}-${index}`}><td><strong>{ingredient.name}</strong></td><td>{ingredient.form}</td><td className="chemical-amount">{displayed}</td><td>{stock}</td><td>{ingredient.note ?? (ingredient.finalTopUp ? "Bổ sung đến đủ thể tích" : "")}</td></tr>; })}</tbody></table></div><div className="chemical-method"><div className="panel-index">METHOD / NOTES</div><ol>{selected.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol></div></div></section>
    </div> : <section className="content-panel stock-panel"><div className="panel-heading"><div><span className="panel-index">STOCK LIBRARY / {recipes.length} RECIPES</span><h2>Bảng pha hoá chất stock</h2><p className="stock-intro">Chọn một công thức để chuyển sang tab Hoá chất, scale theo tổng thể tích hoặc chỉnh sửa method.</p></div><span className="stock-summary"><Check size={14} /> {checked.size}/{recipes.length} đã rà</span></div><div className="chemical-table-wrap"><table className="chemical-table stock-table"><thead><tr><th>Rà</th><th>Công thức</th><th>Nhóm</th><th>Thể tích gốc</th><th>Trạng thái</th><th>Stock / ghi chú</th><th>Chi tiết từng chất</th><th></th></tr></thead><tbody>{recipes.map(recipe => <tr key={recipe.id}><td><input type="checkbox" checked={checked.has(recipe.id)} onChange={() => setChecked(current => { const next = new Set(current); next.has(recipe.id) ? next.delete(recipe.id) : next.add(recipe.id); return next; })} aria-label={`Đánh dấu ${recipe.name}`} /></td><td><strong>{recipe.name}</strong></td><td>{recipe.group}</td><td>{recipe.baseVolume} {recipe.baseUnit}</td><td><span className={`status-pill ${recipe.status === "Đã duyệt" ? "approved" : "draft"}`}>{recipe.status ?? "Đã duyệt"}</span></td><td>{recipe.stock}{recipe.note ? <small>{recipe.note}</small> : null}</td><td><div className="stock-ingredients">{recipe.ingredients.map((item, index) => <span key={`${item.name}-${index}`}><strong>{item.name}</strong><small>{item.quantity !== undefined ? `${item.quantity} ${item.unit ?? ""}` : "Theo method"}{item.stockValue !== undefined ? ` · stock ${item.stockValue} ${item.stockUnit ?? ""}` : ""} · {item.form}{item.note ? ` · ${item.note}` : ""}</small></span>)}</div></td><td><div className="stock-actions"><Button variant="outline" onClick={() => { chooseRecipe(recipe.id); setTab("chemicals"); }}>Pha</Button>{recipe.status === "Bản nháp" && isAdmin && <Button variant="outline" onClick={() => approveRecipe(recipe)}>Duyệt</Button>}{canManage(recipe) && <button className="icon-button" onClick={() => openEdit(recipe)} aria-label={`Chỉnh sửa ${recipe.name}`}><FilePenLine size={15} /></button>}{canManage(recipe) && <button className="icon-button danger" onClick={() => deleteRecipe(recipe)} aria-label={`Xoá ${recipe.name}`}><Trash2 size={15} /></button>}</div></td></tr>)}</tbody></table></div></section>}
  </div>;
}

function RecipeEditor({ draft, setDraft, updateIngredient, onAddIngredient, onRemoveIngredient, onSave, onCancel, busy, editing }: { draft: RecipeDraft; setDraft: React.Dispatch<React.SetStateAction<RecipeDraft>>; updateIngredient: (index: number, patch: Partial<IngredientDraft>) => void; onAddIngredient: () => void; onRemoveIngredient: (index: number) => void; onSave: () => void; onCancel: () => void; busy: boolean; editing: boolean }) {
  return <section className="content-panel chemical-editor"><div className="panel-heading"><div><span className="panel-index">RECIPE EDITOR / {editing ? "EDIT" : "NEW"}</span><h2>{editing ? "Điều chỉnh cách pha" : "Thêm cách pha mới"}</h2><p>Nhập thông tin công thức, từng chất lẻ, stock gốc và method hướng dẫn pha.</p></div><button className="icon-button" onClick={onCancel} aria-label="Đóng editor"><X size={17} /></button></div><div className="chemical-editor-grid"><label className="field-label">Tên cách pha<Input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="Ví dụ: GBSS/B" /></label><label className="field-label">Nhóm / loại công thức<Input value={draft.group} onChange={event => setDraft(current => ({ ...current, group: event.target.value }))} placeholder="Ví dụ: Dung dịch làm việc" /></label><label className="field-label">Thể tích gốc<Input value={draft.baseVolume} onChange={event => setDraft(current => ({ ...current, baseVolume: event.target.value }))} inputMode="decimal" /></label><label className="field-label">Đơn vị thể tích<select value={draft.baseUnit} onChange={event => setDraft(current => ({ ...current, baseUnit: event.target.value as ChemicalUnit }))}><option value="L">L</option><option value="mL">mL</option><option value="µL">µL</option></select></label><label className="field-label chemical-editor-wide">Stock gốc / nồng độ stock<Input value={draft.stock} onChange={event => setDraft(current => ({ ...current, stock: event.target.value }))} placeholder="Ví dụ: 10X hoặc 250X = 247,75 g/L" /></label><label className="field-label chemical-editor-wide">Ghi chú chung<Textarea value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} placeholder="Bảo quản, lọc màng, pH..." /></label></div><div className="chemical-ingredients-editor"><div className="panel-heading"><div><span className="panel-index">INGREDIENTS / {draft.ingredients.length}</span><h3>Từng chất lẻ</h3></div><Button variant="outline" onClick={onAddIngredient}><Plus size={14} /> Thêm chất</Button></div>{draft.ingredients.map((ingredient, index) => <div className="chemical-ingredient-editor" key={index}><div className="chemical-ingredient-number">{String(index + 1).padStart(2, "0")}</div><label className="field-label">Tên chất<Input value={ingredient.name} onChange={event => updateIngredient(index, { name: event.target.value })} placeholder="Tên hoá chất" /></label><label className="field-label">Số liệu<Input value={ingredient.quantity} onChange={event => updateIngredient(index, { quantity: event.target.value })} inputMode="decimal" placeholder="Lượng cần" /></label><label className="field-label">Đơn vị<Input value={ingredient.unit} onChange={event => updateIngredient(index, { unit: event.target.value })} placeholder="g, mL, µL..." /></label><label className="field-label">Stock gốc<Input value={ingredient.stockValue} onChange={event => updateIngredient(index, { stockValue: event.target.value })} inputMode="decimal" placeholder="Giá trị ban đầu" /></label><label className="field-label">Đơn vị stock<Input value={ingredient.stockUnit} onChange={event => updateIngredient(index, { stockUnit: event.target.value })} placeholder="mg/mL, X..." /></label><label className="field-label">Loại chất<Input value={ingredient.form} onChange={event => updateIngredient(index, { form: event.target.value })} placeholder="Lỏng / Rắn / Khác" /></label><label className="field-label chemical-ingredient-wide">Ghi chú chất này<Input value={ingredient.note} onChange={event => updateIngredient(index, { note: event.target.value })} placeholder="Nồng độ cuối, cách xử lý..." /></label><label className="chemical-checkbox"><input type="checkbox" checked={ingredient.finalTopUp} onChange={event => updateIngredient(index, { finalTopUp: event.target.checked })} /> Bổ sung đến đủ thể tích</label>{draft.ingredients.length > 1 && <button className="icon-button danger chemical-remove-ingredient" onClick={() => onRemoveIngredient(index)} aria-label={`Xoá chất ${index + 1}`}><Trash2 size={15} /></button>}</div>)}</div><label className="field-label chemical-method-editor">Method hướng dẫn pha<Textarea value={draft.method} onChange={event => setDraft(current => ({ ...current, method: event.target.value }))} placeholder="Mỗi dòng là một bước pha, ví dụ:\n1. Đong trước 40 mL nước cất\n2. Cân chất và khuấy tan\n3. Bổ sung đến đủ thể tích" /></label><div className="chemical-editor-actions"><Button variant="outline" onClick={onCancel} disabled={busy}>Huỷ</Button><Button className="primary-cta" onClick={onSave} disabled={busy}><Save size={15} /> {busy ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo cách pha"}</Button></div></section>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: React.ReactNode; description: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
