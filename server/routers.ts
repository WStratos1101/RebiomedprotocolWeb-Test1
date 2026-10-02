import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getFormulaVariables } from "@shared/formulaMath";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createCalculatorDraft, createProtocolDraft, createSampleDraft, deleteCalculatorById, deleteProtocolById, getLabContent, listTeamMembers, updateCalculatorById, updateProtocolDraft, updateSampleDraft, updateUserApproval, updateUserRole } from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(() => null),
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
      .mutation(async ({ input }) => {
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
      .mutation(async ({ input }) => {
        if (input.kind === "protocol") await updateProtocolDraft(input.id, { title: input.title, summary: input.body, owner: input.owner, steps: input.steps });
        else await updateSampleDraft(input.id, { name: input.title, description: input.body });
        return { success: true } as const;
      }),
    deleteProtocol: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteProtocolById(input.id);
        return { success: true } as const;
      }),
    deleteCalculator: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => { await deleteCalculatorById(input.id); return { success: true } as const; }),
  }),

  team: router({
    list: publicProcedure.query(() => listTeamMembers()),
    updateApproval: publicProcedure.input(z.object({ id: z.number().int().positive(), approvalStatus: z.enum(["pending", "approved", "rejected"]) })).mutation(async ({ input }) => { await updateUserApproval(input.id, input.approvalStatus); return { success: true } as const; }),
    updateRole: publicProcedure
      .input(z.object({ id: z.number().int().positive(), role: z.enum(["admin", "researcher", "viewer"]) }))
      .mutation(async ({ input }) => {
        await updateUserRole(input.id, input.role);
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
