# PDF import acceptance boundary

Part of [PDF import checks](pdf-import-checks.md). The upload, durable worker, publication and
Library/reader paths are now connected. This table describes implementation and scoped evidence;
it does not mark every epic acceptance criterion or a production release complete.

| PDF-05 AC | Current implementation and evidence                                                                                                                                                                                                                                                          | Remaining qualification                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 01        | Same-request/lost-response reconciliation, changed-payload conflict and concurrent admission are tested. One saved source creates one owned Library entry. Duplicate source uses the existing-entry outcome.                                                                                 | No new-copy override is implied; broader duplicate/device journeys remain separate.                                                         |
| 02        | Owned source/status/cover checks and candidate denial are implemented. Accepted EPUB and canonical resources use authenticated, immutable artifact routes; actual signed-in PDF/EPUB downloads matched source/accepted hashes locally.                                                       | Full account-switch, offline, deletion and deployment download matrix.                                                                      |
| 03        | Initial import enqueues with the saved entry. Reconstruction, independent EPUB validation, review findings and qualification gates precede one atomic fixed-content publication. Library status, Formats and Read are connected; native upload→Ready→reader passed under a local TEST build. | PRODUCT reader catalog is empty; no production activation or complete supported-book/device qualification.                                  |
| 04        | Unbound staging, fenced worker artifacts, failed-work and removed-private-book retention have scoped DB tests. Removal revokes access before physical cleanup eligibility; terminal request tombstones prevent replay.                                                                       | Production private-file sweep remains disabled; deployment scheduling, backup erasure and full user lifecycle verification are not claimed. |
| 05        | Invalid, unauthorized and unsupported admission refuses without dispatch. Oversized multipart, parser isolation, resource limits and capacity refusal have focused tests; current native UI imports exercised the real admission path.                                                       | Boundary constants and tiny fixtures do not establish hostile-input, maximum-book or phone capacity qualification.                          |
| 06        | Provenance, versioned metadata edits and source fills preserve user choices. Canonical progress, marks/offline identity and translation authority retain fixed content identity; actual native metadata updates were observed.                                                               | Complete marks/translation/offline/account-switch user journeys and provider translation quality remain separate.                           |

Generated EPUBs can also enter through ordinary Library import. Bounded isolated validation of
actual XHTML/nav/CSS/images and EPUBCheck produces a new owned canonical import; portable evidence
cannot reuse the exporting book's publication authority. A signed-in local reimport preserved title,
author, chapters, internal targets and an illustration. [ADR13](adr/13-canonical-epub-import.md)
and [content checks](pdf-content-checks.md) own that distinct path.

The task workspace retains original and repaired evidence under `output/pdf-epub-integration-13/`:
`local-reader-qualification/signed-in-native-flow.json`, `repaired-native-flow.json`,
`reimport-success-flow.json` and `reimport-db-verification.json`. These name the local build and TEST
qualification. Complete package tests are separate from those actual signed-in desktop observations.

Retained failures include admission action/geometry refusal, mutable upload input, missing adapter
binding, source-length mismatch and permanent private-cover denial. The real app walkthrough also
found an item-ID/slug redirect error and a shadowed notifications route; both were repaired and the
fresh import/status/reader flow rerun. A local EPUB queue helper omitted runtime activation, consuming
three attempts before preparation. Its original Failed entry remains Failed; configuration now
validates before claiming eligible work, and a new unchanged-EPUB import completed successfully.

Conversion still occurs only at initial PDF import. No reader retry/cancel recovery, later conversion,
reconversion or replacement of accepted content is introduced by these repairs. Historical backend
and fixture reports remain evidence of their recorded snapshots, not current release certificates.
