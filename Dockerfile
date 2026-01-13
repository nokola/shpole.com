# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ 

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for building)
RUN npm ci

# Copy source code
COPY . .

# Build SvelteKit app
RUN npm run build

# Compile server TypeScript to JavaScript
RUN npx tsc --project tsconfig.server.json

# Copy non-TS assets that tsc doesn't copy
RUN cp server/db/shpole_schema.sql dist/server/db/

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Rebuild better-sqlite3 for this platform
RUN npm rebuild better-sqlite3

# Copy built SvelteKit app
COPY --from=builder /app/build ./build

# Copy compiled server files (dist contains server/ subfolder and server.js)
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite
RUN mkdir -p /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

# Expose port
EXPOSE 8080

# Health check  
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start the production server
CMD ["npm", "start"]
