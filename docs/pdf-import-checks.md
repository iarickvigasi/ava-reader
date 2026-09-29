# PDF import boundary checks

PDF-05 backend slice; [ADR9](adr/9-owned-pdf-imports.md) owns the technical decisions.
Code is `apps/api/src/library/pdf-import/`, additive Prisma migrations and PDF-specific cover/GC
integration. [Durable jobs](pdf-job-checks.md) now enqueue with acceptance; the reader stays gated.

## API contract

| Route                                                         | Meaning                                                                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `POST /library/pdf-imports`                                   | Authenticated explicit initial conversion; returns accepted/existing operation, item and source identity; QUEUED is not readable. |
| `GET /library/pdf-imports/:operationId`                       | Owned live status and metadata edit version.                                                                                      |
| `PATCH /library/pdf-imports/:operationId/metadata`            | Strict title/authors/language update with expectedVersion; stale writes return 409.                                               |
| `GET /library/pdf-imports/:operationId/artifacts/:artifactId` | Owned original PDF only, attachment, private/no-store/nosniff.                                                                    |
| `GET /library/pdf-imports/:operationId/cover`                 | Owned pinned PNG/JPEG cover only, private/no-store/nosniff.                                                                       |

The application adds its usual `/api` prefix. Missing/invalid auth is 401, foreign or deleted owned
reads are 404, deleted same-request reconciliation is 410, and identity/duplicate conflicts are 409.
Explicit-intent/key/signature errors are 400; structurally invalid or unsupported inspected PDFs
return safe typed 422 codes. Oversize upload is 413; unavailable/timed-out inspection is 503.
No raw parser errors, storage paths, credentials, provider identifiers or internal prices are exposed.

Configure the [pinned isolated runtime](pdf-runtime-checks.md); admission has no host-Python fallback.
Two intake slots per API process precede multipart buffering. The fixed inspect module receives no
provider keys/network access. Admission bounds are 50 MiB, 500 pages, bounded metadata/annotations,
30 seconds and 4 MiB output, with container CPU/memory limits. Declared image-resource bounds and
remaining parser limits are documented in the runtime runbook; these are not throughput promises.

```sh
pnpm --filter api exec jest --runInBand library/pdf-import
pnpm --filter api typecheck
pnpm --filter api lint
# From packages/pdf-epub in its pinned environment:
PYTHONPATH=src python -m unittest discover -s tests -v
ruff check src/ava_pdf_epub/admission.py src/ava_pdf_epub/admission_actions.py tests/admission
mypy src/ava_pdf_epub/admission.py src/ava_pdf_epub/admission_actions.py
```

See [actual backend evidence](pdf-import-evidence.md), [migration/rollback](pdf-import-migration.md),
[AC boundaries](pdf-import-acceptance.md) and [dormant reader selection](pdf-import-selection.md).
