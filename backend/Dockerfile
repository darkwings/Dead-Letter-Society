# ── Stage 1: build ───────────────────────────────────────────────────────────
# Use eclipse-temurin (JDK) + gradlew so the exact Gradle version from
# gradle-wrapper.properties is used — avoids version-mismatch issues with
# the gradle:X.Y base images.
FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /app

# Download the correct Gradle distribution first (cached layer)
COPY gradlew gradlew
COPY gradle/wrapper/ gradle/wrapper/
RUN chmod +x gradlew && ./gradlew --version

# Cache dependency resolution separately from source changes
COPY build.gradle settings.gradle* gradle.properties* ./
RUN ./gradlew dependencies --no-daemon -q 2>/dev/null || true

COPY src/ src/
RUN ./gradlew build --no-daemon -x test -q

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy AS runtime

# Non-root user (uid 185 is the Quarkus convention)
RUN groupadd -r -g 185 quarkus && useradd -r -u 185 -g quarkus quarkus

WORKDIR /deployments
COPY --chown=quarkus:quarkus --from=build /app/build/quarkus-app/lib/     lib/
COPY --chown=quarkus:quarkus --from=build /app/build/quarkus-app/*.jar    ./
COPY --chown=quarkus:quarkus --from=build /app/build/quarkus-app/app/     app/
COPY --chown=quarkus:quarkus --from=build /app/build/quarkus-app/quarkus/ quarkus/

USER quarkus

EXPOSE 8080

ENV JAVA_OPTS="-Dquarkus.http.host=0.0.0.0 \
               -Djava.util.logging.manager=org.jboss.logmanager.LogManager"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /deployments/quarkus-run.jar"]
