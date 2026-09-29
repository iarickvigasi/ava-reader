# PDF import conversion: review guide

This candidate lets a reader select **Convert to EPUB** while uploading a PDF, keeps one Library
entry with its original PDF, and exposes reading only after a validated EPUB is published. Conversion
happens once during import. Finished content is immutable; there is no later reconversion or replacement.
English prose in one or two columns is the agreed scope. Scanned/mixed books are not yet qualified.

## Review status

This is a draft integration PR, not a release approval. It includes the standalone Python worker,
API ownership/job/provider/publication boundaries and the Library/canonical reader integration.
The change is large because these layers were developed together; review in the order below.
No production provider route, reader qualification or cleanup activation is implied by merging code.

1. [Contracts](adr/7-pdf-worker-contracts.md) and [canonical content](adr/8-canonical-content-adapter.md):
   validate the versioned worker input/output and content/resource identity before following callers.
2. [Owned imports](adr/9-owned-pdf-imports.md), Prisma migrations and
   `apps/api/src/library/pdf-import`: admission, original bytes, metadata, jobs and lifecycle.
3. [Durable jobs](adr/10-durable-pdf-jobs.md) and [provider ledger](adr/11-provider-dispatch-ledger.md):
   fencing, bounded containers, reconciliation and conservative unresolved-charge reservations.
4. [First publication](adr/12-first-pdf-publication.md) and
   [ordinary EPUB import](adr/13-canonical-epub-import.md): atomic validation/publication and isolation.
5. `apps/web/features/library`, `apps/web/features/reader` and the reader components: one Library
   entry, status/formats, source styles, Contents, note links and navigation return positions.
6. Worker reconstruction/export and the regression suites: source conservation, structure, images,
   semantics and EPUB conformance are separate checks; a valid EPUB is not proof of source fidelity.

## Verification on 29 September 2026

The local implementation snapshot passed API/web typechecking and lint (one existing web warning),
1,276 web tests, 945 API tests and 228 Python worker tests. Worker Ruff and strict mypy also passed.
These are snapshot results; later integration changes require their own checks.

Normal signed-in local app checks used original authored native fixtures and an explicit **TEST**
qualification. Both one- and two-column paths reached one readable Library entry. The observed flows
included upload, background status, metadata, Ready notification, separate chapter navigation,
chapter-local/shared/cold notes, Return/Back, illustration/caption and original/EPUB downloads.
A downloaded generated EPUB also succeeded through ordinary EPUB reimport and actual reading.
A separate database readback checked byte identity and immutable content/resource bindings.

Failures are retained in the private work record: an ID/slug navigation mismatch, a static notification
route shadowed by a parameter route, and a local reimport helper missing runtime configuration. The
first two were fixed and retested in the app; configuration is now checked before claiming canonical
work so missing setup cannot consume attempts. Passing local flows do not establish deployed behavior.

## Remaining gates

- Scanned/mixed books: two live recognition pages returned, but no completed scanned-book conversion
  was qualified. Source review found an incorrect column paragraph break and incomplete relative
  typography. A controlled fixture also exposes uncorroborated cross-page OCR heading hierarchy.
- A provider request lost authority with unresolved billing. Its reservation remains held; it is not
  automatically resent. Expired pilot configuration is not a reusable deployment route.
- Complete marks/offline/reconnect/account/translation/deletion and error-flow qualification is open,
  together with all navigation-return variants and physical phone/assistive-device checks.
- Production qualification and retention activation remain separate gates. The production qualification
  catalog is empty. No deployment, cleanup activation, whole-book fidelity or release PASS is claimed.

See [worker checks](pdf-worker-checks.md), [runtime](pdf-runtime-checks.md),
[provider checks](pdf-provider-checks.md), [publication](pdf-publication-checks.md),
[reader checks](pdf-reader-checks.md) and [metadata](pdf-metadata-checks.md) for reproducible boundaries.
Historical check documents describe their scoped runs; this guide is the current overall status.
Private source books, provider payloads, credentials, account data and local evidence are not PR assets.

## Reproduce checks

Use the repository's documented Node/pnpm environment and the worker's locked Python environment.

```sh
pnpm --filter api typecheck
pnpm --filter web typecheck
pnpm --filter api lint
pnpm --filter web lint
pnpm --filter api exec jest --runInBand
pnpm --filter web exec vitest run --maxWorkers=2
cd packages/pdf-epub
uv sync --locked --extra dev --python 3.12.14
uv run python -m unittest discover -s tests -v
uv run ruff check src tests scripts
uv run mypy src/ava_pdf_epub
```

Apply migrations only to an explicitly selected test database during review. Follow the runtime guide
for container identity and operator configuration; do not copy local pilot identities into production.
