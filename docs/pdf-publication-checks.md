# PDF validation and publication checks

Use an explicit disposable/deployment DATABASE_URL and registered worker credentials. Never load
unrelated environment files or pass reader-provided paths/qualification records into this boundary.
The worker coordinator calls `processNextCandidate` with its pinned runtime image, bounded semantic
validator and optional code-qualified reader record. No new reader publication endpoint exists.

## Required checks

- Candidate completion remains Waiting. Bad source reports, unknown graph/resources, corrupted
  artifacts and invalid EPUB refuse publication; warning findings require explicit AVA review.
- Concurrent validators acquire one lease. Process loss advances the fence after real expiry;
  stale validation cannot persist. Three infrastructure failures create one immutable Failed receipt.
- Stop, deletion, worker revocation and provider uncertainty deny commit. Unvalidated executable
  work expires at its deadline; completed validation remains reviewable after that wall-clock time.
  Invalid candidate authority is stopped and cannot poison the next candidate scan.
- Concurrent first publication yields one content ID, accepted manifest and Ready notification.
  Original PDF and exact accepted EPUB remain formats of that one entry. Replacement is refused.
- Original and newly qualified compatible reader builds read the same content; unqualified,
  mismatched-adapter, insufficient-capability and revoked builds fail closed.
- Owned reader/resource/download bytes match their manifests. Delivery/acknowledgment is owner-scoped,
  idempotent and never changes Ready/Failed. Account cascade removes private publication content.

## Evidence and interpretation

The task workspace retains scripts/results under `output/pdf-epub-integration-09`: native host
prepare/reconstruct streaming, actual isolated EPUBCheck, publication and extended durable lifecycle
checks against a dedicated PostgreSQL database. TEST qualifications prove only contract behavior;
product publication still needs an independently tested build entered in the code-owned catalog.

Earlier failures are retained: deferred-trigger record access, a harness image-ID mismatch,
invalid bare-UUID content IDs and non-idempotent qualification registration. Repairs and reruns
remain separate snapshots. Old source reports lack later chapter/reference checks and are refused.

Changes to source extraction, EPUB exporter, reader adapter or qualification inputs require affected
checks again. Do not replace EPUBCheck or actual user flows with a successful schema parse. Never
claim image/resource ceiling constants establish 200 MiB phone performance or visual fidelity.

Legacy `runNative` resource canaries remain a direct, explicitly armed sandbox test. The production
reconstruction coordinator rejects fault configuration before claiming work; prior PDF06 fault
receipts do not claim coverage of the new reconstruction task loop.

The final publication boundary now validates reconstruction reports using the generated worker
contract. A normal native import exposed an outdated duplicate schema rejecting the newly emitted
`refinement_evidence` field. The failed import and its unpublished candidate were retained. Twenty-six
publication checks and 21 independent saved-report checks pass after the repair, including empty
native evidence, nonempty refinement evidence, unknown fields and incomplete source checks. A fresh
normal native import then reached Ready and actual reading under TEST qualification; the earlier
Failed operation remained terminal. The shared schema does not replace source, resource, EPUB or
reader-capability validation.
