import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getProtocolById: vi.fn(),
  updateProtocolDraft: vi.fn(),
  listPendingContentEdits: vi.fn(),
  approvePendingContentEdit: vi.fn(),
  rejectPendingContentEdit: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { appRouter } from "./routers";

const approvedProtocol = {
  id: 41,
  slug: "validated-protocol",
  title: "Quy trình đã duyệt",
  category: "ProtocolCells",
  tag: "Cell culture",
  status: "Đã duyệt",
  version: "v1.0",
  owner: "Lab owner",
  summary: "Nội dung gốc không được ghi đè trước khi Admin duyệt.",
  duration: "30 phút",
  steps: [{ title: "Bước gốc", detail: "Giữ nguyên", time: "5 phút" }],
  notes: [],
};

const editInput = {
  id: 41,
  kind: "protocol" as const,
  title: "Quy trình do User đề xuất chỉnh sửa",
  body: "Nội dung chỉnh sửa đang chờ duyệt.",
  owner: "Research User",
  category: "ProtocolPCR" as const,
  steps: [{ title: "Bước mới", detail: "Chỉ có hiệu lực sau khi duyệt.", time: "10 phút", calculatorIds: [] }],
};

function caller(id: number, role: "user" | "admin") {
  const ctx = {
    user: { id, username: role === "admin" ? "admin-test" : "user-test", role, approvalStatus: "approved" },
    req: {},
    res: {},
  } as unknown as TrpcContext;
  return appRouter.createCaller(ctx);
}

beforeEach(() => {
  mocks.getProtocolById.mockReset();
  mocks.updateProtocolDraft.mockReset();
  mocks.listPendingContentEdits.mockReset();
  mocks.approvePendingContentEdit.mockReset();
  mocks.rejectPendingContentEdit.mockReset();
  mocks.getProtocolById.mockResolvedValue(approvedProtocol);
  mocks.updateProtocolDraft.mockResolvedValue(undefined);
  mocks.approvePendingContentEdit.mockResolvedValue(undefined);
  mocks.rejectPendingContentEdit.mockResolvedValue(undefined);
});

describe("content protocol editing access", () => {
  it("sends a User edit of an approved protocol to the pending-review path without replacing the approved record", async () => {
    await expect(caller(101, "user").content.updateDraft(editInput)).resolves.toEqual({ success: true });

    expect(mocks.updateProtocolDraft).toHaveBeenCalledTimes(1);
    expect(mocks.updateProtocolDraft).toHaveBeenCalledWith(
      41,
      {
        title: editInput.title,
        summary: editInput.body,
        owner: editInput.owner,
        category: editInput.category,
        steps: editInput.steps,
      },
      101,
      "user",
    );
    expect(approvedProtocol.title).toBe("Quy trình đã duyệt");
    expect(approvedProtocol.steps).toEqual([{ title: "Bước gốc", detail: "Giữ nguyên", time: "5 phút" }]);
  });

  it("allows an Admin edit to apply directly to the approved protocol path", async () => {
    await expect(caller(202, "admin").content.updateDraft(editInput)).resolves.toEqual({ success: true });

    expect(mocks.updateProtocolDraft).toHaveBeenCalledTimes(1);
    expect(mocks.updateProtocolDraft).toHaveBeenCalledWith(
      41,
      {
        title: editInput.title,
        summary: editInput.body,
        owner: editInput.owner,
        category: editInput.category,
        steps: editInput.steps,
      },
      202,
      "admin",
    );
  });

  it("restricts the pending-edit queue and its approval actions to Admin sessions", async () => {
    const pending = [{ kind: "protocol" as const, id: 41, title: approvedProtocol.title, editorId: 101, updatedAt: new Date() }];
    mocks.listPendingContentEdits.mockResolvedValue(pending);

    await expect(caller(202, "admin").content.pendingEdits()).resolves.toEqual(pending);
    await expect(caller(101, "user").content.pendingEdits()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(202, "admin").content.approvePendingEdit({ kind: "protocol", id: 41 })).resolves.toEqual({ success: true });
    expect(mocks.approvePendingContentEdit).toHaveBeenCalledWith("protocol", 41);
  });
});
