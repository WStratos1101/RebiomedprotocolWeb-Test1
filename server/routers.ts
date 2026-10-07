import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getFormulaVariables } from "@shared/formulaMath";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { verifyPassword } from "./_core/password";
import { decryptPasswordForAccount } from "./_core/passwordVault";
import { createCalculatorDraft, createChemicalRecipe, createEmailUser, createProtocolDraft, createSampleDraft, deleteCalculatorById, deleteChemicalRecipeById, deleteProtocolById, deleteSampleById, deleteUserById, getCalculatorById, getChemicalRecipeById, getLabContent, getProtocolById, getSampleById, getUserByEmail, getUserById, getUserByUsernameOrEmail, listChemicalRecipes, listTeamMembers, setCalculatorStatus, setChemicalRecipeStatus, setProtocolStatus, setSampleStatus, setUserPassword, updateCalculatorById, updateChemicalRecipe, updateProtocolDraft, updateSampleDraft, updateUserApproval, updateUserProfile, updateUserRole } from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ONE_YEAR_MS } from "@shared/const";
import { sdk } from "./_core/sdk";
import { createExperimentLog, createFeedback, deleteExperimentLog, deleteExperimentLogs, deleteFeedback, listAdminFeedbacks, listExperimentLogs, listMyFeedbacks, resolveFeedback, updateExperimentLog } from "./db";

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
    userLogin: publicProcedure.input(z.object({ identifier: z.string().trim().min(1).max(320), password: z.string().min(1).max(200) })).mutation(async ({ input, ctx }) => {
      const user = await getUserByUsernameOrEmail(input.identifier);
      if (!user || user.role === "admin" || user.approvalStatus !== "approved" || !verifyPassword(input.password, user.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Tài khoản chưa được duyệt hoặc thông tin đăng nhập không đúng." });
      const token = await sdk.createSessionToken(user.openId, { name: user.name ?? user.username ?? "User" });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return { id: user.id, username: user.username, name: user.name, email: user.email, role: "user" as const };
    }),
    register: publicProcedure.input(z.object({ username: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9_.-]+$/), name: z.string().trim().min(1).max(160), email: z.string().trim().email().max(320), password: z.string().min(8).max(200) })).mutation(async ({ input }) => {
      if (!process.env.REBIOMED_PASSWORD_VAULT_KEY) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Chức năng đăng ký đang được cấu hình." });
      try { await createEmailUser(input); } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Username hoặc email đã tồn tại." });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Không thể tạo tài khoản lúc này." });
      }
      return { success: true as const, message: "Tài khoản đã được đăng ký với quyền User." };
    }),
    updateProfile: publicProcedure.input(z.object({ email: z.string().trim().email().max(320), currentPassword: z.string().min(1).max(200), newPassword: z.string().min(8).max(200).optional() })).mutation(async ({ input, ctx }) => {
      if (!ctx.user || ctx.user.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ User mới có thể chỉnh sửa hồ sơ ở mục này." });
      if (!verifyPassword(input.currentPassword, ctx.user.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Mật khẩu hiện tại không đúng." });
      const normalizedEmail = input.email.toLowerCase();
      const duplicate = await getUserByEmail(normalizedEmail);
      if (duplicate && duplicate.id !== ctx.user.id) throw new TRPCError({ code: "CONFLICT", message: "Email này đã được sử dụng." });
      await updateUserProfile(ctx.user.id, { email: normalizedEmail, password: input.newPassword });
      return { success: true as const, email: normalizedEmail };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  experimentLogs: router({
    list: protectedProcedure.query(({ ctx }) => listExperimentLogs(ctx.user.id)),
    create: protectedProcedure.input(z.object({
      templateName: z.string().trim().max(160).default(""),
      experimentName: z.string().trim().max(255).default(""),
      cellType: z.string().trim().max(255).default(""),
      chemicalsUsed: z.string().max(10000).default(""),
      cultureConditions: z.string().max(10000).default(""),
      startTime: z.string().max(32).default(""),
      endTime: z.string().max(32).default(""),
      result: z.string().max(10000).default(""),
      workDate: z.string().trim().max(20).default(""),
      workDone: z.string().trim().max(10000).default(""),
      protocol: z.string().trim().max(5000).default(""),
      cellsSeeded: z.string().trim().max(255).default(""),
      note: z.string().max(10000).default(""),
      numericNote: z.string().max(10000).default(""),
      issue: z.string().max(10000).default(""),
    })).mutation(async ({ input, ctx }) => {
      await createExperimentLog({ ...input, ownerId: ctx.user.id });
      return { success: true as const };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      templateName: z.string().trim().max(160).default(""),
      experimentName: z.string().trim().max(255).default(""),
      cellType: z.string().trim().max(255).default(""),
      chemicalsUsed: z.string().max(10000).default(""),
      cultureConditions: z.string().max(10000).default(""),
      startTime: z.string().max(32).default(""),
      endTime: z.string().max(32).default(""),
      result: z.string().max(10000).default(""),
      workDate: z.string().trim().max(20).default(""),
      workDone: z.string().trim().max(10000).default(""),
      protocol: z.string().trim().max(5000).default(""),
      cellsSeeded: z.string().trim().max(255).default(""),
      note: z.string().max(10000).default(""),
      numericNote: z.string().max(10000).default(""),
      issue: z.string().max(10000).default(""),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...values } = input;
      await updateExperimentLog(id, ctx.user.id, values);
      return { success: true as const };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      await deleteExperimentLog(input.id, ctx.user.id);
      return { success: true as const };
    }),
    deleteMany: protectedProcedure.input(z.object({ ids: z.array(z.number().int().positive()).max(500).optional() })).mutation(async ({ input, ctx }) => {
      await deleteExperimentLogs(input.ids, ctx.user.id);
      return { success: true as const };
    }),
  }),
  feedbacks: router({
    mine: protectedProcedure.query(({ ctx }) => listMyFeedbacks(ctx.user.id)),
    create: protectedProcedure.input(z.object({
      category: z.enum(["chemical", "equipment", "supplies"]),
      itemName: z.string().trim().min(1).max(255),
      condition: z.string().trim().min(1).max(80),
      remainingAmount: z.string().trim().max(100).optional(),
      remainingUnit: z.enum(["µL", "mL", "L", "mg", "g"]).optional(),
      usageCategory: z.string().trim().max(255).optional(),
      description: z.string().trim().max(10000).optional(),
    })).mutation(async ({ input, ctx }) => {
      if (input.category === "chemical" && !["Hết hoàn toàn", "Sắp hết"].includes(input.condition)) throw new TRPCError({ code: "BAD_REQUEST", message: "Trạng thái hoá chất không hợp lệ." });
      if (input.category === "chemical" && input.condition === "Sắp hết" && (!input.remainingAmount || !input.remainingUnit)) throw new TRPCError({ code: "BAD_REQUEST", message: "Vui lòng nhập lượng hoá chất còn lại và đơn vị." });
      if (input.category === "equipment" && !["Không hoạt động", "Lỗi hoạt động"].includes(input.condition)) throw new TRPCError({ code: "BAD_REQUEST", message: "Trạng thái thiết bị không hợp lệ." });
      if (input.category === "equipment" && !input.description) throw new TRPCError({ code: "BAD_REQUEST", message: "Vui lòng nhập miêu tả nhanh cho thiết bị." });
      if (input.category === "supplies" && (input.condition !== "Hết" || !input.usageCategory)) throw new TRPCError({ code: "BAD_REQUEST", message: "Vui lòng nhập phân loại sử dụng cho vật tư." });
      await createFeedback({ ...input, reporterId: ctx.user.id });
      return { success: true as const };
    }),
    deleteMine: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      await deleteFeedback(input.id, ctx.user.id);
      return { success: true as const };
    }),
    adminList: adminProcedure.query(() => listAdminFeedbacks()),
    resolve: adminProcedure.input(z.object({ id: z.number().int().positive(), handledById: z.number().int().positive() })).mutation(async ({ input }) => {
      const handler = await getUserById(input.handledById);
      if (!handler || handler.role !== "admin" || handler.approvalStatus !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "Admin xử lý không hợp lệ." });
      try {
        await resolveFeedback(input.id, input.handledById);
      } catch (error) {
        throw new TRPCError({ code: "CONFLICT", message: error instanceof Error ? error.message : "Phản ánh đã được xác nhận trước đó." });
      }
      return { success: true as const };
    }),
  }),
  content: router({
    all: publicProcedure.query(() => getLabContent()),
    createDraft: publicProcedure
      .input(z.object({ kind: z.enum(["protocol", "sample"]), title: z.string().trim().min(1).max(255), body: z.string().max(10000).default(""), owner: z.string().trim().min(1).max(160).default("Lab editor"), category: z.enum(["Custom", "Hypoxia", "HighPressure", "ProtocolCells", "ProtocolPCR", "ProtocolEvaluation", "ProtocolStaining"]).default("Custom"), steps: z.array(z.object({ title: z.string().trim().min(1).max(255), detail: z.string().max(5000), time: z.string().max(80), calculatorIds: z.array(z.string().max(120)).max(3).default([]) })).optional() }))
      .mutation(async ({ input }) => {
        if (input.kind === "protocol") await createProtocolDraft({ title: input.title, summary: input.body, owner: input.owner, category: input.category, steps: input.steps });
        else await createSampleDraft({ name: input.title, description: input.body });
        return { success: true } as const;
      }),
    createCalculator: publicProcedure
      .input(z.object({ name: z.string().trim().min(1).max(160), formula: z.string().trim().min(1).max(160), description: z.string().max(10000).default(""), category: z.enum(["Chemicals", "Cells", "PCR", "Custom", "Hypoxia", "HighPressure"]).default("Custom"), inputUnits: z.record(z.string(), z.string().max(32)).default({}), outputUnit: z.string().max(32).default(""), variables: z.array(z.object({ key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), label: z.string().trim().min(1).max(120), unit: z.string().max(32) })).max(8).default([]) }))
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
      .input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(160), formula: z.string().trim().min(1).max(160), description: z.string().max(10000).default(""), category: z.enum(["Chemicals", "Cells", "PCR", "Custom", "Hypoxia", "HighPressure"]).default("Custom"), inputUnits: z.record(z.string(), z.string().max(32)).default({}), outputUnit: z.string().max(32).default(""), variables: z.array(z.object({ key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), label: z.string().trim().min(1).max(120), unit: z.string().max(32) })).max(8).default([]) }))
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
      .input(z.object({ id: z.number().int().positive(), kind: z.enum(["protocol", "sample"]), title: z.string().trim().min(1).max(255), body: z.string().max(10000).default(""), owner: z.string().trim().min(1).max(160).default("Lab editor"), category: z.enum(["Custom", "Hypoxia", "HighPressure", "ProtocolCells", "ProtocolPCR", "ProtocolEvaluation", "ProtocolStaining"]).default("Custom"), steps: z.array(z.object({ title: z.string().trim().min(1).max(255), detail: z.string().max(5000), time: z.string().max(80), calculatorIds: z.array(z.string().max(120)).max(3).default([]) })).optional() }))
      .mutation(async ({ input, ctx }) => {
        if (input.kind === "protocol") {
          const current = await getProtocolById(input.id);
          if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy quy trình." });
          if (current.status === "Đã duyệt" && ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ Admin được sửa bản đã duyệt." });
          await updateProtocolDraft(input.id, { title: input.title, summary: input.body, owner: input.owner, category: input.category, steps: input.steps });
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

  chemicals: router({
    list: publicProcedure.query(() => listChemicalRecipes()),
    create: publicProcedure.input(z.object({
      name: z.string().trim().min(1).max(255),
      group: z.string().trim().min(1).max(120),
      baseVolume: z.number().positive(),
      baseUnit: z.enum(["L", "mL", "µL"]),
      stock: z.string().max(255).default(""),
      note: z.string().max(5000).default(""),
      ingredients: z.array(z.object({ name: z.string().trim().min(1).max(255), quantity: z.number().nonnegative().optional(), unit: z.string().max(32).optional(), stockValue: z.number().nonnegative().optional(), stockUnit: z.string().max(32).optional(), form: z.string().trim().min(1).max(64), note: z.string().max(1000).optional(), finalTopUp: z.boolean().optional() })).min(1).max(100),
      method: z.string().trim().min(1).max(20000),
    })).mutation(async ({ input }) => { await createChemicalRecipe(input); return { success: true as const }; }),
    update: publicProcedure.input(z.object({
      id: z.number().int().positive(),
      name: z.string().trim().min(1).max(255),
      group: z.string().trim().min(1).max(120),
      baseVolume: z.number().positive(),
      baseUnit: z.enum(["L", "mL", "µL"]),
      stock: z.string().max(255).default(""),
      note: z.string().max(5000).default(""),
      ingredients: z.array(z.object({ name: z.string().trim().min(1).max(255), quantity: z.number().nonnegative().optional(), unit: z.string().max(32).optional(), stockValue: z.number().nonnegative().optional(), stockUnit: z.string().max(32).optional(), form: z.string().trim().min(1).max(64), note: z.string().max(1000).optional(), finalTopUp: z.boolean().optional() })).min(1).max(100),
      method: z.string().trim().min(1).max(20000),
    })).mutation(async ({ input, ctx }) => { const current = await getChemicalRecipeById(input.id); if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy cách pha hoá chất." }); if (current.status !== "Bản nháp" && ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ Admin được chỉnh sửa cách pha đã duyệt." }); const { id, ...recipe } = input; await updateChemicalRecipe(id, recipe); return { success: true as const }; }),
    delete: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => { const current = await getChemicalRecipeById(input.id); if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy cách pha hoá chất." }); if (current.status !== "Bản nháp" && ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ Admin được xoá cách pha đã duyệt." }); await deleteChemicalRecipeById(input.id); return { success: true as const }; }),
    approve: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => { await setChemicalRecipeStatus(input.id, "Đã duyệt"); return { success: true as const }; }),
  }),

  team: router({
    list: adminProcedure.query(({ ctx }) => listTeamMembers(ctx.user.username)),
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
