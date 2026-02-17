# syntax=docker/dockerfile:1

# ---- Dev target (Vite dev server) ----
FROM node:20-alpine AS dev

WORKDIR /app

COPY package.json /app/package.json
# No lockfile yet in Phase 1; install best-effort
RUN npm install

COPY . /app

EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---- Build target ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json /app/package.json
RUN npm install

COPY . /app
RUN npm run build

# ---- Prod-like target (static via nginx) ----
FROM nginx:1.27-alpine AS prod

# SPA routing via default.conf
COPY nginx.default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
