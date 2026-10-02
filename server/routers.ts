import { z } from "zod";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, researcherProcedure, router } from "./_core/trpc";
import { createEmailUser, createProtocolDraft, createSampleDraft, deleteProtocolById, getLabContent, getUserByEmail, listTeamMembers, updateProtocolDraft, updateSampleDraft, updateUserApproval, updateUserRole } from "./db";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    signup: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(320), password: z.string().min(8).max(128) })).mutation(async ({ input }) => {
      const email = input.email.toLowerCase();
      if (await getUserByEmail(email)) throw new Error("Email này đã được đăng ký");
      const salt = randomBytes(16).toString("hex");
      const hash = `${salt}:${scryptSync(input.password, salt, 64).toString("hex")}`;
      await createEmailUser({ email, name: input.name, passwordHash: hash });
      return { success: true, message: "Tài khoản đã tạo và đang chờ Admin duyệt." } as const;
    }),
    loginEmail: publicProcedure.input(z.object({ email: z.string().email().max(320), password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email.toLowerCase());
      if (!user?.passwordHash) throw new Error("Email hoặc mật khẩu không đúng");
      const [salt, stored] = user.passwordHash.split(":");
      const derived = scryptSync(input.password, salt, 64).toString("hex");
      if (!stored || !timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(stored, "hex"))) throw new Error("Email hoặc mật khẩu không đúng");
      if (user.approvalStatus === "pending") throw new Error("Tài khoản đang chờ Admin duyệt");
      if (user.approvalStatus === "rejected") throw new Error("Tài khoản đã bị từ chối");
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || user.email || "Lab member", expiresInMs: ONE_YEAR_MS });
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return { success: true } as const;
    }),
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
    updateApproval: adminProcedure.input(z.object({ id: z.number().int().positive(), approvalStatus: z.enum(["pending", "approved", "rejected"]) })).mutation(async ({ input }) => { await updateUserApproval(input.id, input.approvalStatus); return { success: true } as const; }),
    updateRole: adminProcedure
      .input(z.object({ id: z.number().int().positive(), role: z.enum(["admin", "researcher", "viewer"]) }))
      .mutation(async ({ input }) => {
        await updateUserRole(input.id, input.role);
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
