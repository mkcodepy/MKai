# Dockerfile — WhatsApp service (Baileys)
FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3100
CMD ["npm", "start"]
