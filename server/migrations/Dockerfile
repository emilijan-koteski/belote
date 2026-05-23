# syntax=docker/dockerfile:1.7

FROM migrate/migrate:v4.18.1
COPY . /migrations
ENTRYPOINT ["migrate", "-path", "/migrations"]
