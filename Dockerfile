FROM node:22-bookworm-slim AS build
WORKDIR /app/apps/platform
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY apps/platform/package*.json ./
RUN npm ci --no-audit --no-fund
COPY apps/platform ./
ENV VITE_HOSTING_PROVIDER=timeweb
RUN npm run build && npx tsx script/build-timeweb.ts

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/platform
COPY --from=build --chown=node:node /app/apps/platform ./
ENV NODE_ENV=production PORT=5000 SHADOW_WRITE_ENABLED=0 LK_MIGRATION_READ_ONLY=1
USER node
EXPOSE 5000
CMD ["node", "dist/timeweb/index.mjs"]
