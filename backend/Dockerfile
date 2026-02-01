# Backend Dockerfile for Cloud Run
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production
RUN npm install typescript

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies and build tools
RUN npm prune --production
RUN apk del python3 make g++

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
