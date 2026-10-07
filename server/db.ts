import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHash } from "node:crypto";
import { calculators, chemicalRecipes, experimentLogs, experimentRuns, feedbacks, InsertUser, protocols, samples, users } from "../drizzle/schema";
import { seedChemicalRecipes, type ChemicalIngredient } from "@shared/chemicalRecipes";
import { ENV } from "./_core/env";
import { encryptPasswordForAccount } from "./_core/passwordVault";
import { hashPassword } from "./_core/password";

let _db: ReturnType<typeof drizzle> | null = null;
let experimentLogsTableReady: Promise<void> | null = null;
let supporterIdentityReady: Promise<void> | null = null;
let pendingEditColumnsReady: Promise<void> | null = null;

const SUPPORTER_USERNAME = "supporter";
const SUPPORTER_NAME = "website supporter";
const LEGACY_SUPPORTER_NAME = "bao nguyen gia";
async function ensurePendingEditColumns(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  if (!pendingEditColumnsReady) {
    pendingEditColumnsReady = (async () => {
      for (const statement of [
        sql`ALTER TABLE \`protocols\` ADD COLUMN \`pendingEdit\` JSON NULL`,
        sql`ALTER TABLE \`protocols\` ADD COLUMN \`pendingEditBy\` INT NULL`,
        sql`ALTER TABLE \`protocols\` ADD COLUMN \`pendingEditAt\` TIMESTAMP NULL`,
        sql`ALTER TABLE \`calculators\` ADD COLUMN \`pendingEdit\` JSON NULL`,
        sql`ALTER TABLE \`calculators\` ADD COLUMN \`pendingEditBy\` INT NULL`,
        sql`ALTER TABLE \`calculators\` ADD COLUMN \`pendingEditAt\` TIMESTAMP NULL`,
      ]) {
        try { await db.execute(statement); } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.toLowerCase().includes("duplicate column")) throw error;
        }
      }
    })().catch(error => { pendingEditColumnsReady = null; throw error; });
  }
  await pendingEditColumnsReady;
}


export function isSupporterAccount(user: { role?: string | null; username?: string | null; name?: string | null } | null | undefined) {
  const username = user?.username?.trim().toLowerCase();
  const name = user?.name?.trim().toLowerCase();
  return user?.role === "supporter" || username === SUPPORTER_USERNAME || name === SUPPORTER_NAME || name === LEGACY_SUPPORTER_NAME;
}

function normalizeSupporterUser<T extends { role: string; username?: string | null; name?: string | null; email?: string | null }>(user: T): T {
  return isSupporterAccount(user) ? { ...user, username: "Supporter", name: "Website Supporter", email: null, role: "supporter" } : user;
}

async function ensureSupporterIdentity(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  if (!supporterIdentityReady) {
    supporterIdentityReady = db.execute(sql`UPDATE users SET username = 'Supporter', name = 'Website Supporter', email = NULL WHERE LOWER(TRIM(COALESCE(name, ''))) = ${LEGACY_SUPPORTER_NAME} OR LOWER(TRIM(COALESCE(username, ''))) = ${LEGACY_SUPPORTER_NAME} LIMIT 1`).then(() => undefined).catch(error => {
      supporterIdentityReady = null;
      console.warn("[Supporter] Could not normalize legacy account:", error);
    });
  }
  await supporterIdentityReady;
}

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

async function ensureExperimentLogsTable(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  if (!experimentLogsTableReady) {
    experimentLogsTableReady = db.execute(sql`CREATE TABLE IF NOT EXISTS \`experimentLogs\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`ownerId\` int NOT NULL,
      \`templateName\` varchar(160) NULL,
      \`experimentName\` varchar(255) NULL,
      \`cellType\` varchar(255) NULL,
      \`chemicalsUsed\` text NULL,
      \`cultureConditions\` text NULL,
      \`startTime\` varchar(32) NULL,
      \`endTime\` varchar(32) NULL,
      \`result\` text NULL,
      \`workDate\` varchar(20) NOT NULL,
      \`workDone\` text NOT NULL,
      \`protocol\` text NOT NULL,
      \`cellsSeeded\` varchar(255) NOT NULL,
      \`note\` text NULL,
      \`numericNote\` text NULL,
      \`issue\` text NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    )`).then(async () => {
      const result = await db.execute(sql`SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'experimentLogs'`);
      const columns = new Set(((result[0] ?? []) as unknown as Array<{ COLUMN_NAME?: string }>).map(row => row.COLUMN_NAME));
      for (const column of ["templateName", "experimentName", "cellType", "chemicalsUsed", "cultureConditions", "startTime", "endTime", "result", "note", "numericNote", "issue"] as const) {
        if (!columns.has(column)) await db.execute(sql.raw(`ALTER TABLE \`experimentLogs\` ADD COLUMN \`${column}\` text NULL`));
      }
    }).catch(error => {
      experimentLogsTableReady = null;
      throw error;
    });
  }
  await experimentLogsTableReady;
}

let feedbackTableReady: Promise<void> | null = null;

async function ensureFeedbackTable(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  if (!feedbackTableReady) {
    feedbackTableReady = db.execute(sql`CREATE TABLE IF NOT EXISTS \`feedbacks\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`reporterId\` int NOT NULL,
      \`category\` varchar(32) NOT NULL,
      \`itemName\` varchar(255) NOT NULL,
      \`condition\` varchar(80) NOT NULL,
      \`remainingAmount\` varchar(100) NULL,
      \`remainingUnit\` varchar(10) NULL,
      \`usageCategory\` varchar(255) NULL,
      \`description\` text NULL,
      \`resolvedById\` int NULL,
      \`resolvedAt\` timestamp NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    )`).then(() => undefined).catch(error => {
      feedbackTableReady = null;
      throw error;
    });
  }
  await feedbackTableReady;
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
  await ensureSupporterIdentity(db);
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ? normalizeSupporterUser(result[0]) : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  await ensureSupporterIdentity(db);
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ? normalizeSupporterUser(result[0]) : undefined;
}

export async function getUserByUsernameOrEmail(identifier: string) {
  const db = await getDb();
  if (!db) return undefined;
  await ensureSupporterIdentity(db);
  const normalized = identifier.trim();
  const result = normalized.includes("@")
    ? await db.select().from(users).where(eq(users.email, normalized.toLowerCase())).limit(1)
    : await db.select().from(users).where(eq(users.username, normalized)).limit(1);
  return result[0] ? normalizeSupporterUser(result[0]) : undefined;
}

export async function listExperimentLogs(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureExperimentLogsTable(db);
  return db.select().from(experimentLogs).where(eq(experimentLogs.ownerId, ownerId)).orderBy(asc(experimentLogs.workDate), asc(experimentLogs.id));
}

