# PDF accepted-reader selection boundary

Part of [ADR9](adr/9-owned-pdf-imports.md) and [PDF import checks](pdf-import-checks.md).

The non-routed `selectAcceptedPdfReader` requires a trusted stored accepted-manifest hash, publication
fence, owned live READY operation, unchanged source/final identity, and a qualification record bound
to the adapter and reader build. It verifies owned accepted reader bytes and mandatory semantic v3
validation/capabilities independently of the source format. These trusted inputs must come from
PDF-09 persistence, never a client request. It is not wired to ReaderService and creates no acceptance
records. Publication owns canonical/reader conservation: canonical-file and embedded-book digests use
different serialization domains. This guard does not infer equivalence from a source hash alone.
