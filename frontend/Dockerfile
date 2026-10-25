# syntax=docker/dockerfile:1
# ------------------------------------------------------------------------------
# Production Multi-Stage Dockerfile for React + TypeScript Frontend
# Stage 1: Build static assets with Node.js
# Stage 2: Serve optimized assets via high-performance unprivileged Nginx
# ------------------------------------------------------------------------------

# --- Stage 1: Build ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies caching package.json and package-lock.json
COPY package*.json ./
RUN npm ci

# Copy source code and build production bundle
COPY . .
RUN npm run build

# --- Stage 2: Production Nginx Server ---
FROM nginx:alpine AS runner

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom reverse proxy & SPA configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Health check checking Nginx /health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
