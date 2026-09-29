# Isolated PDF runtime

The integrated worker produces canonical `ava-book-2` candidates and an EPUB, then runs separate
validation/publication. Validated content becomes Ready only with a compatible qualified reader;
legacy `ava-book-1` canaries remain nonpublishable. See [jobs](pdf-job-checks.md),
[publication](pdf-publication-checks.md), [providers](pdf-provider-checks.md) and [imports](pdf-import-checks.md).

```sh
docker build -t ava-pdf-epub:local packages/pdf-epub
docker image inspect ava-pdf-epub:local --format '{{.Id}}'
pnpm --filter api build
# Trusted operator configuration; never accept these from a reader request:
export AVA_PDF_RUNTIME_ENABLED=1
export AVA_PDF_DOCKER_BINARY=/absolute/path/to/docker
export AVA_PDF_DOCKER_HOST=unix:///absolute/local/docker.sock
export AVA_PDF_WORKER_IMAGE=sha256:THE_EXACT_64_HEX_IMAGE_ID
export AVA_PDF_CONTRACT_PYTHON=/absolute/installed-worker/bin/python
# Supply DATABASE_URL, AVA_PDF_WORKER_TOKEN and AVA_PDF_WORKER_PRINCIPAL privately.
# Register the image identity via pdf:jobs:admin; never pass the token in argv.
# Publication also requires AVA_PDF_READER_QUALIFICATION_ID for a valid registered build.
pnpm --filter api pdf:worker once
pnpm --filter api pdf:worker serve
```

The API does not launch this operator. `once` executes one reconstruction tick and one candidate
scan; `serve` repeats serially. SIGTERM/SIGINT stop active work. The host owns DB/ledger authority;
containers receive source, frozen input and read-only lease control, without network or credentials.
Recognition has a host-side funded-dispatch boundary; ordinary imports do not enable a live route.
Authored live pilots are separately authorized. Provider accounting does not qualify OCR quality.

Defaults: one CPU, 512 MiB/no swap, 32 processes, nonroot UID10001, read-only root, no network,
dropped capabilities. CPU allows 0.25–2 and memory128 MiB–2 GiB. Noexec scratch is at most2 GiB,
counts toward memory and has no host output mount. Source≤50 MiB/500 pages; inspection≤30s.
Current reconstruction streams≤512 MiB artifacts: canonical≤20 MiB, EPUB≤256 MiB, report≤4 MiB,
resources≤200 MiB aggregate,≤1003 entries; encoded stdout≤704 MiB. Every artifact is hash-checked.
The old16 MiB legacy canary bundle is a different path. Limits are refusal bounds, not capacity proof.
Declared image/Form/mask resources require edge≤6000, pixels≤20M,≤10,000 unique objects before
extraction; inline/pattern rasters are not fully enumerated. Container limits and edge2400 rendering
remain necessary. Arbitrary paths/URLs are never an output authority.

GNU timeout bounds the whole job independently. Before extraction the supervisor observes a fresh
lease sequence within1s. Updates carry decreasing time from confirmed DB leases, TTL≤30s minus
250ms safety;100ms polling kills the process group at expiry. Monotonic deadlines need no clock sync.
Missing control-file reads retry only inside the existing deadline; malformed controls fail closed.
Late renewal cannot revive expiry. Container exit removes the container; normal cleanup removes inputs.
Startup reaps only same-UID0700 marked `ava-pdf-runtime-*` directories after job deadline+2min,
first removing that named container. An inactive operator host still needs a deployment janitor.

Ordinary generated-EPUB import uses the same sandbox through the reader processing queue, validates
EPUBCheck and exact portable content, then binds a new immutable identity. Configuration is checked
before consuming an eligible attempt. With no canonical job, disabled runtime does not block legacy
EPUB processing. `NODE_ENV=test` disables automatic reader polling; disposable tests run the normal
queue explicitly. Do not reset a terminal Failed record to repair operator configuration.

Development resource canaries require `NODE_ENV=development`, `AVA_PDF_RUNTIME_FAULT` set to
`deadline|memory|scratch|output|cpu` and `AVA_PDF_FAULT_ACK=AVA_PDF_RUNTIME_FAULTS_V1`.
Production denies them; the reconstruction coordinator rejects them before claiming. Preserve the
exact operation/fence/fault acknowledgement. Old canary evidence is not reconstruction-loop coverage.

Actual signed-in desktop native import, owned downloads and generated-EPUB reimport passed locally
under TEST qualifications; evidence is in the task workspace `output/pdf-epub-integration-13/`.
The PRODUCT reader catalog is empty. Full source accuracy, mobile/accessibility, offline/account
journeys, resource-capacity and deployment qualification remain separate; no production Ready claim.
