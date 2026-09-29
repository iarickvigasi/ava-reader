# PDF import migration and rollback

Part of [PDF import checks](pdf-import-checks.md); no production deployment was performed.

Deploy migrations in order: `20260928180000_pdf_import_artifacts`, then
`20260928190000_pdf_import_terminal_guards`, then `20260928200000_pdf_cover_privacy_marker`.
The permanent marker backfills live operations and retained PDF_ARTIFACT cover references; unrelated
Books remain unchanged. Existing Books get version0 and no user-owned metadata
fields; no existing EPUB source/reader bytes are rewritten. Prisma's first isolated attempt hit a
missing migration file while it was being authored (P3015); the completed migration then applied
normally and baseline preservation was verified. Do not edit an already applied migration.

For production rollout first back up and verify restore, apply migrations, deploy the installed
worker admission module/API, then enable the future caller only after its gates pass. Before any new
imports exist, reverting the API leaves harmless additive schema. Once records exist, prefer code
rollback with the additive schema retained: old cover/GC behavior is unsafe for new PDF artifacts,
so disable the additive route and keep its access/pin protections. Do not drop new tables/enums or
source bytes as an automatic rollback. Export and reconcile owned artifacts before any deliberate
schema/data removal. A deployment rollback has not been executed by this local task.
