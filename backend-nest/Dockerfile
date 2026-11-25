# AlchemyX ERP API image. Build from this folder:  docker build -t alchemyx-erp-api .

# 1. Install all dependencies and compile TypeScript.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# 2. Runtime: compiled code, production dependencies and the SQL migrations.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S erp && adduser -S -G erp -u 10001 erp
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY migrations ./migrations
USER erp
# Database and admin settings come from environment variables (see .env.example).
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/main.js"]
