FROM golang:1.27.3-alpine@sha256:d200d2dd76b03a99b52651fd1325aff7dcd35422c35c01bac56571b0507f3deb AS build
ENV GOTOOLCHAIN=local CGO_ENABLED=0 GOMEMLIMIT=768MiB
WORKDIR /src
RUN apk add --no-cache patch
COPY tools/security/caddy/go.mod tools/security/caddy/go.sum ./
RUN go mod download
COPY tools/security/caddy/ ./
RUN sh prepare-jose.sh \
    && go test -p 2 -mod=vendor github.com/go-jose/go-jose/v3/... \
    && go build -mod=vendor -p 2 -trimpath -o /caddy .

FROM alpine:3.24@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a AS runtime
RUN apk upgrade --no-cache && apk add --no-cache ca-certificates tzdata \
    && mkdir -p /config/caddy /data/caddy /etc/caddy /srv
ENV XDG_CONFIG_HOME=/config XDG_DATA_HOME=/data
COPY --from=build /caddy /usr/bin/caddy
WORKDIR /srv
VOLUME /data /config
EXPOSE 80 443 443/udp 2019
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
