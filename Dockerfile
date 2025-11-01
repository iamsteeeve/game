# Multi-stage build for TypeScript game with server
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY tsconfig.server.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY server/ ./server/
COPY src/ ./src/
COPY index.html ./
COPY vite.config.ts ./
COPY public/ ./public/

# Build the client with Vite
RUN npm run build

# Build the server TypeScript code
RUN npx tsc --project tsconfig.server.json

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --production

# Copy built client from builder stage
COPY --from=builder /app/dist ./dist

# Copy built server from builder stage
COPY --from=builder /app/server-dist ./server-dist

# Expose port (Cloud Run will inject PORT env var)
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Start the server
CMD ["node", "server-dist/gameServer.js"]
