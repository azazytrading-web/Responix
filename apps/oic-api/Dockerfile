FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS installer
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/oic-api/package.json apps/oic-api/package.json
COPY packages/oic-contracts/package.json packages/oic-contracts/package.json
COPY packages/oic-database/package.json packages/oic-database/package.json
RUN pnpm install --filter @oic/api... --frozen-lockfile
COPY apps/oic-api apps/oic-api
COPY packages/oic-contracts packages/oic-contracts
COPY packages/oic-database packages/oic-database
RUN pnpm --filter @oic/api build
RUN pnpm --filter @oic/database build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/oic-api/dist ./apps/oic-api/dist
COPY --from=installer /app/apps/oic-api/package.json ./apps/oic-api/package.json
COPY --from=installer /app/packages/oic-contracts ./packages/oic-contracts
COPY --from=installer /app/packages/oic-database ./packages/oic-database
WORKDIR /app/apps/oic-api
EXPOSE 4100
CMD ["node", "dist/main.js"]

FROM installer AS migrate
CMD ["pnpm", "--dir", "packages/oic-database", "exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"]
