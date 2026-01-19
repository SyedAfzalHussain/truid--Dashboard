FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy all files
COPY . .

# Build the app
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

# Create logs directory
RUN mkdir -p /app/logs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY ecosystem.config.js ./ecosystem.config.js

EXPOSE 4444

# Run with PM2
CMD ["npx", "pm2-runtime", "start", "ecosystem.config.js"]
