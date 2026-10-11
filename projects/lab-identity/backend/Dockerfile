FROM eclipse-temurin:25-jre-alpine
WORKDIR /work
COPY target/quarkus-app/ /work/
RUN addgroup -S lab && adduser -S lab -G lab && chown -R lab:lab /work
USER lab
EXPOSE 8080
ENTRYPOINT ["java","-jar","quarkus-run.jar"]
