FROM node:25-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Decisão D3 de 2026-10-14: o processo roda sem root. Build e prisma generate acima ficam como root; o runtime só lê
# /app (o usuário node já existe na imagem oficial).
USER node

EXPOSE 3000

CMD ["npm", "run", "dev"]
