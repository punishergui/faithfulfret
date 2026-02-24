FROM node:20-alpine AS builder
WORKDIR /app

ENV PORT=9999

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
# Install full dependency graph in builder so future build tooling remains supported.
RUN npm ci

COPY . .
RUN npm run build:manual

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9999

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
# Runtime installs production deps only.
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/data-store.js ./data-store.js

EXPOSE 9999
CMD ["node", "server.js"]
