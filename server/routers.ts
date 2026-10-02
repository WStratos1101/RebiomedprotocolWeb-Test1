import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, researcherProcedure, router } from "./_core/trpc";
import { createProtocolDraft, createSampleDraft, deleteProtocolById, getLabContent, listTeamMembers, updateProtocolDraft, updateSampleDraft, updateUserRole } from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  permissions: router({
    current: protectedProcedure.query(({ ctx }) => {
      const role = ctx.user.role === "admin" ? "admin" : ctx.user.role === "viewer" ? "viewer" : "researcher";
      return {
        role,
        canRead: true,
        canCalculate: role !== "viewer",
        canDraft: role === "admin" || role === "researcher",
        canManageUsers: role === "admin",
      } as const;
    }),
  }),

  content: router({
    all: protectedProcedure.query(() => getLabContent()),
    createDraft: researcherProcedure
      .input(z.object({ kind: z.enum(["protocol", "sample"]), title: z.string().trim().min(1).max(255), body: z.string().max(10000).default("") }))
      .mutation(async ({ ctx, input }) => {
        if (input.kind === "protocol") await createProtocolDraft({ title: input.title, summary: input.body, owner: ctx.user.name || ctx.user.email || "Researcher" });
        else await createSampleDraft({ name: input.title, description: input.body });
        return { success: true } as const;
      }),
    updateDraft: researcherProcedure
      .input(z.object({ id: z.number().int().positive(), kind: z.enum(["protocol", "sample"]), title: z.string().trim().min(1).max(255), body: z.string().max(10000).default("") }))
      .mutation(async ({ input }) => {
        if (input.kind === "protocol") await updateProtocolDraft(input.id, { title: input.title, summary: input.body });
        else await updateSampleDraft(input.id, { name: input.title, description: input.body });
        return { success: true } as const;
      }),
    deleteProtocol: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteProtocolById(input.id);
        return { success: true } as const;
      }),
  }),

  team: router({
    list: adminProcedure.query(() => listTeamMembers()),
    updateRole: adminProcedure
      .input(z.object({ id: z.number().int().positive(), role: z.enum(["admin", "researcher", "viewer"]) }))
      .mutation(async ({ input }) => {
        await updateUserRole(input.id, input.role);
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
