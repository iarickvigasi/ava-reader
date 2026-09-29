# Owned initial PDF import and private artifacts

Status: selected backend implementation boundary · 2026-09-28 · PDF-05.

Conversion is an explicit initial-import intent. A durably accepted source gets one Book, LibraryItem
and owner-scoped operation. The original PDF remains the immutable primary SOURCE/PDF file; generated
EPUB, canonical JSON and internal reader JSON have distinct roles. [Durable jobs](10-durable-pdf-jobs.md)
extend this boundary; publication stays gated. There is no later conversion or replacement.
The current ordinary `/library/import` path
keeps its existing behavior. The UI label is “Convert to EPUB”; defaults remain design work.

## Acceptance and request identity

`POST /library/pdf-imports` requires Clerk authentication, an `Idempotency-Key` (16–128 ASCII letters,
digits, `_` or `-`), one multipart `file`, and `convertToEpub=true`. The API snapshots exact bytes and
filename before asynchronous work. Source SHA-256, filename, size, configuration hash and conversion
intent bind the request. The same owner/key returns its original operation, including terminal Failed;
a changed payload conflicts. A new key for an already accepted conversion source returns owner-local
`PDF_ALREADY_IMPORTED` with the existing live entry reference. It does not coalesce a fresh intent or
create another copy. Intentional separate-copy controls remain unselected; deleted imports cannot
be reopened. Checksum lookup never crosses accounts.

Structural admission now uses the fixed pinned [isolated runtime](10-durable-pdf-jobs.md), with private
input, no provider environment/network and bounded output, CPU, memory and deadline. It checks actual
PDF structure, encryption, size and unsupported active/personal content. Ordinary safe URI/GoTo links
and benign initial destinations are admitted. Admission is not extraction qualification or proof of
reading order/profile fidelity. PDF-06 replaces the original host subprocess boundary.

Source bytes and their expiring STAGING pin are written atomically in one database operation. A short
owner-serialized transaction then creates the Book, LibraryItem, immutable operation and source link,
and promotes retention to OPERATION. A lost response can safely replay the same request. Concurrent
loser pins expire after one hour; the sweep deletes unbound expired pins before collecting old blobs.
Live operation references protect candidates from the existing orphan sweep.

## Ownership, metadata and terminal outcomes

Owned status, original-file and cover endpoints verify both operation owner and live LibraryItem.
Only the source is downloadable here; candidate/diagnostic/reader bytes cannot use that route. Covers
for PDF-import Books use a permanent private marker, so public denial survives account deletion;
the owned route serves them instead.
Ordinary EPUB cover behavior stays unchanged; its broader privacy issue requires coordinated client
work in PDF-10/12. Accepted EPUB downloads, ranges and full retention policy remain PDF-12 work.

PDF document-info fields start as source-hash-bound provenance candidates. User title/authors/language
edits use compare-and-set versions and explicit owned-field markers. Delayed extraction records its
candidates but fills only untouched defaults at the expected version. Empty user values retain edit
ownership. Neither extraction metadata nor a filename becomes verified bibliographic truth.
Validated reconstructed package language fills an empty, unedited display language using accepted
English locale metadata or the selected English profile default. It records separate
`validated-package` provenance, keeps metadata version/attempt checks, and does not invent a
source-edition claim or change accepted content. The same rule serves generated EPUB reimports.

Database triggers freeze pinned artifact bytes/descriptors and import identity. Terminal outcome
fields cannot reopen or acquire content; READY requires a final identity and other states have none.
New artifacts require a live nonterminal operation. Deleting a LibraryItem atomically tombstones the
operation and advances its cancellation epoch; late results cannot resurrect it. Retained terminal
source/diagnostics cleanup policy and actual notification delivery remain later lifecycle work.
PDF-06 adds fenced job leases, failure investigation records and notification intent; no Retry/Cancel.

The [dormant readable-selection boundary](../pdf-import-selection.md) requires real publication and
qualified reader authority; PDF-09/04 integration remains pending.

See [checks, rollback and remaining gates](../pdf-import-checks.md),
[worker contracts](7-pdf-worker-contracts.md) and [content adapter](8-canonical-content-adapter.md).