export async function createExperimentLog(input: { ownerId: number; templateName?: string; experimentName?: string; cellType?: string; chemicalsUsed?: string; cultureConditions?: string; startTime?: string; endTime?: string; result?: string; workDate: string; workDone: string; protocol: string; cellsSeeded: string; note?: string; numericNote?: string; issue?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await ensureExperimentLogsTable(db);
  await db.insert(experimentLogs).values(input);
}

export async function updateExperimentLog(id: number, ownerId: number, input: { templateName?: string; experimentName?: string; cellType?: string; chemicalsUsed?: string; cultureConditions?: string; startTime?: string; endTime?: string; result?: string; workDate: string; workDone: string; protocol: string; cellsSeeded: string; note?: string; numericNote?: string; issue?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await ensureExperimentLogsTable(db);
  await db.update(experimentLogs).set(input).where(and(eq(experimentLogs.id, id), eq(experimentLogs.ownerId, ownerId)));
}

export async function deleteExperimentLog(id: number, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await ensureExperimentLogsTable(db);
  await db.delete(experimentLogs).where(and(eq(experimentLogs.id, id), eq(experimentLogs.ownerId, ownerId)));
}

export async function deleteExperimentLogs(ids: number[] | undefined, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await ensureExperimentLogsTable(db);
  const ownerFilter = eq(experimentLogs.ownerId, ownerId);
  if (!ids) {
    await db.delete(experimentLogs).where(ownerFilter);
    return;
  }
  if (ids.length > 0) {
    await db.delete(experimentLogs).where(and(ownerFilter, inArray(experimentLogs.id, ids)));
  }
}

export async function createFeedback(input: { reporterId: number; category: string; itemName: string; condition: string; remainingAmount?: string; remainingUnit?: string; usageCategory?: string; description?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await ensureFeedbackTable(db);
  await db.insert(feedbacks).values(input);
}

export async function listMyFeedbacks(reporterId: number) {
  const db = await getDb();
  if (!db) return [];
  await ensureFeedbackTable(db);
  return db.select().from(feedbacks).where(eq(feedbacks.reporterId, reporterId)).orderBy(desc(feedbacks.createdAt));
}

export async function deleteFeedback(id: number, reporterId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await ensureFeedbackTable(db);
  await db.delete(feedbacks).where(and(eq(feedbacks.id, id), eq(feedbacks.reporterId, reporterId)));
}

export async function listAdminFeedbacks() {
  const db = await getDb();
  if (!db) return [];
  await ensureFeedbackTable(db);
  const cutoff = new Date(Date.now() - 30 * 60 * 60 * 1000);
  await db.delete(feedbacks).where(and(isNotNull(feedbacks.resolvedAt), lt(feedbacks.resolvedAt, cutoff)));
  return db.select().from(feedbacks).orderBy(desc(feedbacks.createdAt));
}

export async function resolveFeedback(id: number, resolvedById: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await ensureFeedbackTable(db);
  const result = await db.update(feedbacks).set({ resolvedById, resolvedAt: new Date() }).where(and(eq(feedbacks.id, id), isNull(feedbacks.resolvedAt)));
  if (result[0].affectedRows === 0) throw new Error("Phản ánh không tồn tại hoặc đã được xác nhận trước đó.");
}

export async function createEmailUser(input: { username: string; email: string; name: string; password: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const email = input.email.toLowerCase();
  const openId = createHash("sha256").update(`${input.username}:${email}`).digest("hex");
  await db.insert(users).values({ openId, username: input.username, email, name: input.name, passwordHash: hashPassword(input.password), passwordVault: encryptPasswordForAccount(input.password, openId), loginMethod: "email", role: "user", approvalStatus: "pending" });
}

export async function updateUserProfile(id: number, input: { email: string; password?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values: Record<string, unknown> = { email: input.email.toLowerCase() };
  if (input.password) {
    const target = await getUserById(id);
    if (!target) throw new Error("Không tìm thấy tài khoản.");
    values.passwordHash = hashPassword(input.password);
    values.passwordVault = encryptPasswordForAccount(input.password, target.openId);
  }
  await db.update(users).set(values).where(eq(users.id, id));
}

export async function updateUserApproval(id: number, approvalStatus: "pending" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const target = await getUserById(id);
  if ((target?.username?.toLowerCase() === "wstratos" || isSupporterAccount(target)) && approvalStatus !== "approved") {
    throw new Error("Không thể thu hồi quyền truy cập của tài khoản hệ thống.");
  }
  await db.update(users).set({ approvalStatus }).where(eq(users.id, id));
}

export async function deleteUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const target = await getUserById(id);
  if (!target) return false;
  if (target.role === "admin" || target.role === "supporter" || target.username?.toLowerCase() === "wstratos" || isSupporterAccount(target)) {
    throw new Error("Chỉ có thể xoá tài khoản User; tài khoản Admin được bảo vệ.");
  }
  await db.delete(users).where(eq(users.id, id));
  return true;
}

export const seedProtocols = [
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
  {
    slug: "perfusion",
    title: "Perfusion",
    category: "Cell isolation",
    tag: "Liver / NPC / Hepa",
    status: "Bản nháp" as const,
    version: "v0.1",
    owner: "Lab editor",
    summary: "Quy trình phân tách tế bào từ gan, thu NPC và Hepa qua bước ly tâm và gradient Nycodenz.",
    duration: "Khoảng 1–2 giờ",
    steps: [
      { title: "Cân gan", detail: "Ghi lại khối lượng gan trước khi xử lý.", time: "—" },
      { title: "Xé và ngâm gan", detail: "Đổ gan ra đĩa Petri, xé gan nhuyễn và ngâm 3–4 phút.", time: "3–4 phút" },
      { title: "Lắc tan gan", detail: "Hút hỗn hợp vào bình lắc; lắc bình trong tủ ấm 10–20 phút để tan gan.", time: "10–20 phút" },
      { title: "Lọc dịch gan lần 1", detail: "Lọc dịch gan vào 2 falcon 50 mL. Thêm 60 µL DNase I và bổ sung GBSSB tới 50 mL.", time: "—" },
      { title: "Đếm lần 1 và ly tâm nhẹ", detail: "Lấy 10 µL để đếm 1. Ly tâm 40 g trong 3 phút ở 4°C. Tách dịch tế bào (NPC) và cặn tế bào (thu Hepa).", time: "3 phút · 4°C" },
      { title: "Rửa NPC lần 1", detail: "Thêm 60 µL DNase I vào dịch tế bào, huyền phù, bổ sung GBSSB tới 50 mL. Lấy 10 µL đếm 1. Ly tâm 580 g trong 10 phút ở 4°C.", time: "10 phút · 4°C" },
      { title: "Rửa và gộp mẫu", detail: "Hút bớt dịch còn khoảng 10 mL; gộp 2 falcon 50 mL. Bổ sung GBSSB tới 50 mL cùng DNase I và huyền phù.", time: "—" },
      { title: "Đếm lần 2 và rửa", detail: "Lấy 10 µL đếm 2. Ly tâm 580 g trong 10 phút ở 4°C. Hút bớt dịch còn khoảng 10 mL, bổ sung 10 mL GBSSB và huyền phù.", time: "10 phút · 4°C" },
      { title: "Đếm lần 3 và chuẩn bị gradient", detail: "Lấy 10 µL đếm 3. Thêm 60 µL DNase I vào dịch tế bào, huyền phù. Pha Nycodenz 9,6% rồi cho từ từ Nycodenz vào dịch tế bào.", time: "—" },
      { title: "Phân lớp Nycodenz", detail: "Load 2 mL GBSSB. Ly tâm 1800 g trong 18 phút ở 4°C.", time: "18 phút · 4°C" },
      { title: "Thu phân lớp HSC", detail: "Hút phân lớp có HSC. Bổ sung GBSSB tới 14 mL và huyền phù. Lấy 10 µL đếm 4.", time: "—" },
      { title: "Rửa và chuẩn bị seed", detail: "Ly tâm 580 g trong 10 phút ở 4°C. Hút bỏ dịch, giữ cặn. Bổ sung 1 mL môi trường và huyền phù.", time: "10 phút · 4°C" },
      { title: "Đếm và seed", detail: "Lấy 10 µL đếm 4, sau đó seed tế bào theo mật độ thí nghiệm đã được phê duyệt.", time: "—" },
    ],
    notes: ["Giữ mẫu lạnh ở các bước xử lý ngoài tủ ấm.", "Kiểm tra đúng nồng độ DNase I và Nycodenz trước khi bắt đầu.", "Ghi rõ số lần đếm tế bào và phân lớp thu được vào phiếu thí nghiệm.", "Quy trình đang ở trạng thái bản nháp; cần review trước khi dùng chính thức."],
  },
  {
    slug: "total-protein-extraction",
    title: "Tách Protein Tổng",
    category: "ProtocolEvaluation",
    tag: "Protein / Total lysate",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Tách protein tổng từ tế bào bằng TrypLE và RIPA buffer trong điều kiện lạnh.",
    duration: "Khoảng 1 giờ",
    steps: [
      { title: "Kiểm soát nhiệt độ", detail: "Để tránh ảnh hưởng đến hoạt tính của protein, sau khi tách protein, toàn bộ quy trình nên thực hiện ở 4°C.", time: "4°C" },
      { title: "Tách tế bào", detail: "Tách tế bào bằng TrypLE.", time: "—" },
      { title: "Ly giải bằng RIPA", detail: "Thêm 80 μL RIPA buffer cho mỗi 1 triệu tế bào và vortex 5–10 giây.", time: "5–10 giây" },
      { title: "Ủ và trộn mẫu", detail: "Ủ tế bào ở 4°C trong 30 phút; vortex 5–10 giây sau mỗi 5 phút.", time: "30 phút · 4°C" },
      { title: "Ly tâm", detail: "Ly tâm ở 13.000 rpm trong 15 phút.", time: "15 phút" },
      { title: "Thu protein", detail: "Thu phần dịch nổi chứa protein. Trích 5 μL để đo nồng độ protein.", time: "—" },
    ],
    notes: ["Duy trì 4°C trong toàn bộ quy trình sau khi tách protein.", "Ghi rõ số lượng tế bào và thể tích RIPA đã sử dụng.", "Quy trình được cung cấp bởi người dùng và đã được đưa vào kho quy trình."],
  },
  {
    slug: "subcellular-protein-extraction",
    title: "Tách Protein từ nhân/tế bào chất/màng tế bào",
    category: "ProtocolEvaluation",
    tag: "Protein / Subcellular fractionation",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Phân tách protein tế bào chất, màng tế bào và phân đoạn nhân từ pellet tế bào.",
    duration: "Khoảng 1–2 giờ",
    steps: [
      { title: "Tách tế bào", detail: "Tách tế bào bằng TrypLE.", time: "—" },
      { title: "Giữ pellet tế bào", detail: "Đổ bỏ dung dịch và giữ lại cặn tế bào.", time: "—" },
      { title: "Chiết xuất lần 1", detail: "Thêm 100 μL 1X Extraction buffer và huyền phù đều 20–30 lần.", time: "—" },
      { title: "Ly tâm phân đoạn", detail: "Ly tâm 2.000 g trong 5 phút ở 4°C. Chuyển phần dịch nổi chứa protein tế bào chất sang epp mới; cặn chứa màng nhân và xác tế bào.", time: "5 phút · 4°C" },
      { title: "Lặp lại chiết xuất", detail: "Lặp lại các bước thêm 1X Extraction buffer, huyền phù và ly tâm với phần pellet.", time: "—" },
      { title: "Gộp dịch nổi", detail: "Chuyển phần dịch nổi vào epp chứa protein tế bào chất.", time: "—" },
      { title: "Ly giải pellet bằng RIPA", detail: "Thêm 50 μL RIPA buffer vào phần pellet.", time: "—" },
      { title: "Tách protein màng", detail: "Ly tâm phần protein tế bào chất ở 17.000 g trong 20 phút ở 4°C để thu protein trên màng tế bào.", time: "20 phút · 4°C" },
      { title: "Thu các phân đoạn", detail: "Dịch nổi chứa protein tế bào chất; pellet chứa protein màng tế bào. Thêm 50 μL RIPA buffer vào phần pellet.", time: "—" },
      { title: "Hoàn tất thu protein", detail: "Thực hiện thu protein từ RIPA buffer như quy trình bình thường.", time: "—" },
    ],
    notes: ["Giữ mẫu ở 4°C trong suốt quá trình phân đoạn.", "Đánh dấu riêng epp chứa protein tế bào chất, màng tế bào và pellet nhân.", "Kiểm tra lực ly tâm theo g, không nhầm với rpm."],
  },
  {
    slug: "protein-concentration-bca",
    title: "Đo nồng độ Protein (BCA)",
    category: "ProtocolEvaluation",
    tag: "Protein / BCA",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Đo nồng độ protein bằng working solution BCA, đọc hấp thụ tại 562 nm và quy đổi theo phương trình chuẩn.",
    duration: "Khoảng 1 giờ",
    steps: [
      { title: "Chuẩn bị working solution", detail: "Chuẩn bị working solution (WS), 200 μL cho mỗi mẫu/mỗi giếng 96. Thành phần Reagent A:B theo tỷ lệ 50:1.", time: "—" },
      { title: "Pha loãng mẫu", detail: "Pha loãng mẫu protein 5 lần và thêm mẫu vào giếng.", time: "—" },
      { title: "Thêm working solution", detail: "Thêm 200 μL working solution vào mỗi giếng. Với blank: 200 μL working solution + 25 μL PBS/NaCl/nước.", time: "—" },
      { title: "Ủ phản ứng", detail: "Ủ ở 37°C trong 30 phút.", time: "30 phút · 37°C" },
      { title: "Đọc tín hiệu", detail: "Đo ở bước sóng 562 nm.", time: "562 nm" },
      { title: "Tính nồng độ", detail: "Thay số đo được vào phương trình: ((x − 0.0866) / 0.001007) × 5.", time: "—" },
      { title: "Bảo quản mẫu", detail: "Có thể thêm 4X LDS loading buffer để trữ mẫu ở −86°C.", time: "−86°C" },
      { title: "Chuẩn bị chạy gel", detail: "Để trữ mẫu lâu dài, sau khi thêm 4X LDS có thể boil mẫu ở 70°C trong 10 phút. Mẫu sau bước này có thể dùng để chạy SDS-PAGE.", time: "10 phút · 70°C" },
    ],
    notes: ["Dùng đúng hệ số pha loãng 5 lần khi tính nồng độ.", "Luôn có blank để hiệu chỉnh nền.", "Ghi lại bước sóng, thời gian ủ và phương trình đã dùng."],
  },
  {
    slug: "sds-page-gel-preparation",
    title: "Pha Gel SDS-PAGE",
    category: "ProtocolEvaluation",
    tag: "Protein / SDS-PAGE",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Chuẩn bị separating gel và stacking gel cho điện di SDS-PAGE.",
    duration: "Khoảng 1 giờ",
    steps: [
      { title: "Kiểm tra APS", detail: "APS được trữ ở −20°C. Nếu APS có màu trắng đục thay vì trong suốt khi đông đá thì nên bỏ; chỉ nên dùng mỗi aliquot 5–10 lần.", time: "−20°C" },
      { title: "Lắp khuôn", detail: "Lắp khuôn đổ gel và kiểm tra khuôn kín, không bị rò.", time: "—" },
      { title: "Pha separating gel", detail: "Thêm các thành phần theo đúng thứ tự. TEMED bắt đầu quá trình polymer hóa nên phải cho cuối cùng; TEMED hoạt động và làm đông gel trong khoảng 5 phút sau khi thêm.", time: "Khoảng 5 phút" },
      { title: "Đổ separating gel", detail: "Đổ separating gel khoảng 4–4,2 mL. Sau đó thêm Ethanol 100% đến khi ngập khuôn.", time: "—" },
      { title: "Chờ gel đông", detail: "Sau 20 phút, đổ bỏ Ethanol và chờ 1–2 phút cho bay hơi.", time: "20 phút" },
      { title: "Đổ stacking gel", detail: "Thêm stacking gel khoảng 1 mL đến khi ngập khuôn.", time: "—" },
      { title: "Gắn lược", detail: "Dùng khăn giấy đặt dưới khuôn đổ gel và gắn lược. Sau khi gắn lược, gel sẽ tràn ra ngoài; dùng khăn giấy lau khô.", time: "—" },
      { title: "Bảo quản gel", detail: "Sau 20 phút gel đông và có thể sử dụng. Có thể trữ gel trong running buffer ở 4°C khoảng 1 tuần.", time: "20 phút · 4°C" },
    ],
    notes: ["TEMED phải được thêm cuối cùng và cần thao tác nhanh sau khi thêm.", "Kiểm tra khuôn kín trước khi đổ gel.", "Loại bỏ APS có dấu hiệu bất thường."],
  },
  {
    slug: "western-blot",
    title: "Western Blot",
    category: "ProtocolEvaluation",
    tag: "Protein / Western blot",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Điện di SDS-PAGE, chuyển protein sang màng PVDF, ủ kháng thể và phát hiện tín hiệu bằng ECL.",
    duration: "2 ngày",
    steps: [
      { title: "Chuẩn bị mẫu", detail: "Nếu chưa boil mẫu, thực hiện boil theo quy trình chuẩn. Mỗi lần chạy SDS-PAGE/Western Blot cần 20–30 μg protein; với protein biểu hiện yếu như E2F1 hoặc GFAP có thể load 50–100 μg.", time: "—" },
      { title: "Lắp hệ điện di", detail: "Lắp khuôn gel vào bộ chạy điện di đứng, đổ running buffer ngập khuôn nhưng không để tràn ra ngoài. Bắt đầu tháo lược.", time: "—" },
      { title: "Chuẩn bị giếng", detail: "Có thể dùng syringe 1 mL để loại bỏ gel thừa trong các giếng bằng cách hút và bơm vào các giếng.", time: "—" },
      { title: "Load mẫu và ladder", detail: "Load mẫu vào các giếng, tối đa 40 μL mỗi giếng, và 5 μL ladder.", time: "—" },
      { title: "Chạy điện di", detail: "Chạy máy ở 70 V trong 35 phút, sau đó 120 V trong 70–90 phút.", time: "35 phút + 70–90 phút" },
      { title: "Chuẩn bị chuyển màng", detail: "Tháo gel khỏi khuôn điện di, dùng key hoặc cán tháo khuôn gel, rồi chuyển gel qua bể chứa transfer buffer trong lúc setup transfer.", time: "—" },
      { title: "Làm lạnh hệ chuyển", detail: "Chuẩn bị đá trong hộp xốp, đặt bộ điện di cùng bộ chuyển màng vào thùng đá. Đặt lên máy khuấy từ, dùng con cá từ nhỏ và khuấy ở 400 rpm.", time: "400 rpm" },
      { title: "Chuẩn bị transfer buffer", detail: "Đổ transfer buffer đến 3/4 bồn điện di, thêm đá gel sao cho ngập bồn.", time: "—" },
      { title: "Lắp sandwich chuyển màng", detail: "Setup theo thứ tự trong transfer buffer: Xốp đen → giấy lọc → gel → màng PVDF → giấy lọc → xốp đen. Nhúng toàn bộ vật liệu trong transfer buffer.", time: "—" },
      { title: "Loại bọt khí", detail: "Đặt gel lên giấy lọc sao cho không có bọt khí. Dùng lăn theo chiều của ladder, phần ngắn nhất của gel, để tránh rách gel và loại hoàn toàn bọt khí.", time: "—" },
      { title: "Hoạt hóa màng PVDF", detail: "Hoạt hóa màng PVDF trong methanol 100% trong khoảng 30 giây–1 phút. Rửa màng trong transfer buffer, đặt cẩn thận lên gel và lăn nhẹ để loại bọt khí. Đặt giấy lọc đã thấm transfer buffer lên và lăn thêm một lần.", time: "30 giây–1 phút" },
      { title: "Chuyển màng", detail: "Đặt sandwich vào hệ chuyển đúng chiều: đen–đen, trong–đỏ. Chạy ở 100 V trong 1 giờ.", time: "1 giờ · 100 V" },
      { title: "Kiểm tra chuyển protein", detail: "Lấy màng và gel ra, đánh dấu mặt nhận protein trên màng PVDF. Nhuộm Ponceau S trong 10 phút để xác nhận chuyển thành công, sau đó lắc rửa trong TBST/PBST trong 10 phút.", time: "20 phút" },
      { title: "Block và ủ kháng thể sơ cấp", detail: "Block màng bằng blocking buffer trong 30 phút. Ủ kháng thể sơ cấp qua đêm ở 4°C, sau đó thu hồi kháng thể.", time: "Qua đêm · 4°C" },
      { title: "Rửa và ủ kháng thể thứ cấp", detail: "Rửa TBST/PBST mỗi lần 10 phút, tổng cộng 2 lần. Ủ kháng thể thứ cấp trong 1 giờ ở nhiệt độ phòng, vừa ủ vừa lắc. Thu hồi kháng thể và lặp lại bước rửa.", time: "1 giờ · RT" },
      { title: "Chuẩn bị phát hiện", detail: "Thấm khô một phần màng, trữ màng trong lớp nylon trong suốt và đặt vào cassette. Chuẩn bị ECL theo tỷ lệ A:B = 1:1.", time: "—" },
      { title: "Hiện film", detail: "Toàn bộ quy trình hiện film thực hiện trong buồng tối. Thêm khoảng 250 μL ECL lên màng và đợi 1–3 phút đến khi xuất hiện tín hiệu sáng.", time: "1–3 phút · Buồng tối" },
      { title: "Rửa film", detail: "Đặt film X-ray và đợi khoảng 1 phút với tín hiệu mạnh hoặc 30 phút với tín hiệu yếu. Rửa film: developer đến khi xuất hiện band → fixer trong 20 giây → rửa với nước.", time: "20 giây fixer" },
    ],
    notes: ["Giữ hệ chuyển lạnh và hạn chế bọt khí trong sandwich.", "Mặt nhận protein của màng PVDF phải được đánh dấu trước các bước ủ.", "ECL và film phải được thao tác trong điều kiện phù hợp, hiện film trong buồng tối."],
  },
  {
    slug: "zymography",
    title: "Zymography",
    category: "ProtocolEvaluation",
    tag: "Protein / Zymography",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Phát hiện hoạt tính enzyme bằng gel zymography chứa gelatin và các bước rửa, ủ, nhuộm, tẩy nền.",
    duration: "Khoảng 20–26 giờ",
    steps: [
      { title: "Chuẩn bị mẫu", detail: "Thu hồi môi trường nuôi tế bào, cô đặc bằng màng thẩm tách ở 4.000 g trong 15 phút, sau đó đo nồng độ protein bằng BCA.", time: "15 phút" },
      { title: "Pha mẫu non-reducing", detail: "Load mẫu với 5X Non-reducing buffer. Ví dụ: 20 μL mẫu + 5 μL loading buffer.", time: "—" },
      { title: "Chuẩn bị gel", detail: "Chuẩn bị gel zymography sử dụng gelatin loại B.", time: "—" },
      { title: "Load và chạy gel", detail: "Lắp gel vào bộ điện di đứng, thêm running buffer và đá gel giữ lạnh. Load mẫu cùng ladder vào gel. Chạy 70 V trong 35 phút, sau đó 120 V trong 60 phút.", time: "95 phút" },
      { title: "Rửa gel", detail: "Tháo gel khỏi khuôn, chuyển sang hộp chứa washing buffer. Lắc rửa gel 2 lần, mỗi lần 30 phút.", time: "60 phút" },
      { title: "Ủ hoạt tính enzyme", detail: "Ủ gel trong incubation buffer từ 18–24 giờ ở 37°C.", time: "18–24 giờ · 37°C" },
      { title: "Rửa gel sau ủ", detail: "Rửa gel trong PBST/TBST/nước trong 5 phút.", time: "5 phút" },
      { title: "Nhuộm và tẩy nền", detail: "Nhuộm gel bằng Coomassie Blue trong 40 phút. Destain gel bằng destain solution đến khi các band hiện rõ, khoảng 1 giờ.", time: "Khoảng 1 giờ 40 phút" },
    ],
    notes: ["Giữ lạnh trong quá trình điện di.", "Không dùng reducing buffer nếu cần bảo toàn hoạt tính enzyme.", "Thời gian incubation có thể kéo dài 18–24 giờ tùy tín hiệu cần phát hiện.", { type: "table", title: "Bảng pha gel Zymography", columns: ["Thành phần", "Separating gel (7.5%)", "Stacking gel (5%)"], rows: [["Water", "0.85 mL", "1.172 mL"], ["30% Acrylamide", "1.25 mL", "0.268 mL"], ["1.5M Tris-HCl (pH 8.8)", "1.3 mL", "0 mL"], ["0.5M Tris HCl (pH 6.8)", "0 mL", "0.52 mL"], ["Gelatin 10 mg/mL", "1.6 mL", "0 mL"], ["10% SDS", "50 µL", "20 µL"], ["10% APS", "50 µL", "20 µL"], ["TEMED", "5 µL", "2 µL"], ["Total volume", "5 mL", "2 mL"], ["Volume added to the cast", "4–4.5 mL", "1–1.5 mL"]] }],
  },
  {
    slug: "rna-extraction-trizol",
    title: "Quy trình tách RNA bằng Trizol",
    category: "ProtocolPCR",
    tag: "RNA / Trizol",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Tách RNA từ tế bào hoặc mô bằng Trizol, chloroform, isopropanol và ethanol 70–75%.",
    duration: "Khoảng 1–3 giờ",
    steps: [
      { title: "Chuẩn bị dụng cụ và mẫu", detail: "Toàn bộ dụng cụ (epp, tip...) và DEPC phải được khử DNAase/RNAse. Rút bỏ môi trường nuôi cấy càng nhiều càng tốt; nếu thu pellet, rửa bằng PBS lạnh và ly tâm ở 4°C.", time: "—" },
      { title: "Thêm Trizol", detail: "Với tế bào trên đĩa, thêm Trizol vừa đủ phủ kín bề mặt; 250 μL đủ phủ giếng 6. Với pellet, dùng khoảng 1 mL cho 1 triệu tế bào. Với mô, nghiền trong 250 μL rồi thêm 250–750 μL nếu cần.", time: "—" },
      { title: "Ủ và chuyển mẫu", detail: "Ủ 15 phút rồi chuyển sang epp mới, ưu tiên epp 1,5 mL. Kiểm tra tế bào đã bong hoàn toàn; với mô, nghiền trong nitrogen lỏng đến khi mô tan hoàn toàn.", time: "15 phút" },
      { title: "Vortex và tách pha", detail: "Vortex 20–30 giây. Thêm chloroform theo tỷ lệ 1:5 so với Trizol, ví dụ 50 μL chloroform cho 250 μL Trizol. Ủ 3–6 phút rồi ly tâm 12.000 g trong 15 phút ở 4°C.", time: "20–30 giây; 3–6 phút; 15 phút · 4°C" },
      { title: "Thu pha RNA", detail: "Sau ly tâm, thu lớp trong suốt trên cùng và chuyển sang epp mới. Thể tích thường bằng 40–60% thể tích Trizol đầu vào.", time: "—" },
      { title: "Kết tủa RNA", detail: "Thêm isopropanol 100% lạnh −20°C bằng thể tích pha RNA đã hút. Ủ −20°C 15–30 phút với mẫu nhiều RNA, 1–3 giờ với mẫu ít RNA hoặc −86°C qua đêm nếu thu microRNA. Ly tâm 12.000 g trong 10 phút ở 4°C.", time: "10 phút · 4°C" },
      { title: "Rửa pellet", detail: "Loại bỏ isopropanol. Thêm ethanol 70–75% bằng lượng Trizol đầu vào, vortex 5–10 giây, ly tâm 7.500 g trong 5 phút. Có thể lặp lại bước rửa một lần.", time: "5–10 giây; 5 phút" },
      { title: "Làm khô và hòa tan RNA", detail: "Hút toàn bộ ethanol dư, để khô 5–15 phút nhưng không làm pellet khô quá lâu. Nếu còn nhiều ethanol, có thể mở nắp và heat block 55°C trong 5 phút. Thêm DEPC, vortex 5 giây và spin down; mẫu ít RNA dùng 20–30 μL, mẫu nhiều RNA dùng 50–60 μL.", time: "5–15 phút; 55°C nếu cần" },
    ],
    notes: ["Luôn dùng vật tư và hóa chất không có DNAase/RNAse.", "Giữ lạnh ở các bước ly tâm và tránh làm mất lớp RNA trong suốt.", "Ghi lại thể tích Trizol, pha RNA thu được và thể tích DEPC cuối cùng."],
  },
  {
    slug: "rna-dna-gel-electrophoresis",
    title: "Điện di RNA/DNA",
    category: "ProtocolPCR",
    tag: "RNA / DNA gel",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Chuẩn bị gel agarose và SuperGreen để kiểm tra RNA, DNA hoặc sản phẩm PCR.",
    duration: "Khoảng 30–45 phút",
    steps: [
      { title: "Cân agarose", detail: "Cân bột agarose vào beaker hoặc duran. Dùng 1% cho RNA và DNA; dùng 1,5–2% cho sản phẩm PCR tùy kích thước cần phân tách.", time: "—" },
      { title: "Pha dung dịch gel", detail: "Thêm nước để đạt đúng nồng độ agarose yêu cầu. Thêm SuperGreen theo tỷ lệ 1:10.000, ví dụ 3 μL cho 30 mL gel.", time: "—" },
      { title: "Đun tan agarose", detail: "Bịt miệng beaker/duran bằng giấy nến rồi microwave đến khi agarose tan hoàn toàn. Chương trình P100 khoảng 1 phút 30 giây thường đủ cho 30–40 mL agarose; kiểm tra và lắc nhẹ giữa các lần gia nhiệt.", time: "Khoảng 1 phút 30 giây" },
      { title: "Đổ gel và chạy mẫu", detail: "Đổ gel vào khuôn, đặt lược và chờ gel đông hoàn toàn trước khi nạp mẫu. Chạy RNA/DNA theo buffer, điện áp và thời gian đã được phê duyệt cho loại mẫu.", time: "Theo assay" },
    ],
    notes: ["Không đun quá lâu làm bay hơi nước và thay đổi nồng độ gel.", "Cẩn thận khi lấy beaker sau microwave vì dung dịch rất nóng.", "Chọn nồng độ agarose phù hợp với kích thước RNA/DNA cần quan sát."],
  },
  {
    slug: "cdna-reverse-transcription",
    title: "cDNA Reverse-transcription",
    category: "ProtocolPCR",
    tag: "RNA / cDNA",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Tổng hợp cDNA từ RNA đã đo nồng độ bằng Nanodrop với SensiFAST cDNA Synthesis Kit.",
    duration: "Khoảng 1 giờ",
    steps: [
      { title: "Xác định lượng RNA", detail: "Sau khi đo nồng độ RNA bằng Nanodrop, xác định lượng cDNA cần tổng hợp. Lượng RNA đầu vào tối đa 1.500 ng, tối thiểu khuyến nghị 500 ng.", time: "—" },
      { title: "Chọn thể tích phản ứng", detail: "Có thể giảm thể tích phản ứng cDNA xuống 10 μL bằng cách giảm một nửa thể tích từng thành phần. Phản ứng tiêu chuẩn trong bảng Master Mix cDNA là 20 μL.", time: "10 hoặc 20 μL" },
      { title: "Pha master mix", detail: "Khi có nhiều hơn 5 phản ứng, pha master mix theo bảng tính. Cho DEPC vào từng epp trước, sau đó thêm 5x TransAmp Buffer, Reverse Transcriptase và RNA.", time: ">5 mẫu" },
      { title: "Chạy chương trình cDNA", detail: "Đặt epp 0,2 mL vào máy với chương trình cDNA Synthesis: 25°C 10 phút, 42°C 15 phút, tùy chọn 48°C 15 phút với RNA cấu trúc cao, 85°C 5 phút, giữ 4°C hoặc làm lạnh trên đá.", time: "Khoảng 45 phút" },
      { title: "Bảo quản cDNA", detail: "Lấy epp ra khỏi máy và bảo quản cDNA ở −20°C.", time: "−20°C" },
    ],
    notes: ["Không vượt quá 1.500 ng RNA trong phản ứng 20 μL.", "Dùng bảng Master Mix cDNA để giảm sai số khi pha nhiều mẫu.", "Ghi rõ kí hiệu mẫu và thể tích RNA thực tế đã hút."],
  },
  {
    slug: "qpcr-sensifast-sybr-hirox",
    title: "qPCR",
    category: "ProtocolPCR",
    tag: "RNA / qPCR",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Chuẩn bị master mix qPCR từ cDNA, SensiFAST SYBR Hi-ROX và primer trong DEPC.",
    duration: "Khoảng 2–3 giờ",
    steps: [
      { title: "Pha master mix 1", detail: "Pha loãng 2X SensiFAST™ SYBR® Hi-ROX Kit theo thể tích phản ứng và số mẫu cần chạy.", time: "—" },
      { title: "Pha master mix 2", detail: "Pha loãng cDNA trong master mix 1 theo thiết kế thí nghiệm, giữ cùng thể tích cuối giữa các mẫu.", time: "—" },
      { title: "Pha master mix 3", detail: "Pha loãng primer trong DEPC, chuẩn bị riêng primer forward và reverse theo nồng độ đã được phê duyệt.", time: "—" },
      { title: "Setup đĩa qPCR", detail: "Phân phối master mix và mẫu vào plate, bổ sung NTC và các đối chứng cần thiết. Kiểm tra kí hiệu giếng trước khi đóng plate.", time: "—" },
      { title: "Cài chương trình và chạy", detail: "Thiết lập plate trên phần mềm qPCR, kiểm tra chương trình nhiệt và bắt đầu chạy. Lưu raw data cùng thông tin lot kit, primer và ngày chạy.", time: "Theo assay" },
    ],
    notes: ["Giữ master mix và primer trên đá trong thời gian setup.", "Luôn có NTC và đối chứng phù hợp.", "Lưu lại cấu hình plate, chương trình nhiệt và raw data sau khi chạy."],
  },
  {
    slug: "hema-oil-red-o-staining",
    title: "Nhuộm Hema-Oil Red O",
    category: "ProtocolStaining",
    tag: "Staining / Oil Red O",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Nhuộm Oil Red O và hematoxylin để quan sát, chụp hình và đánh giá mẫu tế bào.",
    duration: "Khoảng 30–45 phút",
    steps: [
      { title: "Rửa PBS", detail: "Loại môi trường rồi rửa PBS 3 lần.", time: "—" },
      { title: "Cố định mẫu", detail: "Cố định bằng Para 1% trong 15 phút, sau đó chụp hình.", time: "15 phút" },
      { title: "Rửa sau cố định", detail: "Rửa PBS 3 lần.", time: "—" },
      { title: "Pha Oil Red O", detail: "Mix Oil Red O và nước cất/PBS theo tỉ lệ 3:2.", time: "—" },
      { title: "Nhuộm Oil Red O", detail: "Hút 50 µL thuốc nhuộm vào mỗi giếng và ủ 10–15 phút.", time: "10–15 phút" },
      { title: "Rửa thuốc nhuộm", detail: "Hút bỏ thuốc nhuộm và rửa với PBS 4 lần.", time: "—" },
      { title: "Quan sát mẫu", detail: "Trữ mẫu trong PBS, xem kính hiển vi và chụp hình đánh giá kết quả.", time: "—" },
      { title: "Đối màu hematoxylin", detail: "Loại PBS, thêm hematoxylin 20% và ủ 15–20 giây.", time: "15–20 giây" },
      { title: "Rửa và quan sát lần cuối", detail: "Hút bỏ hematoxylin, rửa PBS rồi xem kính hiển vi.", time: "—" },
    ],
    notes: ["Ghi lại thời gian cố định, thời gian nhuộm và điều kiện chụp hình cho từng mẫu.", "Kiểm tra mẫu dưới kính hiển vi trước khi kết luận kết quả nhuộm."],
  },
  {
    slug: "picro-sirius-red-cell-staining",
    title: "Nhuộm Picro Sirius Red – tế bào",
    category: "ProtocolStaining",
    tag: "Staining / Picro Sirius Red",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Nhuộm Picro Sirius Red trên tế bào, quan sát bằng kính hiển vi và định lượng hấp thụ ở 510 nm.",
    duration: "Khoảng 1–2 giờ",
    steps: [
      { title: "Rửa PBS", detail: "Loại môi trường rồi rửa PBS 3 lần.", time: "—" },
      { title: "Cố định mẫu", detail: "Cố định bằng Para 1% trong 15 phút, sau đó chụp hình.", time: "15 phút" },
      { title: "Rửa sau cố định", detail: "Rửa PBS 3 lần.", time: "—" },
      { title: "Thêm solution A", detail: "Cho 50 µL solution A vào mỗi giếng và ủ 2 phút.", time: "2 phút" },
      { title: "Rửa solution A", detail: "Rửa PBS 3 lần.", time: "—" },
      { title: "Thêm solution B", detail: "Cho 50 µL solution B vào mỗi giếng và ủ 1 giờ.", time: "1 giờ" },
      { title: "Thêm solution C", detail: "Cho 50 µL solution C vào mỗi giếng: lần 1 ủ 10 giây, lần 2 ủ 2 phút.", time: "10 giây + 2 phút" },
      { title: "Rửa bằng ethanol", detail: "Rửa ethanol 70% 3 lần.", time: "—" },
      { title: "Quan sát mẫu", detail: "Trữ mẫu với ethanol và xem kính hiển vi.", time: "—" },
      { title: "Hòa tan Picro Sirius Red", detail: "Thêm 100 µL NaOH 0,1 M, ủ 1–2 phút để hòa tan hoàn toàn Picro Sirius Red.", time: "1–2 phút" },
      { title: "Đo hấp thụ", detail: "Đo độ hấp thụ ở bước sóng 510 nm.", time: "510 nm" },
      { title: "Tính kết quả", detail: "Thế số OD đo được vào đường chuẩn.", time: "—" },
    ],
    notes: ["Ghi rõ thời gian ủ của từng solution và số lần rửa.", "Đường chuẩn phải được chạy cùng điều kiện đo để quy đổi OD."],
  },
  {
    slug: "icc-staining",
    title: "Quy trình nhuộm ICC",
    category: "ProtocolStaining",
    tag: "Staining / ICC",
    status: "Đã duyệt" as const,
    version: "v1.0",
    owner: "W.Stratos",
    summary: "Nhuộm miễn dịch tế bào với permeabilization, blocking buffer, kháng thể sơ cấp, Alexa và DAPI.",
    duration: "Qua đêm + khoảng 3 giờ",
    steps: [
      { title: "Rửa PBS", detail: "Sau khi loại môi trường, rửa mẫu bằng PBS.", time: "—" },
      { title: "Cố định mẫu", detail: "Cố định Para 1% trong 15 phút, sau đó chụp hình.", time: "15 phút" },
      { title: "Rửa sau cố định", detail: "Rửa PBS 3 lần rồi bỏ PBS.", time: "—" },
      { title: "Permeabilization", detail: "Thêm permeabilization solution và ủ 10 phút. Với mô, cần điều chỉnh nồng độ và thời gian.", time: "10 phút" },
      { title: "Rửa permeabilization", detail: "Rửa PBS 2 lần, mỗi lần 5 phút.", time: "2 × 5 phút" },
      { title: "Blocking", detail: "Thay blocking buffer và ủ trong 30 phút.", time: "30 phút" },
      { title: "Kháng thể sơ cấp", detail: "Thêm kháng thể sơ cấp, bọc mẫu và ủ ít nhất 12 giờ ở 4°C.", time: "≥12 giờ · 4°C" },
      { title: "Thu hồi kháng thể", detail: "Hôm sau thu hồi kháng thể để đưa vào kháng thể reuse; ghi tên anti, tỉ lệ pha loãng và thông tin mẫu.", time: "—" },
      { title: "Rửa kháng thể sơ cấp", detail: "Rửa lại với PBS, lặp lại 3 lần.", time: "—" },
      { title: "Kháng thể liên hợp Alexa", detail: "Thêm Alexa, ủ 1 giờ ở nhiệt độ phòng và rửa PBS 2 lần.", time: "1 giờ · RT" },
      { title: "Nhuộm DAPI", detail: "Nhỏ DAPI 1 µg/mL lên mẫu, ủ 5–10 phút rồi rửa 2–3 lần bằng PBS.", time: "5–10 phút" },
      { title: "Rửa hoàn tất", detail: "Rửa lại PBS 2 lần.", time: "—" },
      { title: "Bảo quản mẫu", detail: "Trữ mẫu trong PBS ở 4°C.", time: "4°C" },
    ],
    notes: [
      "Para giúp cố định hoạt động của tế bào. Trong trường hợp nhiễm nấm hoặc nhiễm khuẩn, Para không đủ khả năng cố định tác nhân; nếu sau cố định vẫn thấy tác nhân lạ di chuyển trong đĩa/flask thì cần xem xét khả năng nhiễm.",
      "Permea có vai trò làm đục màng tế bào để kháng thể đi vào; với mô cần điều chỉnh nồng độ và thời gian.",
      "Blocking buffer giúp hạn chế tín hiệu nền và các yếu tố gây nhiễu không đặc hiệu khi đọc hình ảnh.",
      "Kháng thể có serum/protein cần được aliquot để sử dụng; serum và protein có thể làm tăng sinh vi khuẩn.",
    ],
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
  { slug: "manual-cell-count", name: "Đếm tế bào bằng buồng đếm thủ công", category: "Cells", formula: "(TB trung bình / ô) × hệ số pha loãng × 10⁴", description: "Tính mật độ tế bào từ số tế bào đếm được trong buồng đếm thủ công.", config: { inputs: ["averageCells", "countedSquares", "dilutionFactor"], units: { averageCells: "cells", countedSquares: "ô", dilutionFactor: "×" } } },
  { slug: "cells-needed", name: "Tính số lượng tế bào cần", category: "Cell seeding", formula: "Mật độ mục tiêu × số đơn vị × thể tích / đơn vị", description: "Tính tổng số tế bào cần chuẩn bị cho các giếng hoặc đơn vị nuôi cấy.", config: { inputs: ["targetDensity", "unitCount", "volumePerUnit"], units: { targetDensity: "cells/mL", unitCount: "đơn vị", volumePerUnit: "mL" } } },
  { slug: "volume-to-take", name: "Tính thể tích cần lấy", category: "Cell seeding", formula: "V lấy = N mong muốn / N tổng × V tổng", description: "Tính thể tích cần hút từ suspension hiện có để thu được số tế bào mong muốn.", config: { inputs: ["desiredCells", "totalCells", "totalVolume"], units: { desiredCells: "cells", totalCells: "cells", totalVolume: "mL" } } },
  { slug: "volume-to-add", name: "Tính lượng thể tích cần thêm", category: "Hóa chất", formula: "V mục tiêu − V có sẵn − V đã thêm", description: "Tính lượng dung tích còn cần bổ sung để đạt tổng dung tích mục tiêu.", config: { inputs: ["availableVolume", "addedVolume", "targetVolume"], units: { availableVolume: "mL", addedVolume: "mL", targetVolume: "mL" } } },
  { slug: "seeding", name: "Seeding", category: "Cells", formula: "Tổng môi trường = số đơn vị × thể tích mỗi đơn vị", description: "Tính tổng môi trường, thể tích suspension chứa tế bào cần lấy và môi trường cần bổ sung khi seed.", config: { kind: "seeding", defaultCountedSquares: 4, defaultSolutionVolume: 1, defaultDilutionFactor: 1.5, vessels: { "giếng 96": 100, "giếng 48": 250, "giếng 6": 1200, "flask T25": 2500 } } },
  { slug: "nycodenz", name: "Tính pha Nycodenz", category: "Hóa chất", formula: "V Nycodenz = V lớp × % sử dụng / % stock", description: "Tool ẩn chỉ được liên kết và sử dụng trong bước quy trình; không hiện trong bảng Công cụ tính tổng hợp.", config: { kind: "nycodenz", protocolOnly: true, volumeUnit: "mL", layerModes: ["1 phân lớp", "2 phân lớp"] } },
  { slug: "bca-working-solution", name: "Pha Working Solution BCA", category: "Hóa chất", formula: "A = V giếng × (giếng sử dụng + blank); B = A / 50", description: "Tool ẩn tính dung tích Reagent A và Reagent B cho assay BCA.", config: { kind: "bca-working-solution", protocolOnly: true, volumeUnit: "µL", defaultVolumePerWell: 200 } },
  { slug: "hypoxia-headspace", name: "Ước tính O₂ pha khí hệ kín", category: "Hypoxia", formula: "n(O₂) = P tuyệt đối × V khí × %O₂ / (R × T)", description: "Ước tính lượng O₂ pha khí và thời gian đến ngưỡng giả định; không thay cho đo oxy tại tế bào.", config: { model: "ideal-gas-headspace", reference: "https://www.mdpi.com/2073-4409/9/11/2456" } },
];

const seedRuns = [
  { runCode: "R-18", runDate: "24/09", ctMean: "23.800", efficiency: "96.000", protocolSlug: "pcr-qpcr", notes: "Internal template run" },
  { runCode: "R-19", runDate: "26/09", ctMean: "24.100", efficiency: "94.000", protocolSlug: "pcr-qpcr", notes: "Internal template run" },
  { runCode: "R-20", runDate: "27/09", ctMean: "23.600", efficiency: "98.000", protocolSlug: "pcr-qpcr", notes: "Internal template run" },
  { runCode: "R-21", runDate: "29/09", ctMean: "24.000", efficiency: "95.000", protocolSlug: "pcr-qpcr", notes: "Internal template run" },
  { runCode: "R-22", runDate: "01/10", ctMean: "23.700", efficiency: "97.000", protocolSlug: "pcr-qpcr", notes: "Internal template run" },
];

let zymographyGelTableReady: Promise<void> | null = null;
let additionalProtocolSeedReady: Promise<void> | null = null;
let additionalStainingProtocolSeedReady: Promise<void> | null = null;
let additionalCalculatorSeedReady: Promise<void> | null = null;
let additionalChemicalSeedReady: Promise<void> | null = null;

const additionalProtocolSlugs = new Set(["rna-extraction-trizol", "rna-dna-gel-electrophoresis", "cdna-reverse-transcription", "qpcr-sensifast-sybr-hirox"]);

async function ensureAdditionalProtocolSeeds(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  if (!additionalProtocolSeedReady) {
    additionalProtocolSeedReady = db.execute(sql`CREATE TABLE IF NOT EXISTS \`contentSeedMarkers\` (\`seedKey\` varchar(160) NOT NULL PRIMARY KEY, \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`).then(async () => {
      const result = await db.execute(sql`SELECT \`seedKey\` FROM \`contentSeedMarkers\` WHERE \`seedKey\` = 'protocols-rna-cdna-2026-10-07' LIMIT 1`);
      const rows = (result[0] ?? []) as unknown as Array<{ seedKey?: string }>;
      if (rows.length > 0) return;
      for (const seed of seedProtocols.filter(item => additionalProtocolSlugs.has(item.slug))) {
        const existing = await db.select({ id: protocols.id }).from(protocols).where(eq(protocols.slug, seed.slug)).limit(1);
        if (existing.length === 0) await db.insert(protocols).values(seed);
      }
      await db.execute(sql`INSERT INTO \`contentSeedMarkers\` (\`seedKey\`) VALUES ('protocols-rna-cdna-2026-10-07')`);
    }).catch(error => {
      additionalProtocolSeedReady = null;
      throw error;
    });
  }
  await additionalProtocolSeedReady;
}

const additionalStainingProtocolSlugs = new Set(["hema-oil-red-o-staining", "picro-sirius-red-cell-staining", "icc-staining"]);
async function ensureAdditionalStainingProtocolSeeds(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  if (!additionalStainingProtocolSeedReady) {
    additionalStainingProtocolSeedReady = db.execute(sql`CREATE TABLE IF NOT EXISTS \`contentSeedMarkers\` (\`seedKey\` varchar(160) NOT NULL PRIMARY KEY, \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`).then(async () => {
      const result = await db.execute(sql`SELECT \`seedKey\` FROM \`contentSeedMarkers\` WHERE \`seedKey\` = 'protocols-staining-2026-10-07' LIMIT 1`);
      const rows = (result[0] ?? []) as unknown as Array<{ seedKey?: string }>;
      if (rows.length > 0) return;
      for (const seed of seedProtocols.filter(item => additionalStainingProtocolSlugs.has(item.slug))) {
        const existing = await db.select({ id: protocols.id }).from(protocols).where(eq(protocols.slug, seed.slug)).limit(1);
        if (existing.length === 0) await db.insert(protocols).values(seed);
      }
      await db.execute(sql`INSERT INTO \`contentSeedMarkers\` (\`seedKey\`) VALUES ('protocols-staining-2026-10-07')`);
    }).catch(error => {
      additionalStainingProtocolSeedReady = null;
      throw error;
    });
  }
  await additionalStainingProtocolSeedReady;
}

const additionalCalculatorSlugs = new Set(["volume-to-add", "nycodenz"]);
let bcaCalculatorSeedReady: Promise<void> | null = null;
async function ensureAdditionalCalculatorSeeds(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  if (!additionalCalculatorSeedReady) {
    additionalCalculatorSeedReady = db.execute(sql`CREATE TABLE IF NOT EXISTS \`contentSeedMarkers\` (\`seedKey\` varchar(160) NOT NULL PRIMARY KEY, \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`).then(async () => {
      const result = await db.execute(sql`SELECT \`seedKey\` FROM \`contentSeedMarkers\` WHERE \`seedKey\` = 'calculators-volume-add-nycodenz-2026-10-07' LIMIT 1`);
      const rows = (result[0] ?? []) as unknown as Array<{ seedKey?: string }>;
      if (rows.length > 0) return;
      for (const seed of seedCalculators.filter(item => additionalCalculatorSlugs.has(item.slug))) {
        const existing = await db.select({ id: calculators.id }).from(calculators).where(eq(calculators.slug, seed.slug)).limit(1);
        if (existing.length === 0) await db.insert(calculators).values(seed);
      }
      await db.execute(sql`INSERT INTO \`contentSeedMarkers\` (\`seedKey\`) VALUES ('calculators-volume-add-nycodenz-2026-10-07')`);
    }).catch(error => {
      additionalCalculatorSeedReady = null;
      throw error;
    });
  }
  await additionalCalculatorSeedReady;
}

async function ensureBcaCalculatorSeed(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  if (!bcaCalculatorSeedReady) {
    bcaCalculatorSeedReady = db.execute(sql`CREATE TABLE IF NOT EXISTS \`contentSeedMarkers\` (\`seedKey\` varchar(160) NOT NULL PRIMARY KEY, \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`).then(async () => {
      const result = await db.execute(sql`SELECT \`seedKey\` FROM \`contentSeedMarkers\` WHERE \`seedKey\` = 'calculator-bca-working-solution-2026-10-07' LIMIT 1`);
      const rows = (result[0] ?? []) as unknown as Array<{ seedKey?: string }>;
      if (rows.length > 0) return;
      const seed = seedCalculators.find(item => item.slug === "bca-working-solution");
      if (seed) {
        const existing = await db.select({ id: calculators.id }).from(calculators).where(eq(calculators.slug, seed.slug)).limit(1);
        if (existing.length === 0) await db.insert(calculators).values(seed);
      }
      await db.execute(sql`INSERT INTO \`contentSeedMarkers\` (\`seedKey\`) VALUES ('calculator-bca-working-solution-2026-10-07')`);
    }).catch(error => {
      bcaCalculatorSeedReady = null;
      throw error;
    });
  }
  await bcaCalculatorSeedReady;
}

async function ensureZymographyGelTable(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  if (!zymographyGelTableReady) {
    zymographyGelTableReady = db.execute(sql`UPDATE \`protocols\`
      SET \`notes\` = JSON_ARRAY_APPEND(
        \`notes\`,
        '$',
        JSON_OBJECT(
          'type', 'table',
          'title', 'Bảng pha gel Zymography',
          'columns', JSON_ARRAY('Thành phần', 'Separating gel (7.5%)', 'Stacking gel (5%)'),
          'rows', JSON_ARRAY(
            JSON_ARRAY('Water', '0.85 mL', '1.172 mL'),
            JSON_ARRAY('30% Acrylamide', '1.25 mL', '0.268 mL'),
            JSON_ARRAY('1.5M Tris-HCl (pH 8.8)', '1.3 mL', '0 mL'),
            JSON_ARRAY('0.5M Tris HCl (pH 6.8)', '0 mL', '0.52 mL'),
            JSON_ARRAY('Gelatin 10 mg/mL', '1.6 mL', '0 mL'),
            JSON_ARRAY('10% SDS', '50 µL', '20 µL'),
            JSON_ARRAY('10% APS', '50 µL', '20 µL'),
            JSON_ARRAY('TEMED', '5 µL', '2 µL'),
            JSON_ARRAY('Total volume', '5 mL', '2 mL'),
            JSON_ARRAY('Volume added to the cast', '4–4.5 mL', '1–1.5 mL')
          )
        )
      )
      WHERE \`slug\` = 'zymography'
        AND JSON_SEARCH(\`notes\`, 'one', 'Bảng pha gel Zymography') IS NULL`).then(() => undefined).catch(error => {
      zymographyGelTableReady = null;
      throw error;
    });
  }
  await zymographyGelTableReady;
}

export async function ensureLabSeed() {
  const db = await getDb();
  if (!db) return;
  const [existingUser, existingProtocol, existingSample, existingCalculator, existingRun] = await Promise.all([
    db.select({ id: users.id }).from(users).limit(1),
    db.select({ id: protocols.id }).from(protocols).limit(1),
    db.select({ id: samples.id }).from(samples).limit(1),
    db.select({ id: calculators.id }).from(calculators).limit(1),
    db.select({ id: experimentRuns.id }).from(experimentRuns).limit(1),
  ]);
  // Seed only a brand-new installation. Once an account exists, deleting content must never
  // be interpreted as an empty database and must never recreate or overwrite user data.
  if (existingUser.length === 0 && existingProtocol.length === 0 && existingSample.length === 0 && existingCalculator.length === 0 && existingRun.length === 0) {
    await db.insert(protocols).values(seedProtocols);
    await db.insert(samples).values(seedSamples);
    await db.insert(calculators).values(seedCalculators);
    await db.insert(experimentRuns).values(seedRuns);
  }
}

export async function getLabContent() {
  const db = await getDb();
  if (!db) return { protocols: [], samples: [], calculators: [], runs: [] };
  await ensureLabSeed();
  await ensureAdditionalProtocolSeeds(db);
  await ensureAdditionalStainingProtocolSeeds(db);
  await ensureAdditionalCalculatorSeeds(db);
  await ensureBcaCalculatorSeed(db);
  await ensureZymographyGelTable(db);
  const [protocolRows, sampleRows, calculatorRows, runRows] = await Promise.all([
    db.select({ id: protocols.id, slug: protocols.slug, title: protocols.title, category: protocols.category, tag: protocols.tag, status: protocols.status, version: protocols.version, updatedAt: protocols.updatedAt, owner: protocols.owner, summary: protocols.summary, duration: protocols.duration, steps: protocols.steps, notes: protocols.notes }).from(protocols).orderBy(asc(protocols.id)),
    db.select().from(samples).orderBy(asc(samples.id)),
    db.select({ id: calculators.id, slug: calculators.slug, name: calculators.name, category: calculators.category, formula: calculators.formula, description: calculators.description, config: calculators.config, status: calculators.status, active: calculators.active }).from(calculators).orderBy(asc(calculators.id)),
    db.select().from(experimentRuns).orderBy(asc(experimentRuns.id)),
  ]);
  return { protocols: protocolRows, samples: sampleRows, calculators: calculatorRows, runs: runRows };
}

type ChemicalRecipeInput = {
  name: string;
  group: string;
  baseVolume: number;
  baseUnit: string;
  stock: string;
  note?: string;
  ingredients: ChemicalIngredient[];
  method: string;
};

async function ensureChemicalSeed() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ slug: chemicalRecipes.slug }).from(chemicalRecipes).limit(1);
  if (existing.length > 0) return;
  await db.insert(chemicalRecipes).values(seedChemicalRecipes.map(recipe => ({
    slug: recipe.id,
    name: recipe.name,
    groupName: recipe.group,
    baseVolume: String(recipe.baseVolume),
    baseUnit: recipe.baseUnit,
    stock: recipe.stock,
    note: recipe.note ?? null,
    ingredients: recipe.ingredients,
    method: recipe.steps.join("\n"),
    status: "Đã duyệt",
    active: 1,
  })));
}

const additionalChemicalRecipeIds = new Set(["oil-red-o-working", "icc-alexa-488", "icc-dapi", "icc-permeabilization", "icc-blocking-buffer"]);
async function ensureAdditionalChemicalSeeds() {
  const db = await getDb();
  if (!db) return;
  if (!additionalChemicalSeedReady) {
    additionalChemicalSeedReady = db.execute(sql`CREATE TABLE IF NOT EXISTS \`contentSeedMarkers\` (\`seedKey\` varchar(160) NOT NULL PRIMARY KEY, \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)`).then(async () => {
      const result = await db.execute(sql`SELECT \`seedKey\` FROM \`contentSeedMarkers\` WHERE \`seedKey\` = 'chemicals-staining-2026-10-07' LIMIT 1`);
      const rows = (result[0] ?? []) as unknown as Array<{ seedKey?: string }>;
      if (rows.length > 0) return;
      for (const recipe of seedChemicalRecipes.filter(item => additionalChemicalRecipeIds.has(item.id))) {
        const existing = await db.select({ id: chemicalRecipes.id }).from(chemicalRecipes).where(eq(chemicalRecipes.slug, recipe.id)).limit(1);
        if (existing.length === 0) await db.insert(chemicalRecipes).values({
          slug: recipe.id,
          name: recipe.name,
          groupName: recipe.group,
          baseVolume: String(recipe.baseVolume),
          baseUnit: recipe.baseUnit,
          stock: recipe.stock,
          note: recipe.note ?? null,
          ingredients: recipe.ingredients,
          method: recipe.steps.join("\n"),
          status: "Đã duyệt",
          active: 1,
        });
      }
      await db.execute(sql`INSERT INTO \`contentSeedMarkers\` (\`seedKey\`) VALUES ('chemicals-staining-2026-10-07')`);
    }).catch(error => {
      additionalChemicalSeedReady = null;
      throw error;
    });
  }
  await additionalChemicalSeedReady;
}

function slugifyChemicalName(name: string) {
  return `${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`;
}

function toChemicalRecipe(row: typeof chemicalRecipes.$inferSelect) {
  return {
    id: row.slug,
    dbId: row.id,
    name: row.name,
    group: row.groupName,
    baseVolume: Number(row.baseVolume),
    baseUnit: row.baseUnit,
    stock: row.stock,
    note: row.note ?? undefined,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients as ChemicalIngredient[] : [],
    steps: row.method.split("\n").map(item => item.trim()).filter(Boolean),
    status: row.status === "Bản nháp" ? "Bản nháp" : "Đã duyệt",
  };
}

export async function listChemicalRecipes() {
  const db = await getDb();
  if (!db) return seedChemicalRecipes.map(recipe => ({ ...recipe, dbId: undefined }));
  await ensureChemicalSeed();
  await ensureAdditionalChemicalSeeds();
  const rows = await db.select().from(chemicalRecipes).where(eq(chemicalRecipes.active, 1)).orderBy(asc(chemicalRecipes.id));
  return rows.map(toChemicalRecipe);
}

export async function createChemicalRecipe(input: ChemicalRecipeInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(chemicalRecipes).values({
    slug: slugifyChemicalName(input.name),
    name: input.name,
    groupName: input.group,
    baseVolume: String(input.baseVolume),
    baseUnit: input.baseUnit,
    stock: input.stock,
    note: input.note || null,
    ingredients: input.ingredients,
    method: input.method,
    status: "Bản nháp",
    active: 1,
  });
}

export async function getChemicalRecipeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(chemicalRecipes).where(eq(chemicalRecipes.id, id)).limit(1);
  return rows[0];
}

export async function updateChemicalRecipe(id: number, input: ChemicalRecipeInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const target = await db.select({ id: chemicalRecipes.id }).from(chemicalRecipes).where(eq(chemicalRecipes.id, id)).limit(1);
  if (!target[0]) throw new Error("Không tìm thấy cách pha hoá chất.");
  await db.update(chemicalRecipes).set({
    name: input.name,
    groupName: input.group,
    baseVolume: String(input.baseVolume),
    baseUnit: input.baseUnit,
    stock: input.stock,
    note: input.note || null,
    ingredients: input.ingredients,
    method: input.method,
  }).where(eq(chemicalRecipes.id, id));
}

export async function setChemicalRecipeStatus(id: number, status: "Bản nháp" | "Đã duyệt") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.update(chemicalRecipes).set({ status }).where(eq(chemicalRecipes.id, id));
  if (result[0].affectedRows === 0) throw new Error("Không tìm thấy cách pha hoá chất.");
}

