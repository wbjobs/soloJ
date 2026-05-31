FROM node:18-alpine

WORKDIR /app

COPY ../management-api/package*.json ./
RUN npm ci --only=production

COPY ../management-api/ ./

RUN mkdir -p /models /config

EXPOSE 8082

CMD ["npm", "start"]
