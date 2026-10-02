import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash } from "node:crypto";
import { calculators, experimentRuns, InsertUser, protocols, samples, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values: InsertUser = { openId: user.openId, approvalStatus: user.approvalStatus ?? "approved" };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (user.approvalStatus !== undefined) {
    values.approvalStatus = user.approvalStatus;
    updateSet.approvalStatus = user.approvalStatus;
  }
  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function createEmailUser(input: { email: string; name: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const email = input.email.toLowerCase();
  await db.insert(users).values({ openId: createHash("sha256").update(email).digest("hex"), email, name: input.name, passwordHash: input.passwordHash, loginMethod: "email", role: "researcher", approvalStatus: "pending" });
}

export async function updateUserApproval(id: number, approvalStatus: "pending" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ approvalStatus }).where(eq(users.id, id));
}

const seedProtocols = [
  {
    slug: "pcr-qpcr",
    title: "Định lượng DNA bằng qPCR",
    category: "Molecular",
    tag: "DNA / qPCR",
    status: "Đã duyệt" as const,
    version: "v2.4",
    owner: "N. Anh",
    summary: "Chuẩn hóa đường chuẩn và định lượng tương đối mẫu DNA bằng SYBR Green.",
    duration: "2 giờ 15 phút",
    steps: [
      { title: "Chuẩn bị đường chuẩn", detail: "Pha serial dilution từ standard 10⁶ đến 10² copies/µL. Vortex nhẹ, spin down 10 giây.", time: "25 phút" },
      { title: "Set up plate", detail: "Thêm 18 µL master mix + 2 µL template. Mỗi điểm chạy duplicate và có NTC.", time: "30 phút" },
      { title: "Chạy chương trình", detail: "95°C 3 phút; 40 cycles: 95°C 10 giây, 60°C 30 giây; melt curve 65–95°C.", time: "65 phút" },
      { title: "Đọc và lưu kết quả", detail: "Kiểm tra R² ≥ 0.98, efficiency 90–110%, sau đó export file raw vào thư mục project.", time: "15 phút" },
    ],
    notes: ["Không để master mix ở nhiệt độ phòng quá 20 phút.", "Loại curve nếu Ct của duplicate lệch > 0.5.", "Ghi đầy đủ lot number của primer và reagent."],
  },
  {
    slug: "protein-bca",
    title: "Định lượng protein bằng BCA",
    category: "Biochemistry",
    tag: "Protein / BCA",
    status: "Đã duyệt" as const,
    version: "v1.8",
    owner: "T. Minh",
    summary: "Xây dựng standard curve BSA và xác định nồng độ protein tổng số trong lysate.",
    duration: "1 giờ 40 phút",
    steps: [
      { title: "Pha dãy BSA", detail: "Chuẩn bị 7 điểm từ 0 đến 2 mg/mL bằng cùng buffer với sample.", time: "20 phút" },
      { title: "Ủ phản ứng", detail: "Trộn reagent A:B = 50:1, thêm 200 µL vào mỗi well và ủ 37°C.", time: "30 phút" },
      { title: "Đọc absorbance", detail: "Đọc tại 562 nm, tránh bubble và để plate về nhiệt độ phòng trước khi đọc.", time: "10 phút" },
    ],
    notes: ["Không dùng sample có chất khử mạnh nếu chưa validate buffer.", "Nếu OD vượt range, pha loãng và ghi hệ số pha."],
  },
  {
    slug: "cell-viability",
    title: "Đánh giá viability tế bào bằng Trypan Blue",
    category: "Cell culture",
    tag: "Cell / viability",
    status: "Bản nháp" as const,
    version: "v0.9",
    owner: "L. Phương",
    summary: "Đếm tế bào sống/chết bằng buồng đếm và thuốc nhuộm Trypan Blue 0.4%.",
    duration: "35 phút",
    steps: [
      { title: "Trộn mẫu", detail: "Trộn 10 µL cell suspension với 10 µL Trypan Blue 0.4%.", time: "5 phút" },
      { title: "Nạp buồng đếm", detail: "Nạp 10 µL hỗn hợp, đếm tối thiểu 4 ô lớn ở hai phía buồng.", time: "15 phút" },
      { title: "Tính viability", detail: "Viability = số tế bào không bắt màu / tổng số tế bào × 100.", time: "15 phút" },
    ],
    notes: ["Đếm trong vòng 3 phút sau khi trộn thuốc nhuộm.", "Mẫu đạt nếu viability ≥ 85% trước khi split."],
  },
];

const seedSamples = [
  { code: "SMP-CELL-001", name: "HeLa cell lysate", groupName: "Cell lysate", status: "Đang dùng", description: "Lysate tế bào HeLa dùng cho các assay protein và kiểm soát nội bộ.", properties: [{ label: "Matrix", value: "RIPA buffer" }, { label: "Nồng độ mục tiêu", value: "1–3 mg/mL" }, { label: "Bảo quản", value: "−80°C" }, { label: "Freeze-thaw", value: "≤ 2 lần" }], theory: "RIPA là buffer ly giải mạnh, phù hợp thu hồi protein màng và protein nhân. SDS trong buffer có thể ảnh hưởng assay, vì vậy cần đối chứng matrix trước khi định lượng." },
  { code: "SMP-DNA-014", name: "Genomic DNA — blood", groupName: "Nucleic acid", status: "Đang dùng", description: "DNA hệ gen chiết xuất từ máu toàn phần, dùng cho PCR và định lượng copy number.", properties: [{ label: "A260/280", value: "1.8–2.0" }, { label: "A260/230", value: "> 1.8" }, { label: "Nồng độ", value: "20–100 ng/µL" }, { label: "Bảo quản", value: "−20°C" }], theory: "Tỉ số hấp thụ A260/280 phản ánh tạp protein, trong khi A260/230 nhạy với muối và dung môi hữu cơ. Độ nguyên vẹn nên được kiểm tra trên agarose gel trước assay nhạy." },
  { code: "REF-BSA-002", name: "BSA reference standard", groupName: "Reference", status: "Đối chứng", description: "Dung dịch BSA reference để dựng calibration curve cho các phép đo protein.", properties: [{ label: "Purity", value: "≥ 98%" }, { label: "Range", value: "0–2 mg/mL" }, { label: "Bảo quản", value: "2–8°C" }, { label: "Lot", value: "BSA-24F-18" }], theory: "BSA là protein chuẩn phổ biến do độ ổn định cao và tín hiệu tương đối tuyến tính trong nhiều assay màu. Cần dùng buffer nền tương đồng giữa standard và sample." },
];

