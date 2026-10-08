FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@10.18.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN CI=1 pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM build AS migration

RUN pnpm prune --prod

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /app/package.json ./package.json
COPY --from=migration /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/index.js"]
