FROM node:20-alpine AS builder

WORKDIR /workspace

# Allow build-time API URL passing
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Install dependencies for app
COPY app/package*.json ./app/
RUN cd app && npm ci

# Install dependencies for enterprise-portal
COPY enterprise-portal/package*.json ./enterprise-portal/
RUN cd enterprise-portal && npm ci

# Copy source code
COPY app ./app
COPY enterprise-portal ./enterprise-portal

# Build both applications
RUN cd app && npm run build
RUN cd enterprise-portal && npm run build

# Merge Enterprise Portal into App's public path (/portal)
RUN mkdir -p app/dist/portal && cp -r enterprise-portal/dist/* app/dist/portal/

# --- Stage 2: Serve with Nginx ---
FROM nginx:alpine

# Copy built assets from builder to nginx default web directory
COPY --from=builder /workspace/app/dist /usr/share/nginx/html

# Replace default config with our custom Cloud Run / History Mode config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
