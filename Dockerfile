FROM node:22.14.0-alpine AS build
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9999

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build:manual

FROM node:22.14.0-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9999

RUN apk add --no-cache libstdc++ ffmpeg

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/data-store.js ./data-store.js

EXPOSE 9999
CMD ["node", "server.js"]
