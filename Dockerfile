# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Root deps first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Client deps, then build the SPA into client/dist
COPY client/package.json client/package-lock.json client/
RUN cd client && npm ci
COPY client/ client/
RUN npm run build

# Server source for the runtime stage
COPY server/ server/

# Drop dev dependencies for a lean runtime image
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

EXPOSE 3001
CMD ["node", "server/index.js"]
