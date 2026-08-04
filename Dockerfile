# syntax=docker/dockerfile:1
#
# Eigenständiges Frontend-Image (nach dem Repo-Split): baut die SPA und
# liefert sie über nginx statisch aus. Caddy vor beiden Containern routet
# `/api/*` + `/health` zum Backend-Container, alles andere hierhin.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
