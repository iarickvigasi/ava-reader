# PDF import backend evidence

Part of [PDF import checks](pdf-import-checks.md); backend verification, not complete app behavior.

The originating workspace retains `output/pdf-epub-integration-03-05/`: authored API39 tests, worker
153-test regression (including admission9 and the content adapter), static checks, installed wheel,
and independent PostgreSQL/authenticated HTTP evidence. `test-runtime.cjs` mounts the actual import,
artifact and ordinary library controllers with real Clerk verification, UsersService and Prisma.
Ephemeral local RSA tokens and synthetic users need no external authentication request. The isolated
PostgreSQL16 container uses temporary data; it does not read or mutate an existing user database.
The recorded scripts and outputs are evidence, not an automatically installed production test hook.

Independent HTTP groups cover81 checks:18 basic,22 concurrency/metadata,30 lifecycle,6 upload bounds
and5 account-deletion cover regressions. Six
same-key concurrent uploads converge; a socket deliberately destroyed after the committed response
is acknowledged by the harness, then replay resolves the same entry. Actual concurrent CAS writes
and delayed extraction exercise ownership. Wrong-account source/status/cover access refuses, pinned
source bytes match, private cover responses differ from the public PDF-cover404, and staged/operation
GC behavior is exercised. Deletion fences late artifacts/metadata, Failed cannot reopen, user deletion
cascades, and seeded legacy EPUB bytes/progress survive migration. Actual50 MiB+1 multipart upload refuses413;
a permanent Book marker keeps retained PDF covers private after account deletion. These are backend HTTP flows,
not browser/device flows or proof of completed conversion.
