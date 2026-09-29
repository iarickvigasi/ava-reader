# Canonical content and bounded generated EPUB

Status: implemented locally; source/runtime checks distinct from product qualification · 2026-09-29 · PDF-03.

Reader v3 embeds the complete validated canonical Book. Preserve that object rather than map it
through the lossy legacy block representation. Python owns `ava-json-v1` hashing (defaults, numeric
representation and Unicode); the API verifies the supplied digest through the semantic validator.
Full resource/fragment addresses and codepoint/UTF-16 maps survive, independent of chapter windows.

The same canonical v2 Book exports one XHTML per chapter, nested navigation, exact literal text,
bounded styles, source-page anchors, note callouts/returns, list hierarchy and table header graphs.
Caption/credit blocks retain canonical order and explicit figure/table associations. Raster bytes
must match hash, size, type, geometry and full decoding. No generated picture substitutes for them.

Generated EPUB profile `ava-epub-canonical-2.1` retains only canonical publication/source evidence in
a JSON sidecar. Reimport validates its canonical semantics and exact agreement of all ZIP entries
with deterministic XHTML, CSS, navigation, metadata and assets. The trusted low-level adapter also
requires an expected digest; ordinary upload instead derives it from validated content and mints a
new server-owned identity through [ADR13](13-canonical-epub-import.md). A sidecar alone is never
acceptance. Independent XML/oracle checks and EPUBCheck separately establish authored-fixture
semantics/package validity; they do not establish source extraction or real-reader rendering.

This is intentionally a bounded AVA-generated interoperability route. Third-party rewrites of its
XHTML/CSS or stripping its provenance refuse this route. Ordinary publisher EPUBs keep the existing
parser and supported behavior. No arbitrary CSS support or trusted content claim is inferred from
a profile marker. Ordinary Library upload now recognizes this profile and queues isolated
preparation; its retained content becomes readable only after qualified acceptance.

The canonical archive layer bounds archive/expanded bytes at 256 MiB, members and aggregate image
resources at 200 MiB, and entries at 24,000. Ordinary uploads impose a stricter 50 MiB source bound
and refuse ZIP64/split directories before host entry allocation. Their fixed container uses bounded
artifact streaming, a 180-second child deadline, private scratch and database-confirmed leases.
The older direct adapter retains its 64 MiB input, 15-second subprocess and 32 MiB output ceiling;
it is not the ordinary upload executor. Neither conservation result qualifies a product reader.

EPUB identities use accepted conversion identifiers; printed identifiers remain source-edition
relations. Accepted contributors retain roles; candidate/conflict/unknown claims stay evidence only.
Ambiguous accepted titles/identifiers/language refuse export. The reproducible package modification
timestamp is a declared fixed export timestamp, not a claim about the printed edition's date.

See [checks and remaining gates](../pdf-content-checks.md) and [foundation](7-pdf-worker-contracts.md).
