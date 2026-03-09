FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN apk add --no-cache libc6-compat

RUN npm rebuild

CMD ["node", "src/index.js"]
