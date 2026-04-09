# --- Stage 1: Base ---
FROM node:alpine AS base

RUN addgroup -S api-registry-pg-group && adduser -S -G api-registry-pg-group api-registry-pg-user
# # Debian-style user creation
# RUN groupadd -r api-registry-pg-group && useradd -r -g api-registry-pg-group api-registry-pg-user
WORKDIR /app
# Pre-set ownership of the workdir
RUN chown api-registry-pg-user:api-registry-pg-group /app
COPY --chown=api-registry-pg-user:api-registry-pg-group package*.json ./

# --- Stage 2: Development ---
FROM base AS development
RUN npm install --legacy-peer-deps
COPY --chown=api-registry-pg-user:api-registry-pg-group . .
# Create logs dir for dev environment
RUN mkdir -p /app/logs && chown api-registry-pg-user:api-registry-pg-group /app/logs
USER api-registry-pg-user
EXPOSE 9878
CMD ["npm", "run", "dev"]

# --- Stage 3: Build (Intermediate) ---
FROM development AS builder
# RUN npm run docker:pre-run
USER root
RUN npm run build
RUN npm prune --omit=dev --legacy-peer-deps

# --- Stage 4: Production ---
FROM base AS production
ENV NODE_ENV=production

# Copy artifacts from builder
COPY --from=builder --chown=api-registry-pg-user:api-registry-pg-group /app/node_modules ./node_modules
COPY --from=builder --chown=api-registry-pg-user:api-registry-pg-group /app/dist ./dist

# CRITICAL: Re-create and permission the logs directory in the final image
RUN mkdir -p /app/logs && chown api-registry-pg-user:api-registry-pg-group /app/logs

USER api-registry-pg-user
EXPOSE 9878

# Using 'node' directly is more memory-efficient than 'npm start'
CMD ["npm", "run","start"]