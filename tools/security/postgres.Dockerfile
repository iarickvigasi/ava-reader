FROM postgres:16.15-alpine@sha256:0cefaabd882e42bcb2a2f3dc56d3ce4770560ba62fd7f197f1a2e008fd5731ab AS runtime
# gosu's embedded Go toolchain is obsolete; use Alpine's maintained C helper.
RUN apk upgrade --no-cache && apk add --no-cache su-exec && rm /usr/local/bin/gosu
COPY --chmod=0755 tools/security/gosu.sh /usr/local/bin/gosu
