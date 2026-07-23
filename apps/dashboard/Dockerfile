FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS installer
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/utils/package.json packages/utils/package.json
RUN pnpm install --filter @responix/dashboard... --frozen-lockfile=false

FROM installer AS builder
COPY apps/dashboard apps/dashboard
COPY packages/config packages/config
COPY packages/types packages/types
COPY packages/ui packages/ui
COPY packages/utils packages/utils
RUN pnpm --filter @responix/dashboard build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
