# Single image: Spring Boot serves the built React app and the API from one origin.
# Build from the repository root:  docker build -t alchemyx-erp .

# ---------------------------------------------------------------------------
# 1. Build the frontend
# ---------------------------------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /app
RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
# Same origin: the API is served by this container, so the SPA calls relative /api paths.
# Override only if you split the frontend onto its own host later.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

# ---------------------------------------------------------------------------
# 2. Build the backend jar with the frontend baked into src/main/resources/static
# ---------------------------------------------------------------------------
FROM maven:3.9-eclipse-temurin-21 AS backend
WORKDIR /src
COPY backend/pom.xml ./
RUN mvn -B -q dependency:go-offline
COPY backend/src ./src
COPY --from=frontend /app/dist ./src/main/resources/static
RUN mvn -B -DskipTests package

# ---------------------------------------------------------------------------
# 3. Runtime
# ---------------------------------------------------------------------------
FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 erp
COPY --from=backend /src/target/erp-backend-*.jar /app/app.jar
USER erp
ENV PORT=8080
EXPOSE 8080
# Database and admin settings come from environment variables (see backend/.env.example).
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
