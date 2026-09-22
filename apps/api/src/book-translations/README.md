# Book translations

Start with `book-translations.service.ts`: it coordinates chapter reads and sentence generation.
The controller handles HTTP validation and cancellation; `dto.ts`, `types.ts`, and
`version-identity.ts` define shared contracts and translation identity.

| Folder        | Responsibility                                                                         |
| ------------- | -------------------------------------------------------------------------------------- |
| `source/`     | Load the owned reader package, segment using its language, and select valid sentences. |
| `generation/` | Build prompts, call AI, validate complete output, and serialize overlapping work.      |
| `storage/`    | Read saved sentence translations and persist completed results through Prisma.         |
| `testing/`    | Share chapter, translation context, database, and model fixtures between tests.        |

## Flows

- Chapter GET: load source context, read saved translations, return the catalog and matching results.
- Generate POST: load context, validate requested IDs, lock the version, read saved results,
  generate remaining sentences, validate, persist, and return the stored results.
- Generation uses storage directly to recheck saved sentences before spending AI tokens.
- Tests stay beside their implementations; fixtures are test-only dependencies.

Behaviour and validation limits live in `docs/specs/9-bilingual-mode/`.
