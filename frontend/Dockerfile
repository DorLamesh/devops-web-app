FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
# use npm install because package-lock.json may be missing
RUN npm install --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
