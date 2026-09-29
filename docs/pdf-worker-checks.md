# PDF worker integration checks

PDF-02 foundation on main `8c96d4c7836dcb6ecad013f082af8633d4280e6a`.
Only the worker source and scoped contract/docs changes are ported from the earlier local branch.
No old narration, handbook or QA runtime is imported. `pnpm qa:*` is unavailable on this base.

- Worker: [README](../packages/pdf-epub/README.md), pinned environment, tests and CLI smoke.
- Contract source: `packages/pdf-epub/src/ava_pdf_epub/contracts/`.
- API boundary: `apps/api/src/pdf-conversion/contracts/`.
- Design: [ADR 7](adr/7-pdf-worker-contracts.md).

```sh
# DATABASE_URL is needed only for Prisma client generation; this does not connect to the database.
DATABASE_URL=postgresql://ava:ava@127.0.0.1:15442/ava_contract_tests pnpm install --frozen-lockfile
pnpm --filter api pdf:contracts:check
pnpm --filter api typecheck
pnpm --filter api lint
pnpm --filter api test --runInBand
pnpm --filter api build
AVA_PDF_CONTRACT_PYTHON=/absolute/installed-worker/bin/python \
  AVA_PDF_SMOKE_DIR=/absolute/native-smoke-output pnpm --filter api pdf:contracts:smoke
```

The semantic bridge requires an absolute path to a trusted installed worker Python interpreter.
It runs `-I -m ava_pdf_epub.contracts validate`, bounded to 15 seconds and 32 MiB input with 1 KiB
output. Provider credentials/environment are not forwarded. It has no PDF parsing or network action.
Deployment must bound semantic process concurrency. [PDF-06 jobs](pdf-job-checks.md) and the
[isolated runtime](pdf-runtime-checks.md) now supply durable claims and native execution.

A passing contract test is not a reader rendering, conversion quality or publication test. PDF-03
implements the adapter and source conservation, PDF-04 the renderer/navigation, PDF-05–09 the durable
pipeline and gates, PDF-10 the reviewed import/status UI, and PDF-13 full end-to-end qualification.

## Evidence

28 September: 134 worker tests, 540 API tests and 1,137 web tests pass. Repository typecheck and API build
pass. Schemas reproduce; API smoke validates the actual installed-wheel native CLI candidate through
the Python subprocess. Installed-wheel and Linux/arm64 container native smoke/EPUBCheck pass.
Independent review repaired graph/source/FIFO and completion-context integrity findings.
The initial global lint run found require-await in
`apps/api/src/library/items/delete-library-item.spec.ts:22`; the PDF-03/05 continuation repairs that
mock. Its tests, full API lint, repository typecheck/lint/tests and API build now pass.
Web lint retains one existing ref warning. Follow-up scope: [content](pdf-content-checks.md) and [uploads](pdf-import-checks.md).
Retained logs and AC report are in the originating workspace's `output/pdf-epub-integration-02/`
and `docs/09-work/plans/pdf-epub-integration/foundation-report.md`. These are local checks, not deployed behavior.
No provider call, account provisioning, production mutation or deployment is part of this check.
