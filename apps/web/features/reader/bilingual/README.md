# Bilingual reader logic

Start with `use-bilingual-pages.ts`: it coordinates page ranges, navigation, and the source anchor.
`types.ts` contains the contracts shared by these modules.

| Folder         | Responsibility                                                                        |
| -------------- | ------------------------------------------------------------------------------------- |
| `content/`     | Assemble sentences into original block flow, retaining inline formatting and offsets. |
| `measurement/` | Measure flowing text and continuation columns at the current width and font.          |
| `pagination/`  | Pack measured sentence ranges into pages and identify the next missing sentence.      |
| `position/`    | Map source locators, page positions, and annotation ranges to visible fragments.      |
| `demand/`      | Request only needed sentences, with cancellation and bounded retries.                 |

## Integration

- UI and the reader coordinator live in `components/app/reader/bilingual/`.
- Shared device detection and restoration between reader modes live in `../modes/`.
- `features/offline/buckets/translations` owns cache hydration, database reads, generation, and
  persistence. Demand uses its public entry point; local misses await saved database translations.
- `features/reader/measurement` supplies geometry shared with the ordinary reader. Imports use its
  explicit alias to distinguish it from this folder's `measurement/`.

## Stable updates

`use-pair-measurements.ts` commits the measured chapter and geometry together. While a new sentence
is being measured, retain the previous compatible snapshot and pause navigation and new demand.
This keeps columns mounted and prevents lazy DOM measurements from mixing two chapter snapshots.
New book, chapter, language, source revision, or layout identities invalidate the previous snapshot.

Tests stay beside the implementation; fixtures live with their pagination or position consumers.
Behaviour and validation limits are specified in `docs/specs/9-bilingual-mode/`.
