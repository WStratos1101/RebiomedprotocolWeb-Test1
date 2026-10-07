import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const writes: Record<string, unknown>[] = [];
  const state: { row: Record<string, any> | null; affectedRows: number } = { row: null, affectedRows: 1 };
  const db: any = {};
  db.execute = vi.fn(async () => { throw new Error("Duplicate column name"); });
  db.update = vi.fn(() => ({
    set(values: Record<string, unknown>) {
      writes.push(values);
      return {
        where: vi.fn(async () => {
          if (state.affectedRows > 0 && state.row) Object.assign(state.row, values);
          return [{ affectedRows: state.affectedRows }];
        }),
      };
    },
  }));
  db.select = vi.fn(() => ({
    from: () => ({
      where: () => ({ limit: async () => state.row ? [state.row] : [] }),
    }),
  }));
  db.transaction = vi.fn(async (callback: (transaction: any) => Promise<unknown>) => callback(db));
  return { db, writes, state };
});

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: () => fake.db }));

import { approvePendingContentEdit, updateProtocolDraft } from "./db";

const input = {
  title: "Quy trình đã chỉnh sửa",
  summary: "Nội dung mới chỉ hiển thị sau khi Admin duyệt.",
  owner: "Research User",
  category: "ProtocolPCR" as const,
  steps: [{ title: "Bước mới", detail: "Nội dung mới", time: "10 phút", calculatorIds: [] }],
};

beforeEach(() => {
  process.env.DATABASE_URL = "mysql://test:test@localhost:3306/rebiomed_test";
  fake.writes.splice(0, fake.writes.length);
  fake.state.row = null;
  fake.state.affectedRows = 1;
  fake.db.update.mockClear();
  fake.db.execute.mockClear();
  fake.db.select.mockClear();
  fake.db.transaction.mockClear();
});

describe("protocol edit persistence", () => {
  it("keeps the approved record unchanged for a User edit, then applies an Admin edit atomically and clears any stale pending edit", async () => {
    await updateProtocolDraft(41, input, 101, "user");

    expect(fake.writes).toHaveLength(1);
    expect(fake.writes[0]).toMatchObject({
      pendingEdit: {
        title: input.title,
        summary: input.summary,
        owner: input.owner,
        category: input.category,
        steps: input.steps,
      },
      pendingEditBy: 101,
    });
    expect(fake.writes[0]).not.toHaveProperty("title");
    expect(fake.writes[0]).not.toHaveProperty("status");

    await updateProtocolDraft(41, input, 202, "admin");

    expect(fake.db.transaction).toHaveBeenCalledTimes(1);
    expect(fake.writes).toHaveLength(3);
    expect(fake.writes[1]).toMatchObject({
      title: input.title,
      summary: input.summary,
      owner: input.owner,
      category: input.category,
      steps: input.steps,
      status: "Đã duyệt",
      version: "v1.0",
    });
    expect(fake.writes[2]).toEqual({ pendingEdit: null, pendingEditBy: null, pendingEditAt: null });
  });

  it("applies a User pending edit only while it still exists, preventing a stale approval from overwriting a later Admin edit", async () => {
    fake.state.row = {
      id: 41,
      title: "Quy trình đã duyệt",
      summary: "Nội dung gốc",
      owner: "Lab owner",
      category: "ProtocolCells",
      steps: [],
      pendingEdit: { ...input },
      pendingEditBy: 101,
      pendingEditAt: new Date(),
    };

    await approvePendingContentEdit("protocol", 41);
    expect(fake.state.row).toMatchObject({ title: input.title, status: "Đã duyệt", pendingEdit: null });

    fake.state.row = {
      id: 41,
      title: "Thay đổi mới của Admin",
      summary: "Nội dung mới hơn",
      owner: "Admin",
      category: "ProtocolCells",
      steps: [],
      pendingEdit: { ...input },
    };
    fake.state.affectedRows = 0;

    await expect(approvePendingContentEdit("protocol", 41)).rejects.toThrow("Bản chỉnh sửa này đã được thay thế hoặc huỷ.");
    expect(fake.state.row.title).toBe("Thay đổi mới của Admin");
  });
});
