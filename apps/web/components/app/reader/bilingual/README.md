# Bilingual reader components

Start with `bilingual-reader.tsx` for composition and `use-bilingual-reader.ts` for coordination.

| Folder          | Responsibility                                                                      |
| --------------- | ----------------------------------------------------------------------------------- |
| `content/`      | Render original or translated sentences in paragraphs, lists, headings, and images. |
| `layout/`       | Compose page columns, the footer, and the initial preparation layout.               |
| `loading/`      | Render sentence/page skeletons and loading, offline, or error status.               |
| `measurement/`  | Render hidden measurement content and prepare the next chapter's first page.        |
| `interactions/` | Connect gestures, text selection, highlights, and AI comment marks.                 |

## Boundaries

- Rendering shares `content/` between visible columns and hidden measurement surfaces.
- Algorithms and reusable hooks live in `features/reader/bilingual/`.
- Translation cache, database reads, and generation use `features/offline/buckets/translations`.
- Root coordination keeps the displayed chapter and its measured geometry in one snapshot.
- Reader mode selection stays in `../view/reader-mode-router.tsx`.
- Tests stay beside their components. Flow tests share the fixture in `content/`.

Product behaviour and validation limits live in `docs/specs/9-bilingual-mode/`.
