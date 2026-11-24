# Build the Spring Boot jar, then run it on a slim JRE.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 erp
COPY --from=build /src/target/erp-backend-*.jar /app/app.jar
USER erp
ENV PORT=8080
EXPOSE 8080
# Database and admin settings come from environment variables (see .env.example). Never bake them in.
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
