FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9999

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build:manual

EXPOSE 9999
CMD ["node", "server.js"]
