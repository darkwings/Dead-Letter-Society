# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

COPY . .
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
# nginx:alpine includes envsubst — processes *.template files in /etc/nginx/templates/
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template    /etc/nginx/templates/default.conf.template

# Default backend URL — override at runtime for K8s/ECS/CloudRun
ENV BACKEND_URL=http://backend:8080

EXPOSE 80
