import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { seedProtocols } from "../server/db";
import { seedChemicalRecipes } from "../shared/chemicalRecipes";

const calculators = [
  { id: "dilution", name: "Pha loãng nồng độ", formula: "C₁V₁ = C₂V₂", description: "Tính nhanh nồng độ hoặc thể tích cần lấy khi pha dung dịch." },
  { id: "viability", name: "Cell viability", formula: "Sống / Tổng × 100", description: "Tính tỷ lệ sống của tế bào." },
  { id: "manual-cell-count", name: "Đếm tế bào bằng buồng đếm thủ công", formula: "TB trung bình × hệ số pha loãng × 10⁴ × V", description: "Tính mật độ tế bào; ô dung dịch mặc định 1 mL." },
  { id: "cells-needed", name: "Tính số lượng tế bào cần", formula: "Mật độ × số đơn vị × thể tích", description: "Tính tổng số tế bào cần chuẩn bị." },
  { id: "volume-to-take", name: "Tính thể tích cần lấy", formula: "N mong muốn / N tổng × V tổng", description: "Tính thể tích suspension cần hút." },
  { id: "volume-to-add", name: "Tính lượng thể tích cần thêm", formula: "V mục tiêu − V có sẵn − V đã thêm", description: "Tính lượng dung tích còn cần bổ sung." },
];

const payload = {
  generatedAt: new Date().toISOString(),
  protocols: seedProtocols.map(protocol => ({ ...protocol, id: protocol.slug, updatedAt: new Date().toISOString() })),
  calculators,
  chemicals: seedChemicalRecipes,
};

const output = path.resolve(process.cwd(), "client/public/github-pages-data.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(payload), "utf8");
console.log(`Generated GitHub Pages snapshot: ${payload.protocols.length} protocols, ${payload.chemicals.length} recipes`);
