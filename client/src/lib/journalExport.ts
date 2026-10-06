export type JournalExportLog = {
  id: number;
  workDate: string;
  workDone: string;
  protocol: string;
  cellsSeeded: string;
  templateName?: string | null;
  experimentName?: string | null;
  cellType?: string | null;
  chemicalsUsed?: string | null;
  cultureConditions?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  result?: string | null;
  note?: string | null;
  numericNote?: string | null;
  issue?: string | null;
};

export type JournalExportFormat = "preview" | "xlsx";

type ExportColumn = { key: keyof JournalExportLog | "index"; label: string };

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "index", label: "#" },
  { key: "workDate", label: "Ngày làm" },
  { key: "templateName", label: "Mẫu biểu" },
  { key: "experimentName", label: "Tên thí nghiệm" },
  { key: "cellType", label: "Loại tế bào" },
  { key: "chemicalsUsed", label: "Hoá chất sử dụng" },
  { key: "cultureConditions", label: "Điều kiện nuôi/xử lý" },
  { key: "startTime", label: "Thời gian bắt đầu" },
  { key: "endTime", label: "Thời gian kết thúc" },
  { key: "workDone", label: "Công việc đã làm" },
  { key: "protocol", label: "Quy trình" },
  { key: "cellsSeeded", label: "Số lượng tế bào đã seed" },
  { key: "result", label: "Kết quả" },
  { key: "note", label: "Ghi chú" },
  { key: "numericNote", label: "Ghi chú số liệu" },
  { key: "issue", label: "Vấn đề bất cập" },
];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN");
}

function formatCell(log: JournalExportLog, column: ExportColumn, index: number) {
  if (column.key === "index") return String(index + 1);
  if (column.key === "workDate") return formatDate(log.workDate);
  return String(log[column.key] ?? "");
}

function buildPreviewMarkup(logs: JournalExportLog[], userName?: string | null) {
  const header = EXPORT_COLUMNS.map(column => `<th>${escapeHtml(column.label)}</th>`).join("");
  const rows = logs.map((log, index) => `<tr>${EXPORT_COLUMNS.map(column => `<td>${escapeHtml(formatCell(log, column, index)).replace(/\n/g, "<br>")}</td>`).join("")}</tr>`).join("");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Lịch sử thí nghiệm - Rebiomed Protocol</title><style>
    *{font-family:Arial,sans-serif!important}html,body{font-family:Arial,sans-serif;color:#17221e;background:#f4f6f1}body{margin:0;padding:28px}.preview-shell{max-width:1500px;margin:auto;background:#fff;padding:32px;border:1px solid #d9dfd8;border-radius:12px;box-shadow:0 8px 25px rgba(23,34,30,.08)}h1{margin:0 0 6px;font-size:25px}p{color:#647069;font-size:13px}.notice{margin:18px 0;padding:10px 12px;background:#e7f3f0;color:#28675f;font-size:12px;border-radius:6px}table{width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed}th,td{border:1px solid #d9dfd8;padding:7px;vertical-align:top;text-align:left;overflow-wrap:anywhere;word-break:break-word}th{background:#e7f3f0;color:#285f58}td:first-child{width:30px;text-align:center}td:nth-child(2){white-space:nowrap;width:78px}.print-hint{margin-top:18px;font-size:11px;color:#87928b}@media print{body{padding:0;background:#fff}.preview-shell{border:0;box-shadow:none;max-width:none}}
  </style></head><body><main class="preview-shell" id="export-sheet"><h1>Rebiomed Protocol — Lịch sử thí nghiệm</h1><p>Account: <strong>${escapeHtml(userName || "Không xác định")}</strong> · Số bản ghi: <strong>${logs.length}</strong></p><div class="notice">Bản xem trước được tạo tại máy cá nhân. Dữ liệu xuất không được lưu trên server.</div><table><thead><tr>${header}</tr></thead><tbody>${rows || `<tr><td colspan="${EXPORT_COLUMNS.length}">Không có dữ liệu nhật ký.</td></tr>`}</tbody></table><div class="print-hint">Thời điểm xuất: ${escapeHtml(new Date().toLocaleString("vi-VN"))}</div></main></body></html>`;
}

function fileName(format: "xlsx") {
  const stamp = new Date().toISOString().slice(0, 10);
  return `rebiomed-experiment-journal-${stamp}.${format}`;
}

export async function exportJournalData(logs: JournalExportLog[], userName: string | null | undefined, format: JournalExportFormat) {
  const preview = window.open("", "_blank");
  if (!preview) throw new Error("Trình duyệt đã chặn tab xem trước. Hãy cho phép popup rồi thử lại.");
  preview.document.open();
  preview.document.write(buildPreviewMarkup(logs, userName));
  preview.document.close();
  await new Promise<void>(resolve => window.setTimeout(resolve, 120));

  if (format === "preview") return;

  const XLSX = await import("xlsx");
  const rows = logs.map((log, index) => Object.fromEntries(EXPORT_COLUMNS.map(column => [column.label, formatCell(log, column, index)])));
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = EXPORT_COLUMNS.map(column => ({ wch: column.key === "index" ? 6 : column.key === "workDate" ? 14 : 25 }));
  XLSX.utils.book_append_sheet(workbook, sheet, "Lịch sử thí nghiệm");
  XLSX.writeFile(workbook, fileName("xlsx"));
}
