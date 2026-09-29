# Whole-book structure and style refinement

The integrated OCR route now separates page transcription from book-level decisions. It preserves
the original page observations and never asks the second pass to rewrite prose. Native-only books
retain the local path without a comparison sandbox or provider call.

## Executable sequence

1. Reobserve the source and build an ordered heading catalogue, local body references and selected
   ambiguous adjacent paragraph boundaries. Source-qualified joins and already corroborated
   observations need no extra model work.
2. Build deterministic comparison tasks bound to source, complete observation and image hashes.
   Common-scale source crops include a long previous paragraph's ending for a join decision.
   Labels stay outside source pixels. Oversized groups split; an indivisible context that cannot
   fit is refused rather than shrunk or truncated.
3. The host validates each task, rechecks execution authority and dispatches through the existing
   `resolve_structure` provider ledger. Reservations, settled receipts, reuse and unresolved charges
   retain their existing rules. Old expired task inventories are not broadened.
4. Accept only exact ID-bound heading/parent/chapter, sparse style and allowed join decisions.
   Replacement text, additional nodes, stale hashes, missing evidence, unknown parents and unresolved
   decisions are refused. Full canonical schema/Python checks remain authoritative even when a
   provider needs a simplified generation grammar.
5. Regenerate the source tasks before applying decisions to copies. Verify global ancestry and
   numbered source relationships, then reconstruct and recheck text, spans, notes and resources.
   The report retains task/response/observation digests. EPUB packaging and reader qualification
   remain separate stages.

## Current bounds and evidence

Tasks retain an ordered catalogue of at most 256 selected heading/reference/boundary nodes and
produce at most 32 groups. Each task allows at most 24 decisions, 16 join edges and 48 crops;
geometry can require smaller groups. Contact sheets stay within 2048 by 2048 pixels at two pixels
per source point, with a four-MiB encoded-image limit. Host packet/container limits also apply.
These are implementation limits, not a claim that every book within the page limit is qualified.

The reviewed source passes 249 worker tests and 197 affected API checks. Independent authored
responses repair the known cross-page H3 error, preserve all original text and produce the expected
eight headings across two chapter XHTML files. Reopening the EPUB preserves the canonical book;
EPUBCheck reports no errors or warnings for that authored candidate. Source crops were visually
reviewed. These checks establish the executable seam, not live-model accuracy. Container execution
and any later model experiment must record their own exact image/source/configuration evidence.

Boundary routing remains conservative: a paragraph can cross a page after punctuation and resume
with a capital letter without explicit OCR continuation flags. Current synthetic clear-break and
many-edge tests do not prove fidelity for that case or all long books. Scanned/mixed full-book
qualification remains open; do not treat a structurally valid response as editorial approval.

See [runtime](pdf-runtime-checks.md), [provider authority](pdf-provider-checks.md),
[publication](pdf-publication-checks.md) and the [current review guide](pdf-review-guide.md).
