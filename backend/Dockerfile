FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
# use npm install since `npm ci` requires a package-lock.json which may not be present
RUN npm install --only=production
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]