export async function deleteChemicalRecipeById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.update(chemicalRecipes).set({ active: 0 }).where(eq(chemicalRecipes.id, id));
  if (result[0].affectedRows === 0) throw new Error("Không tìm thấy cách pha hoá chất.");
}

type ProtocolContentInput = { title: string; summary: string; owner: string; category?: "Custom" | "Hypoxia" | "HighPressure" | "ProtocolCells" | "ProtocolPCR" | "ProtocolEvaluation" | "ProtocolStaining"; steps?: { title: string; detail: string; time: string; calculatorIds?: string[] }[] };
type CalculatorContentInput = { name: string; formula: string; description: string; category?: "Chemicals" | "Cells" | "PCR" | "Custom" | "Hypoxia" | "HighPressure"; inputUnits?: Record<string, string>; outputUnit?: string; variables?: { key: string; label: string; unit: string }[] };
const isAdminEditor = (role?: string | null) => role === "admin" || role === "supporter";

export async function createProtocolDraft(input: ProtocolContentInput, approved = false) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const slug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`;
  await db.insert(protocols).values({ slug, title: input.title, category: input.category ?? "Custom", tag: input.category === "Hypoxia" ? "Hypoxia" : input.category === "HighPressure" ? "High pressure" : "New protocol", status: approved ? "Đã duyệt" : "Bản nháp", version: approved ? "v1.0" : "v0.1", owner: input.owner, summary: input.summary || "Nội dung mới được thêm vào kho Rebiomed Protocol.", duration: "Chưa cập nhật", steps: input.steps?.length ? input.steps : [{ title: "Bắt đầu biên soạn", detail: input.summary || "Thêm hướng dẫn chi tiết cho bước này.", time: "—" }], notes: approved ? [] : ["Bản nháp — cần review trước khi sử dụng trong thực nghiệm."] });
}
export async function createSampleDraft(input: { name: string; description: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const code = `NEW-${Date.now()}`;
  await db.insert(samples).values({ code, name: input.name, groupName: "Bản nháp", status: "Bản nháp", description: input.description || "Mẫu mới được thêm vào kho Rebiomed Protocol.", properties: [{ label: "Trạng thái", value: "Chưa cập nhật" }], theory: input.description || "Bổ sung lý thuyết và dữ liệu tham chiếu cho mẫu này." });
}

export async function createCalculatorDraft(input: CalculatorContentInput, approved = false) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`;
  await db.insert(calculators).values({ slug, name: input.name, category: input.category ?? "Custom", formula: input.formula, description: input.description || "Tool mới được tạo trong Rebiomed Protocol.", config: { syntax: "arithmetic", formula: input.formula, inputUnits: input.inputUnits ?? {}, outputUnit: input.outputUnit ?? "", variables: input.variables ?? [] }, status: approved ? "Đã duyệt" : "Bản nháp", active: 1 });
}
export async function updateCalculatorById(id: number, input: CalculatorContentInput, editorId?: number, editorRole?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values = { name: input.name, category: input.category ?? "Custom", formula: input.formula, description: input.description || "Tool được cập nhật trong Rebiomed Protocol.", config: { syntax: "arithmetic", formula: input.formula, inputUnits: input.inputUnits ?? {}, outputUnit: input.outputUnit ?? "", variables: input.variables ?? [] } };
  if (isAdminEditor(editorRole)) {
    try {
      await ensurePendingEditColumns(db);
    } catch (error) {
      console.warn("[Content] Approval metadata unavailable; applying Admin calculator edit directly:", error);
      await db.update(calculators).set({ ...values, status: "Đã duyệt" }).where(eq(calculators.id, id));
      return;
    }
    await db.transaction(async tx => {
      await tx.update(calculators).set({ ...values, status: "Đã duyệt" }).where(eq(calculators.id, id));
      await tx.update(calculators).set({ pendingEdit: null, pendingEditBy: null, pendingEditAt: null }).where(eq(calculators.id, id));
    });
  } else {
    await ensurePendingEditColumns(db);
    await db.update(calculators).set({ pendingEdit: values, pendingEditBy: editorId ?? null, pendingEditAt: new Date() }).where(eq(calculators.id, id));
  }
}
export async function updateProtocolDraft(id: number, input: ProtocolContentInput, editorId?: number, editorRole?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values = { title: input.title, summary: input.summary, owner: input.owner, ...(input.category ? { category: input.category } : {}), ...(input.steps ? { steps: input.steps } : {}) };
  if (isAdminEditor(editorRole)) {
    try {
      await ensurePendingEditColumns(db);
    } catch (error) {
      console.warn("[Content] Approval metadata unavailable; applying Admin protocol edit directly:", error);
      await db.update(protocols).set({ ...values, status: "Đã duyệt", version: "v1.0" }).where(eq(protocols.id, id));
      return;
    }
    await db.transaction(async tx => {
      await tx.update(protocols).set({ ...values, status: "Đã duyệt", version: "v1.0" }).where(eq(protocols.id, id));
      await tx.update(protocols).set({ pendingEdit: null, pendingEditBy: null, pendingEditAt: null }).where(eq(protocols.id, id));
    });
  } else {
    await ensurePendingEditColumns(db);
    await db.update(protocols).set({ pendingEdit: values, pendingEditBy: editorId ?? null, pendingEditAt: new Date() }).where(eq(protocols.id, id));
  }
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

export async function deleteCalculatorById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(calculators).where(eq(calculators.id, id));
}

