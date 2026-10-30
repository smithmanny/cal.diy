# Multi-arch image for self-hosting (amd64, arm64, and armv7 for 32-bit Raspberry Pi OS).
#   docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 -t cal-diy .
#
# The build stage runs on the host's native platform: its output is plain JS, so there is no
# need to emulate the target CPU for the slow part. Only the runtime stage, which installs
# libSQL's native bindings, runs on the target platform.

FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS builder
WORKDIR /app
COPY . .
RUN yarn workspaces focus @calcom/web @calcom/db @calcom/scheduling \
  && yarn workspace @calcom/web build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
  PORT=3000 \
  DATABASE_URL=file:/data/cal.db \
  MIGRATIONS_DIR=/app/migrations

# Version-pinned to match packages/db and apps/web.
RUN echo '{"type":"module","private":true}' > package.json \
  && npm install --omit=dev --no-audit --no-fund @libsql/client@0.18.0 srvx@1.0.5 \
  && npm cache clean --force

COPY --from=builder /app/apps/web/dist ./dist
COPY --from=builder /app/apps/web/server.node.mjs ./server.node.mjs
COPY --from=builder /app/packages/db/migrations ./migrations

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.node.mjs"]
