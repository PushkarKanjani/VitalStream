# ── VitalStream Frontend Production Dockerfile ────────────────────────
# Multi-stage build: Node 20 builder + Nginx Alpine runtime

# Stage 1: Build static distribution bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Build Vite production bundle
COPY . .
RUN npm run build


# Stage 2: Serve optimized static assets with Nginx
FROM nginx:1.25-alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built distribution from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

# Built-in healthcheck
HEALTHCHECK --interval=20s --timeout=3s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/nginx-health || exit 1

CMD ["nginx", "-g", "daemon off;"]
