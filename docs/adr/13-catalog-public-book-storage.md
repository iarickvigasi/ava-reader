# 13. Catalog owns public book bytes

Status: accepted · Date: 2026-10-27 · Supersedes ADR 12's temporary storage exception.

Public EPUBs, covers, provider metadata snapshots, and derived reader packages are stored in Catalog PostgreSQL PublicBlob.
Private uploads remain in the main PostgreSQL StoredBlob table. Main retains lightweight public
Book/BookFile/blob descriptors for durable personal LibraryItem and locator identities. A public
descriptor has an opaque Catalog blob ID and an empty bytes field; it contains no public file bytes.
The main API accesses Catalog content through signed HTTP, never a second database client.

The existing main reader processor can normalize public EPUBs transiently, but writes their source,
cover, and output bytes to Catalog. The authenticated main reader and cover endpoints keep their
existing ownership checks and proxy Catalog bytes; acquired public books use the same offline cache.
Public drafts are accessible only through admin review/preview before publication. Catalog blob
HTTP endpoints require timestamped HMAC and are not anonymous download endpoints.
Content-addressed Catalog writes make interrupted uploads replay-safe. Object storage can later
replace Catalog byte persistence behind the same HTTP boundary without changing locators.
