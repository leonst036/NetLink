# Stage 1: Build the TypeScript application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies like typescript)
RUN npm ci

# Copy tsconfig and source directories
COPY tsconfig.json ./
COPY main.ts ./
COPY httpServer.ts ./
COPY websockets/ ./websockets/


# Compile TS code to the "dist" directory
RUN npx tsc --outDir dist

# Stage 2: Clean production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install openssl in the production container for certificate auto-generation
RUN apk add --no-cache openssl

# Copy package manifests to install production dependencies
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy the compiled JavaScript files from the builder stage
COPY --from=builder /app/dist ./

# Run the compiled application
CMD ["node", "main.js"]
