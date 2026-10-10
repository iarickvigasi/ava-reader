# Immutable multi-platform manifests; the native package snapshot is equally fixed.
FROM ghcr.io/astral-sh/uv:0.9.26@sha256:9a23023be68b2ed09750ae636228e903a54a05ea56ed03a934d00fe9fbeded4b AS uv
FROM python:3.12.14-slim-bookworm@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_PYTHON_DOWNLOADS=never UV_NO_CACHE=1
RUN printf '%s\n' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20260927T000000Z bookworm main' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20260927T000000Z bookworm-updates main' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/20260927T000000Z bookworm-security main' \
      > /etc/apt/sources.list \
    && rm /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils=22.12.0-2+deb12u3 default-jre-headless=2:1.17-74 \
      tesseract-ocr=5.3.0-2 tesseract-ocr-eng=1:4.1.0-2 tesseract-ocr-ukr=1:4.1.0-2 \
    && mkdir -p /usr/share/ava \
    && dpkg-query -W -f='${Package}\t${Version}\n' > /usr/share/ava/native-dependencies.tsv \
    && rm -rf /var/lib/apt/lists/*
COPY --from=uv /uv /usr/local/bin/uv
COPY licenses/uv-MIT.txt /usr/share/doc/uv/copyright
WORKDIR /worker
COPY pyproject.toml uv.lock README.md ./
COPY src ./src
COPY scripts/dependency_inventory.py /tmp/dependency_inventory.py
COPY scripts/fetch_epubcheck.py scripts/epubcheck-distribution.json /tmp/
RUN python /tmp/fetch_epubcheck.py /opt/epubcheck \
    && uv sync --locked --no-dev --no-editable \
    && .venv/bin/python /tmp/dependency_inventory.py --out /usr/share/ava/python-dependencies.json \
    && rm /tmp/dependency_inventory.py \
    && useradd --uid 10001 --create-home worker \
    && mkdir /data && chown worker:worker /data
ENV PATH="/worker/.venv/bin:$PATH"
USER 10001:10001
WORKDIR /data
ENTRYPOINT ["ava-pdf-epub"]
