export type JournalExportLog = {
  id: number;
  workDate: string;
  workDone: string;
  protocol: string;
  cellsSeeded: string;
  note?: string | null;
  numericNote?: string | null;
  issue?: string | null;
};

export type JournalExportFormat = "pdf" | "xlsx";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN");
}

function buildPreviewMarkup(logs: JournalExportLog[], userName?: string | null) {
  const rows = logs.map((log, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(formatDate(log.workDate))}</td><td>${escapeHtml(log.protocol)}</td><td>${escapeHtml(log.workDone).replace(/\n/g, "<br>")}</td><td>${escapeHtml(log.cellsSeeded)}</td><td>${escapeHtml(log.note || "")}</td><td>${escapeHtml(log.numericNote || "")}</td><td>${escapeHtml(log.issue || "")}</td></tr>`).join("");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Lịch sử thí nghiệm - Rebiomed Protocol</title><style>
    :root{font-family:Arial,"Segoe UI",sans-serif;color:#17221e;background:#f4f6f1}body{margin:0;padding:28px}.preview-shell{max-width:1100px;margin:auto;background:#fff;padding:32px;border:1px solid #d9dfd8;border-radius:12px;box-shadow:0 8px 25px rgba(23,34,30,.08)}h1{margin:0 0 6px;font-size:25px}p{color:#647069;font-size:13px}.notice{margin:18px 0;padding:10px 12px;background:#e7f3f0;color:#28675f;font-size:12px;border-radius:6px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d9dfd8;padding:9px;vertical-align:top;text-align:left}th{background:#e7f3f0;color:#285f58}td:first-child{width:36px;text-align:center}td:nth-child(2){white-space:nowrap;width:95px}td:nth-child(5){width:150px}.print-hint{margin-top:18px;font-size:11px;color:#87928b}@media print{body{padding:0;background:#fff}.preview-shell{border:0;box-shadow:none;max-width:none}.notice,.print-hint{display:none}}
  </style></head><body><main class="preview-shell" id="export-sheet"><h1>Rebiomed Protocol — Lịch sử thí nghiệm</h1><p>Account: <strong>${escapeHtml(userName || "Không xác định")}</strong> · Số bản ghi: <strong>${logs.length}</strong></p><div class="notice">Bản xem trước được tạo tại máy cá nhân. Dữ liệu xuất không được lưu trên server.</div><table><thead><tr><th>#</th><th>Ngày làm</th><th>Quy trình</th><th>Công việc đã làm</th><th>Số lượng tế bào đã seed</th><th>Ghi chú</th><th>Ghi chú số liệu</th><th>Vấn đề bất cập</th></tr></thead><tbody>${rows || '<tr><td colspan="8">Không có dữ liệu nhật ký.</td></tr>'}</tbody></table><div class="print-hint">Thời điểm xuất: ${escapeHtml(new Date().toLocaleString("vi-VN"))}</div></main></body></html>`;
}

function fileName(format: JournalExportFormat) {
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

  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const rows = logs.map((log, index) => ({
      STT: index + 1,
      "Ngày làm": formatDate(log.workDate),
      "Quy trình": log.protocol,
      "Công việc đã làm": log.workDone,
      "Số lượng tế bào đã seed": log.cellsSeeded,
      "Ghi chú": log.note || "",
      "Ghi chú số liệu": log.numericNote || "",
      "Vấn đề bất cập": log.issue || "",
    }));
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [{ wch: 7 }, { wch: 15 }, { wch: 30 }, { wch: 60 }, { wch: 25 }, { wch: 35 }, { wch: 35 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "Lịch sử thí nghiệm");
    XLSX.writeFile(workbook, fileName("xlsx"));
    return;
  }

  const sheet = preview.document.getElementById("export-sheet");
  if (!sheet) throw new Error("Không tạo được nội dung PDF xem trước.");
  const { jsPDF } = await import("jspdf");
  const documentPdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  await documentPdf.html(sheet, {
    margin: [10, 10, 10, 10],
    autoPaging: "text",
    html2canvas: { scale: 0.75, useCORS: true, windowWidth: 1100 },
    callback: pdf => pdf.save(fileName("pdf")),
  });
}
