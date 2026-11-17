# ---------- 1. Build the React front end ----------
FROM node:22-alpine AS web
# Coolify may pass NODE_ENV=production as a build arg; the front-end build still needs its dev tools.
ENV NODE_ENV=development
WORKDIR /web
COPY app/package.json app/package-lock.json app/.npmrc ./
RUN npm ci --include=dev --no-audit --no-fund
COPY app/ ./
# Install with dev tools, but build in production mode (optimised React, service worker on).
RUN NODE_ENV=production npm run build

# ---------- 2. API server + static files ----------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/public \
    UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=web /web/dist ./public
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
EXPOSE 3000
VOLUME ["/data/uploads"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "src/index.js"]
