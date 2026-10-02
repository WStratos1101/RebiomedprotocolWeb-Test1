import { z } from "zod";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createProtocolDraft, createSampleDraft, deleteProtocolById, getLabContent, listTeamMembers, updateProtocolDraft, updateSampleDraft, updateUserApproval, updateUserRole } from "./db";
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
      .input(z.object({ kind: z.enum(["protocol", "sample"]), title: z.string().trim().min(1).max(255), body: z.string().max(10000).default("") }))
      .mutation(async ({ input }) => {
        if (input.kind === "protocol") await createProtocolDraft({ title: input.title, summary: input.body, owner: "Lab editor" });
        else await createSampleDraft({ name: input.title, description: input.body });
        return { success: true } as const;
      }),
    updateDraft: publicProcedure
      .input(z.object({ id: z.number().int().positive(), kind: z.enum(["protocol", "sample"]), title: z.string().trim().min(1).max(255), body: z.string().max(10000).default("") }))
      .mutation(async ({ input }) => {
        if (input.kind === "protocol") await updateProtocolDraft(input.id, { title: input.title, summary: input.body });
        else await updateSampleDraft(input.id, { name: input.title, description: input.body });
        return { success: true } as const;
      }),
    deleteProtocol: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteProtocolById(input.id);
        return { success: true } as const;
      }),
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
