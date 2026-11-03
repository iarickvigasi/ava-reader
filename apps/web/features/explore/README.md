# Explore feature logic

`use-explore.ts` coordinates search state, result pages, and language facets. UI components remain
in `components/app/explore/`.

- `data/`: bounded public-response caching and catalog resource loading.
- `navigation/`: URL query state, detail IDs, and return links.
- `feed/`: cursor pages, bounded result windows, deduplication, and navigation snapshots.
- `feed/restoration/`: snapshot recording, navigation listeners, and scroll restoration.
- `grid/`: viewport measurement, virtual rows, focus protection, and anchor preservation.
- `details/`: work/author loading, reading details, and reading-copy acquisition.
- `metadata/`: localized text, covers, descriptions, biographies, and filter definitions.
- `admin/`: authenticated editorial operations, publication, and edition reassignment.
- `linking/`: owner-only private-copy linking through the library bucket.

Tests stay beside their implementations. Shared contracts live in the owning folder's `types.ts`.
Public catalog resources and authenticated editorial responses retain separate loading paths.
