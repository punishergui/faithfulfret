FROM node:20.19.5-alpine AS builder
WORKDIR /app

ENV NODE_ENV=development

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:manual

FROM node:20.19.5-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9999

RUN apk add --no-cache python3 make g++ libstdc++ yt-dlp

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/data-store.js ./data-store.js

EXPOSE 9999
CMD ["node", "server.js"]
