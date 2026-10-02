import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getFormulaVariables } from "@shared/formulaMath";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { verifyPassword } from "./_core/password";
import { decryptPasswordForAccount } from "./_core/passwordVault";
import { createCalculatorDraft, createEmailUser, createProtocolDraft, createSampleDraft, deleteCalculatorById, deleteProtocolById, deleteSampleById, deleteUserById, getCalculatorById, getLabContent, getProtocolById, getSampleById, getUserById, getUserByUsernameOrEmail, listTeamMembers, setCalculatorStatus, setProtocolStatus, setSampleStatus, setUserPassword, updateCalculatorById, updateProtocolDraft, updateSampleDraft, updateUserApproval, updateUserRole } from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ONE_YEAR_MS } from "@shared/const";
import { sdk } from "./_core/sdk";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user ? { id: ctx.user.id, username: ctx.user.username, name: ctx.user.name, email: ctx.user.email, role: ctx.user.role === "admin" ? "admin" as const : "user" as const, approvalStatus: ctx.user.approvalStatus } : null),
    adminLogin: publicProcedure.input(z.object({ identifier: z.string().trim().min(1).max(320), password: z.string().min(1).max(200) })).mutation(async ({ input, ctx }) => {
      const user = await getUserByUsernameOrEmail(input.identifier);
      if (!user || user.role !== "admin" || user.approvalStatus !== "approved" || !verifyPassword(input.password, user.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Tên đăng nhập hoặc mật khẩu admin không đúng." });
      const token = await sdk.createSessionToken(user.openId, { name: user.name ?? user.username ?? "Admin" });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return { id: user.id, username: user.username, name: user.name, email: user.email, role: "admin" as const };
    }),
    register: publicProcedure.input(z.object({ username: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9_.-]+$/), name: z.string().trim().min(1).max(160), email: z.string().trim().email().max(320), password: z.string().min(8).max(200) })).mutation(async ({ input }) => {
      if (!process.env.REBIOMED_PASSWORD_VAULT_KEY) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Chức năng đăng ký đang được cấu hình." });
      try { await createEmailUser(input); } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Username hoặc email đã tồn tại." });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Không thể tạo tài khoản lúc này." });
      }
      return { success: true as const, message: "Tài khoản đã được đăng ký với quyền User." };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  content: router({
    all: publicProcedure.query(() => getLabContent()),
    createDraft: publicProcedure
      .input(z.object({ kind: z.enum(["protocol", "sample"]), title: z.string().trim().min(1).max(255), body: z.string().max(10000).default(""), owner: z.string().trim().min(1).max(160).default("Lab editor"), category: z.enum(["Custom", "Hypoxia", "HighPressure"]).default("Custom"), steps: z.array(z.object({ title: z.string().trim().min(1).max(255), detail: z.string().max(5000), time: z.string().max(80) })).optional() }))
      .mutation(async ({ input }) => {
        if (input.kind === "protocol") await createProtocolDraft({ title: input.title, summary: input.body, owner: input.owner, category: input.category, steps: input.steps });
        else await createSampleDraft({ name: input.title, description: input.body });
        return { success: true } as const;
      }),
    createCalculator: publicProcedure
      .input(z.object({ name: z.string().trim().min(1).max(160), formula: z.string().trim().min(1).max(160), description: z.string().max(10000).default(""), category: z.enum(["Custom", "Hypoxia", "HighPressure"]).default("Custom"), inputUnits: z.record(z.string(), z.string().max(32)).default({}), outputUnit: z.string().max(32).default(""), variables: z.array(z.object({ key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), label: z.string().trim().min(1).max(120), unit: z.string().max(32) })).max(8).default([]) }))
      .mutation(async ({ input }) => {
        try {
          const variables = getFormulaVariables(input.formula);
          if (variables.length === 0 || variables.length > 8) throw new Error("Công thức cần từ 1 đến 8 biến.");
          if (Object.keys(input.inputUnits).some(variable => !variables.includes(variable))) throw new Error("Đơn vị đầu vào không khớp với biến trong công thức.");
          if (input.variables.length !== variables.length || input.variables.some(item => !variables.includes(item.key)) || new Set(input.variables.map(item => item.key)).size !== input.variables.length) throw new Error("Các mục phải khớp với biến được dùng trong phương trình và không được trùng mã.");
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Công thức không hợp lệ." });
        }
        await createCalculatorDraft(input);
        return { success: true } as const;
      }),
    updateCalculator: publicProcedure
      .input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(160), formula: z.string().trim().min(1).max(160), description: z.string().max(10000).default(""), inputUnits: z.record(z.string(), z.string().max(32)).default({}), outputUnit: z.string().max(32).default(""), variables: z.array(z.object({ key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), label: z.string().trim().min(1).max(120), unit: z.string().max(32) })).max(8).default([]) }))
      .mutation(async ({ input, ctx }) => {
        const current = await getCalculatorById(input.id);
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy công cụ." });
        if (current.status !== "Bản nháp" && ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ Admin được sửa công cụ đã duyệt." });
        try {
          const variables = getFormulaVariables(input.formula);
          if (variables.length > 8) throw new Error("Công thức cần tối đa 8 biến.");
          if (Object.keys(input.inputUnits).some(variable => !variables.includes(variable))) throw new Error("Đơn vị đầu vào không khớp với biến trong công thức.");
          if (input.variables.length && (input.variables.length !== variables.length || input.variables.some(item => !variables.includes(item.key)) || new Set(input.variables.map(item => item.key)).size !== input.variables.length)) throw new Error("Các mục phải khớp với biến được dùng trong phương trình và không được trùng mã.");
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Công thức không hợp lệ." });
        }
        await updateCalculatorById(input.id, input);
        return { success: true } as const;
      }),
    updateDraft: publicProcedure
      .input(z.object({ id: z.number().int().positive(), kind: z.enum(["protocol", "sample"]), title: z.string().trim().min(1).max(255), body: z.string().max(10000).default(""), owner: z.string().trim().min(1).max(160).default("Lab editor"), steps: z.array(z.object({ title: z.string().trim().min(1).max(255), detail: z.string().max(5000), time: z.string().max(80) })).optional() }))
      .mutation(async ({ input, ctx }) => {
        if (input.kind === "protocol") {
          const current = await getProtocolById(input.id);
          if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy quy trình." });
          if (current.status === "Đã duyệt" && ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ Admin được sửa bản đã duyệt." });
          await updateProtocolDraft(input.id, { title: input.title, summary: input.body, owner: input.owner, steps: input.steps });
        }
        else {
          const current = await getSampleById(input.id);
          if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy mục lý thuyết." });
          if (current.status !== "Bản nháp" && ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ Admin được sửa mục đã duyệt." });
          await updateSampleDraft(input.id, { name: input.title, description: input.body });
        }
        return { success: true } as const;
      }),
    deleteProtocol: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const current = await getProtocolById(input.id);
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy quy trình." });
        if (current.status === "Đã duyệt" && ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ Admin được xoá bản đã duyệt." });
        await deleteProtocolById(input.id);
        return { success: true } as const;
      }),
    deleteSample: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const current = await getSampleById(input.id);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy mục lý thuyết." });
      if (current.status !== "Bản nháp" && ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ Admin được xoá mục đã duyệt." });
      await deleteSampleById(input.id);
      return { success: true as const };
    }),
    deleteCalculator: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => { const current = await getCalculatorById(input.id); if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy công cụ." }); if (current.status !== "Bản nháp" && ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ Admin được xoá công cụ đã duyệt." }); await deleteCalculatorById(input.id); return { success: true } as const; }),
    approveProtocol: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => { await setProtocolStatus(input.id, "Đã duyệt"); return { success: true as const }; }),
    approveSample: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => { await setSampleStatus(input.id, "Đã duyệt"); return { success: true as const }; }),
    approveCalculator: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => { await setCalculatorStatus(input.id, "Đã duyệt"); return { success: true as const }; }),
  }),

  team: router({
    list: adminProcedure.query(() => listTeamMembers()),
    viewPassword: adminProcedure.input(z.object({ id: z.number().int().positive(), currentPassword: z.string().min(1).max(200) })).mutation(async ({ input, ctx }) => {
      ctx.res.setHeader("Cache-Control", "private, no-store");
      const target = await getUserById(input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản." });
      if (target.role === "admin" && target.id !== ctx.user.id && ctx.user.username?.toLowerCase() !== "wstratos") {
        console.warn("[PasswordView] denied", { actorId: ctx.user.id, targetId: target.id });
        throw new TRPCError({ code: "FORBIDDEN", message: "Không có quyền xem mật khẩu của tài khoản này." });
      }
      if (!verifyPassword(input.currentPassword, ctx.user.passwordHash)) {
        console.warn("[PasswordView] failed re-authentication", { actorId: ctx.user.id, targetId: target.id });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Mật khẩu Admin không đúng." });
      }
      if (!target.passwordVault) return { available: false as const, password: null };
      try {
        const password = decryptPasswordForAccount(target.passwordVault, target.openId);
        console.info("[PasswordView] revealed", { actorId: ctx.user.id, targetId: target.id });
        return { available: true as const, password };
      } catch {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Không thể đọc mật khẩu lúc này." });
      }
    }),
    updateApproval: adminProcedure.input(z.object({ id: z.number().int().positive(), approvalStatus: z.enum(["pending", "approved", "rejected"]) })).mutation(async ({ input }) => {
      const target = await getUserById(input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản." });
      try {
        await updateUserApproval(input.id, input.approvalStatus);
      } catch (error) {
        throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Không thể thay đổi trạng thái tài khoản." });
      }
      return { success: true } as const;
    }),
    revokeAccess: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const target = await getUserById(input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản." });
      if (target.role === "admin" || target.username?.toLowerCase() === "wstratos") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ có thể thu hồi quyền truy cập của tài khoản User." });
      }
      await updateUserApproval(input.id, "rejected");
      return { success: true } as const;
    }),
    deleteUser: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const target = await getUserById(input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản." });
      if (target.role === "admin" || target.username?.toLowerCase() === "wstratos") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ có thể xoá tài khoản User; tài khoản Admin được bảo vệ." });
      }
      await deleteUserById(input.id);
      return { success: true } as const;
    }),
    resetPassword: adminProcedure.input(z.object({ id: z.number().int().positive(), password: z.string().min(8).max(200) })).mutation(async ({ input, ctx }) => {
      const target = await getUserById(input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản." });
      if (target.role === "admin" && ctx.user.username?.toLowerCase() !== "wstratos") throw new TRPCError({ code: "FORBIDDEN", message: "Không có quyền thực hiện thao tác này." });
      if (target.loginMethod !== "email") throw new TRPCError({ code: "BAD_REQUEST", message: "Tài khoản này không đăng nhập bằng mật khẩu." });
      if (!process.env.REBIOMED_PASSWORD_VAULT_KEY) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Chức năng mật khẩu đang được cấu hình." });
      await setUserPassword(input.id, input.password, target.openId);
      return { success: true } as const;
    }),
    updateRole: adminProcedure
      .input(z.object({ id: z.number().int().positive(), role: z.enum(["admin", "user"]) }))
      .mutation(async ({ input, ctx }) => {
        const target = await getUserById(input.id);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy tài khoản." });
        if (input.id === ctx.user.id && input.role !== "admin") throw new TRPCError({ code: "BAD_REQUEST", message: "Không thể tự hạ quyền tài khoản admin đang đăng nhập." });
        if (target.username?.toLowerCase() === "wstratos" && input.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Không thể hạ quyền của tài khoản hệ thống." });
        try {
          await updateUserRole(input.id, input.role);
        } catch (error) {
          throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Không thể thay đổi quyền tài khoản." });
        }
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
