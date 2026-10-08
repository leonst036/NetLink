# Stage 1: Build the TypeScript application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies like typescript)
RUN npm install

COPY tsconfig.json ./
COPY main.ts ./
COPY paths.ts ./
COPY auth/ ./auth/
COPY database/ ./database/
COPY websocket/ ./websocket/
COPY http/ ./http/
COPY dns/ ./dns/
COPY assets/ ./assets/
COPY NetStore/ ./NetStore/
COPY sandbox/ ./sandbox/
COPY tunnels/ ./tunnels/
COPY NetConnect/ ./NetConnect/

# Compile TS code to the "dist" directory
RUN npx tsc --outDir dist

# Copy frontend source files and install dependencies
COPY frontend/ ./frontend/
RUN npm install --prefix ./frontend

# Build frontend
RUN npm run build --prefix ./frontend

# Stage 2: Clean production runtime image
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install openssl, ca-certificates, ping and ip tools for network diagnostics
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates iputils-ping iproute2 && rm -rf /var/lib/apt/lists/*

# Install deno
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

# Copy package manifests to install production dependencies
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy the compiled JavaScript files from the builder stage
COPY --from=builder /app/dist ./

# Copy assets and NetStore
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/NetStore ./NetStore

# Copy the frontend built files
COPY --from=builder /app/frontend/dist ./frontend/dist

# Expose the relay server ports
EXPOSE 4535 53/udp 53/tcp

# Run the compiled application
CMD ["node", "main.js"]
