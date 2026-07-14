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
COPY auth/ ./auth/
COPY database/ ./database/
COPY websocket/ ./websocket/
COPY http/ ./http/

# Compile TS code to the "dist" directory
RUN npx tsc --outDir dist

# Copy frontend source files and install dependencies
COPY frontend/ ./frontend/
RUN npm install --prefix ./frontend

# Build frontend
RUN npm run build --prefix ./frontend

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

# Copy the frontend built files
COPY --from=builder /app/frontend/dist ./frontend/dist

# Expose the relay server ports
EXPOSE 4535 4536

# Run the compiled application
CMD ["node", "main.js"]