export type PendingContentEdit = { kind: "protocol" | "calculator"; id: number; title: string; editorId: number | null; updatedAt: Date | null };
export async function listPendingContentEdits(): Promise<PendingContentEdit[]> {
  const db = await getDb();
  if (!db) return [];
  await ensurePendingEditColumns(db);
  const [protocolRows, calculatorRows] = await Promise.all([
    db.select({ id: protocols.id, title: protocols.title, pendingEditBy: protocols.pendingEditBy, pendingEditAt: protocols.pendingEditAt }).from(protocols).where(isNotNull(protocols.pendingEdit)),
    db.select({ id: calculators.id, name: calculators.name, pendingEditBy: calculators.pendingEditBy, pendingEditAt: calculators.pendingEditAt }).from(calculators).where(isNotNull(calculators.pendingEdit)),
  ]);
  return [
    ...protocolRows.map(row => ({ kind: "protocol" as const, id: row.id, title: row.title, editorId: row.pendingEditBy ?? null, updatedAt: row.pendingEditAt ?? null })),
    ...calculatorRows.map(row => ({ kind: "calculator" as const, id: row.id, title: row.name, editorId: row.pendingEditBy ?? null, updatedAt: row.pendingEditAt ?? null })),
  ];
}
export async function approvePendingContentEdit(kind: "protocol" | "calculator", id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await ensurePendingEditColumns(db);
  if (kind === "protocol") {
    const row = (await db.select().from(protocols).where(eq(protocols.id, id)).limit(1))[0];
    const pending = row?.pendingEdit && typeof row.pendingEdit === "object" ? row.pendingEdit as Record<string, unknown> : null;
    if (!row || !pending) throw new Error("Không tìm thấy bản chỉnh sửa đang chờ duyệt.");
    const result = await db.update(protocols).set({ title: typeof pending.title === "string" ? pending.title : row.title, summary: typeof pending.summary === "string" ? pending.summary : row.summary, owner: typeof pending.owner === "string" ? pending.owner : row.owner, category: typeof pending.category === "string" ? pending.category : row.category, steps: Array.isArray(pending.steps) ? pending.steps : row.steps, status: "Đã duyệt", version: "v1.0", pendingEdit: null, pendingEditBy: null, pendingEditAt: null }).where(and(eq(protocols.id, id), isNotNull(protocols.pendingEdit)));
    if (result[0].affectedRows === 0) throw new Error("Bản chỉnh sửa này đã được thay thế hoặc huỷ.");
  } else {
    const row = (await db.select().from(calculators).where(eq(calculators.id, id)).limit(1))[0];
    const pending = row?.pendingEdit && typeof row.pendingEdit === "object" ? row.pendingEdit as Record<string, unknown> : null;
    if (!row || !pending) throw new Error("Không tìm thấy bản chỉnh sửa đang chờ duyệt.");
    const result = await db.update(calculators).set({ name: typeof pending.name === "string" ? pending.name : row.name, category: typeof pending.category === "string" ? pending.category : row.category, formula: typeof pending.formula === "string" ? pending.formula : row.formula, description: typeof pending.description === "string" ? pending.description : row.description, config: pending.config && typeof pending.config === "object" ? pending.config : row.config, status: "Đã duyệt", pendingEdit: null, pendingEditBy: null, pendingEditAt: null }).where(and(eq(calculators.id, id), isNotNull(calculators.pendingEdit)));
    if (result[0].affectedRows === 0) throw new Error("Bản chỉnh sửa này đã được thay thế hoặc huỷ.");
  }
}
export async function rejectPendingContentEdit(kind: "protocol" | "calculator", id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await ensurePendingEditColumns(db);
  const table = kind === "protocol" ? protocols : calculators;
  const result = await db.update(table).set({ pendingEdit: null, pendingEditBy: null, pendingEditAt: null }).where(eq(table.id, id));
  if (result[0].affectedRows === 0) throw new Error("Không tìm thấy bản chỉnh sửa đang chờ duyệt.");
}
export async function listTeamMembers(viewerUsername?: string | null) {
  const db = await getDb();
  if (!db) return [];
  await ensureSupporterIdentity(db);
  const members = await db.select({ id: users.id, username: users.username, name: users.name, email: users.email, role: users.role, approvalStatus: users.approvalStatus, loginMethod: users.loginMethod, lastSignedIn: users.lastSignedIn }).from(users).orderBy(asc(users.id));
  return members.map(normalizeSupporterUser);
}

