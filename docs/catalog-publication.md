# Publish imported books

The CLI uses the authenticated publication API with operator authorization, package-quality and file-identity checks.
The 300-book collection publishes automatically after successful processing, with review deferred.
Importer replay preserves withdrawals. Admins can unpublish/republish through Explore.

## Publish the existing classics drafts

Run `pnpm --filter catalog publish:classics --file /path/inspected.json` to preview matching copies.
Add `--apply` to publish processed copies with review deferred. Repeat `--file` for several batches.
This uses the shared server secret and internal publication API (ADR 14). Withdrawn copies are skipped;
restore them explicitly in Explore. Non-collection titles stay drafts. UI publication also offers
“Publish now, review later” for any processed public copy. Review can be completed after publication.
Publication authorization is recorded separately from completed review; no worldwide clearance is invented.

## Reviewed data contract

The six [research files](../apps/catalog/data/classics-rights) contain all 300 titles. Their
`publication: null` means research only. Do not turn life-plus-70 arithmetic into approval.
Copy the entries actually reviewed into one version-1 file, and supply `publication` as below.
Use the imported Catalog edition UUID and SHA-256; placeholders fail.

```json
{
  "version": 1,
  "books": [
    {
      "id": "COPY_THE_RESEARCH_ID",
      "publication": {
        "status": "APPROVED",
        "editionId": "REAL_CATALOG_EDITION_UUID",
        "checksum": "REAL_64_CHARACTER_SHA256",
        "review": {
          "sha256": "THE_SAME_SHA256",
          "rightsStatement": "Actual basis covering the exact text, translation, artwork and additions",
          "rightsUrl": "https://actual-evidence-page",
          "rightsJurisdiction": "Actual reviewed distribution territories",
          "notes": "Actual reading/completeness checks and attribution/license obligations",
          "rightsConfirmed": true,
          "qualityConfirmed": true
        }
      }
    }
  ]
}
```

## Run and retry

- Local plan: `pnpm --filter catalog publish:reading-assets --file /path/reviewed.json`.
- Apply: same command plus `--apply`; deployment container commands are in the
  [deployment runbook](catalog-import-deployment.md). Authorization uses the importer's existing environment.
- Plans allow 300 rows/8 MiB, reject duplicate IDs/editions and missing or mismatched review hashes.
  `publication: null` rows are skipped. Preflight validation happens before the first network write.
- PROCESSED copies can publish; READY copies with confirmed synchronization are skipped. Pending
  synchronization is retried through the normal endpoint. PENDING/FAILED/WITHDRAWN are rejected.
  Restoration requires an explicit admin action in Explore, never an importer replay.
- Calls are sequential. Per-copy failures return exit 2 and do not stop later copies; invalid plans
  return exit 1. Preserve output and rerun the same reviewed file after resolving failures.
- Completed review must describe the exact imported bytes; deferred publication grants no legal clearance.
