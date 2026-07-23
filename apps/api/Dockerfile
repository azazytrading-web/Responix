FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS installer
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/utils/package.json packages/utils/package.json
RUN pnpm install --filter @responix/api... --frozen-lockfile=false

FROM installer AS builder
COPY apps/api apps/api
COPY packages/config packages/config
COPY packages/database packages/database
COPY packages/types packages/types
COPY packages/utils packages/utils
RUN pnpm --filter @responix/api build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages ./packages
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