export async function updateUserRole(id: number, role: "admin" | "supporter" | "user") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const target = await getUserById(id);
  if (target?.username?.toLowerCase() === "wstratos" && role !== "admin") {
    throw new Error("Không thể hạ quyền của tài khoản hệ thống.");
  }
  if (isSupporterAccount(target) && role !== "supporter") throw new Error("Không thể hạ quyền của tài khoản Supporter.");
  if (role === "supporter" && !isSupporterAccount(target)) throw new Error("Quyền Supporter chỉ dành cho tài khoản được chỉ định.");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function setUserPassword(id: number, password: string, openId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ passwordHash: hashPassword(password), passwordVault: encryptPasswordForAccount(password, openId) }).where(eq(users.id, id));
}

export async function getProtocolById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select({ id: protocols.id, slug: protocols.slug, title: protocols.title, category: protocols.category, tag: protocols.tag, status: protocols.status, version: protocols.version, updatedAt: protocols.updatedAt, owner: protocols.owner, summary: protocols.summary, duration: protocols.duration, steps: protocols.steps, notes: protocols.notes }).from(protocols).where(eq(protocols.id, id)).limit(1))[0];
}

export async function getSampleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(samples).where(eq(samples.id, id)).limit(1))[0];
}

export async function getCalculatorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select({ id: calculators.id, slug: calculators.slug, name: calculators.name, category: calculators.category, formula: calculators.formula, description: calculators.description, config: calculators.config, status: calculators.status, active: calculators.active }).from(calculators).where(eq(calculators.id, id)).limit(1))[0];
}

export async function setProtocolStatus(id: number, status: "Đã duyệt" | "Bản nháp") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(protocols).set({ status }).where(eq(protocols.id, id));
}

export async function setSampleStatus(id: number, status: "Đã duyệt" | "Bản nháp") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(samples).set({ status }).where(eq(samples.id, id));
}

export async function setCalculatorStatus(id: number, status: "Đã duyệt" | "Bản nháp") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(calculators).set({ status }).where(eq(calculators.id, id));
}

export async function deleteSampleById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(samples).where(eq(samples.id, id));
}
