import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const isAdminLikeRole = (role: string | null | undefined) => role === "admin" || role === "supporter";

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || !isAdminLikeRole(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

const requireResearcher = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user || !["admin", "supporter", "researcher", "user"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Researcher access required" });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const researcherProcedure = t.procedure.use(requireResearcher);

const requireViewer = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user || !["admin", "supporter", "researcher", "viewer", "user"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Workspace viewer access required" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const viewerProcedure = t.procedure.use(requireViewer);