const seedCalculators = [
  { slug: "dilution", name: "Pha loãng nồng độ", category: "Dung dịch", formula: "C₁V₁ = C₂V₂", description: "Tính thể tích stock cần lấy hoặc nồng độ sau pha loãng.", config: { inputs: ["c1", "v1", "c2", "v2"], units: { c1: "mg/mL", v1: "µL", c2: "mg/mL", v2: "µL" } } },
  { slug: "viability", name: "Cell viability", category: "Cell culture", formula: "Sống / Tổng × 100", description: "Tính tỷ lệ sống từ số tế bào sống và tổng số tế bào.", config: { inputs: ["live", "total"], units: { live: "cells", total: "cells" } } },
  { slug: "molarity", name: "Molarity → mass", category: "Hóa chất", formula: "m = C × V × MW", description: "Quy đổi nồng độ mol sang khối lượng chất cần cân.", config: { inputs: ["concentration", "volume", "molecularWeight"], units: { concentration: "M", volume: "L", molecularWeight: "g/mol" } } },
];

const seedRuns = [
  { runCode: "R-18", runDate: "24/09", ctMean: "23.800", efficiency: "96.000", protocolSlug: "pcr-qpcr", notes: "Internal template run" },
  { runCode: "R-19", runDate: "26/09", ctMean: "24.100", efficiency: "94.000", protocolSlug: "pcr-qpcr", notes: "Internal template run" },
  { runCode: "R-20", runDate: "27/09", ctMean: "23.600", efficiency: "98.000", protocolSlug: "pcr-qpcr", notes: "Internal template run" },
  { runCode: "R-21", runDate: "29/09", ctMean: "24.000", efficiency: "95.000", protocolSlug: "pcr-qpcr", notes: "Internal template run" },
  { runCode: "R-22", runDate: "01/10", ctMean: "23.700", efficiency: "97.000", protocolSlug: "pcr-qpcr", notes: "Internal template run" },
];

export async function ensureLabSeed() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: protocols.id }).from(protocols).limit(1);
  if (existing.length > 0) return;
  await db.insert(protocols).values(seedProtocols);
  await db.insert(samples).values(seedSamples);
  await db.insert(calculators).values(seedCalculators);
  await db.insert(experimentRuns).values(seedRuns);
}

export async function getLabContent() {
  const db = await getDb();
  if (!db) return { protocols: [], samples: [], calculators: [], runs: [] };
  await ensureLabSeed();
  const [protocolRows, sampleRows, calculatorRows, runRows] = await Promise.all([
    db.select().from(protocols).orderBy(asc(protocols.id)),
    db.select().from(samples).orderBy(asc(samples.id)),
    db.select().from(calculators).orderBy(asc(calculators.id)),
    db.select().from(experimentRuns).orderBy(asc(experimentRuns.id)),
  ]);
  return { protocols: protocolRows, samples: sampleRows, calculators: calculatorRows, runs: runRows };
}

export async function createProtocolDraft(input: { title: string; summary: string; owner: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const slug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`;
  await db.insert(protocols).values({ slug, title: input.title, category: "Custom", tag: "New protocol", status: "Bản nháp", version: "v0.1", owner: input.owner, summary: input.summary || "Nội dung mới được thêm vào kho LabVault.", duration: "Chưa cập nhật", steps: [{ title: "Bắt đầu biên soạn", detail: input.summary || "Thêm hướng dẫn chi tiết cho bước này.", time: "—" }], notes: ["Bản nháp — cần review trước khi sử dụng trong thực nghiệm."] });
}

export async function createSampleDraft(input: { name: string; description: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const code = `NEW-${Date.now()}`;
  await db.insert(samples).values({ code, name: input.name, groupName: "Bản nháp", status: "Bản nháp", description: input.description || "Mẫu mới được thêm vào kho LabVault.", properties: [{ label: "Trạng thái", value: "Chưa cập nhật" }], theory: input.description || "Bổ sung lý thuyết và dữ liệu tham chiếu cho mẫu này." });
}

export async function updateProtocolDraft(id: number, input: { title: string; summary: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(protocols).set({ title: input.title, summary: input.summary }).where(eq(protocols.id, id));
}

export async function updateSampleDraft(id: number, input: { name: string; description: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(samples).set({ name: input.name, description: input.description, theory: input.description }).where(eq(samples.id, id));
}

export async function deleteProtocolById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(protocols).where(eq(protocols.id, id));
}

export async function listTeamMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, approvalStatus: users.approvalStatus, loginMethod: users.loginMethod, lastSignedIn: users.lastSignedIn }).from(users).orderBy(asc(users.id));
}

export async function updateUserRole(id: number, role: "admin" | "researcher" | "viewer") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}
