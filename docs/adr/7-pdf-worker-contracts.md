# PDF worker and content contracts

Status: selected for implementation · 2026-09-28 · PDF-02 (AVA-2).

## Context and choice

PDF conversion runs once during initial import. Keep the original source and one fixed finished
book. English ordinary single/double columns reflow into one logical stream. AVA funds processing;
terminal Failed stays Failed with diagnostics, investigation marking and notification intent.

Retain the isolated Python worker. The API owns authentication, durable jobs and eventual atomic
publication. Worker output is a candidate, never authority to publish. A CLI exit 2 preserves a
reviewable candidate; it is neither a missing-output failure nor Ready. Local worker SQLite resume
is standalone tooling and cannot reopen a terminal AVA import.

Python strict models own versioned JSON Schemas for job, canonical Book v2, result, accepted-content
and reader v3. The API generates structural validators and TypeScript types from these schemas.
Canonical graph/hash/offset checks remain in the Python semantic boundary, invoked with a fixed
installed module, bounded JSON, deadline and no provider environment. Unavailable validation refuses
acceptance. A structural schema pass alone cannot establish graph or content validity.

The extended reader envelope carries the complete canonical spine, addresses and resource inventory,
plus one final content identity. It is a contract for PDF-03/04, not a second running renderer. Current
v2 consumers cannot receive v3 as if it were v2. Ordinary EPUBs keep their existing single parser
and legacy-author normalization. Actual v1 package rejection on main remains unchanged; the earlier
spec's claimed v1 adaptation was stale.

Offsets bind exact UTF-8 text hashes to Unicode codepoint boundaries and UTF-16 mappings. Explicit
normalization segments preserve ligature/space/combining provenance. Source geometry names page,
band and column; array/object extraction order is not proof of source reading order. Styles retain
explicit zero/false versus unknown. Resources retain occurrence identity separately from byte identity.

## Scope and verification

No upload/controller, database migration, job queue, OCR fallback, publication endpoint or reader
renderer is activated by these contracts. The v1 worker remains a conservative extraction/export tool;
PDF-03/08 implement migration/production of the complete v2 content model. Representable does not mean
supported or qualified. PDF-09 enforces ownership and actual-reader publication gates.

Reproduction and exact limits live in [worker integration checks](../pdf-worker-checks.md). Generated
schemas/types must reproduce from source. Never accept a user-provided schema, executable or path.
Provider data handling, retention, operating limits and actual device/accessibility checks remain
in their implementation tickets; no reader tokenomics approval is required.
