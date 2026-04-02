# ─────────────────────────────────────────────
# VCD Dashboard – Frontend Dockerfile
# Stage 1: Build React app with Vite
# Stage 2: Serve with Nginx
# ─────────────────────────────────────────────

# ── Stage 1: Build ──────────────────────────
FROM node:20-alpine AS builder

LABEL maintainer="asakish55"
LABEL description="VCD Dashboard Frontend – React + Vite"

WORKDIR /app

# Copy package files first (better layer caching)
COPY package.json ./

# Install all dependencies (including devDependencies for build)
# npm install generates package-lock.json if missing; use --legacy-peer-deps for compatibility
RUN npm install --legacy-peer-deps

# Copy source files
COPY . .

# Build production bundle
RUN npm run build

# ── Stage 2: Serve ──────────────────────────
FROM nginx:1.27-alpine AS production

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf.default

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/api/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
