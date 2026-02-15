FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build:manual
EXPOSE 9999
CMD ["node", "server.js"]
