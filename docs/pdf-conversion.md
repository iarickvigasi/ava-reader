# PDF conversion

During PDF import, a reader can select **Convert to EPUB**. AVA creates one Library entry after
durable upload, shows preparation status there, and makes the finished book readable only after
validation and publication. The same entry offers the unchanged original PDF and accepted EPUB.
Conversion happens once at import; finished content is fixed. There is no later conversion or
replacement. AVA funds processing; readers have no price, credit, API-key or funding step.

The selected scope is English reflowable prose in one or two columns, including native, scanned
and mixed PDFs. This is the intended scope; scanned/mixed conversion is not yet release-qualified.
Supported content includes chapters, nested Contents, ordinary typography, illustrations/captions,
notes/references, simple lists/tables and short verse/code. Reflow preserves meaningful styles and
reading order, rather than reproducing print-page geometry or promising exact fonts.

## Pipeline and responsibilities

| Stage | Responsibility and checks | Source |
|---|---|---|
| Admit | Authenticate ownership; enforce file/page/resource limits; bind upload intent to immutable source/configuration; create one owned item and operation. | `apps/api/src/library/pdf-import/{admission,operations,artifacts}` |
| Execute | Durable queue, registered worker/image, short leases and fences; bounded internal preterminal recovery; account/delete/revoke checks. | `apps/api/src/library/pdf-import/jobs`, `apps/api/src/pdf-conversion/runtime` |
| Inspect and recognize | Inspect every page/region; trust native text only against visible geometry/content; route missing or unreliable regions to explicitly configured recognition. Native-only books need no model call. | `packages/pdf-epub/src/ava_pdf_epub/reconstruction_v2` |
| Reconstruct | Conserve accepted text and source evidence; resolve columns/joins, global chapter/heading ancestry, notes, images, metadata and styles. Targeted book-level decisions cannot rewrite prose. | `reconstruction_v2`, host `apps/api/src/pdf-conversion/reconstruction` |
| Assemble | Canonical `ava-book-2`, separate chapter XHTML/spine, nested TOC, allocated link targets/backlinks, owned resources and finite shared CSS; preserve generated-edition identity separately from print metadata. | `packages/pdf-epub/src/ava_pdf_epub/{contracts,epub_v2}` |
| Validate/review | Verify source coverage, graph/resource hashes, conservation and EPUBCheck separately; retain blocking versus reviewable findings. Authenticated ADMIN decisions cannot waive hard blocks. | `apps/api/src/library/pdf-import/{publication,reviews}` |
| Publish | Fresh transaction rechecks ownership, generation/fences, complete artifacts, provider settlement, review and qualified reader capabilities. Exactly one accepted manifest/final content identity becomes Ready. | `apps/api/src/library/pdf-import/publication` |
| Read | Canonical reader v3 projects exact text/structures/resources; marks, resume, translations and offline bytes stay paired to fixed content. | `apps/api/src/reader`, `apps/web/features/reader` |

Worker contracts and API types are generated from the locked Python package. Unknown fields,
stale source/task hashes, invented nodes/styles, missing text/resources or unresolved required
structure fail closed. Text ranges use canonical code-point offsets with explicit UTF-16 browser
mapping; surrogate splits are refused. Image bytes have validated media type, dimensions and hashes.
Printed title/copyright evidence may confirm metadata; body headings, quoted labels and unsupported
PDF Info claims remain candidates. A print ISBN is not the generated EPUB identifier.

Book-level refinement compares bounded common-scale source crops and an ordered catalogue. Tasks
are bound to source, observations, images and exact IDs; they can propose heading/parent/chapter,
sparse observed styles and allowed paragraph joins. They never replace accepted page text. Groups
are bounded (256 catalogue nodes, 32 groups, 24 decisions/16 joins/48 crops per task, 2048×2048
sheet, 4 MiB image). Oversized indivisible context is refused, not silently truncated.

## Reader behavior and failures

Processing, review waiting, Ready and terminal Failed are distinct. Display measured stages, not
invented percentages or ETAs. After durable save the original PDF is downloadable, including while
processing or Failed; generated EPUB and Read require their final gates. Formats and Keep offline
are separate controls. Failed stays visible with a stable safe reference, durable investigation
marker and notification intent. No reader Retry/Cancel or silent reopening is provided.

Contents, note and internal-link jumps resolve exact targets, including cold-loaded chapters and
shared notes. Return uses the initiating reference; session-local Back records successful origins
and restores the exact passage. Failed, superseded and no-op jumps add no history. Reflow/font
changes preserve the landed passage; ordinary page turns, resume and browser Back remain separate.
Hidden measurement copies are inert and carry no duplicate canonical IDs or navigable links.

Owned generated-EPUB reimport uses ordinary Library upload, isolated validation and a new immutable
owned identity. Foreign final-content IDs/resource URLs cannot become authority. Existing EPUB
imports keep their ordinary route; ZIP64 and split archives are explicitly refused by upload
preflight. Legacy chapter-label maintenance excludes canonical PDF/EPUB Books at selection and swap.

Deleting an entry revokes access and fences active work. Minimal billing/terminal receipts may
outlive private document data; unknown paid exposure is retained until authoritative reconciliation.
Physical cleanup/backup policy is a separate operating decision; production purge is disabled.

See [operator setup](pdf-conversion-operations.md), [verification and current limitations](pdf-conversion-verification.md)
and the [worker package](../packages/pdf-epub/README.md). No production provider route, reader
qualification or cleanup activation is implied by installing or merging the implementation.
