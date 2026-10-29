# Public-domain text sources and importer support

The [300-title research data](../apps/catalog/data/classics-rights) distinguishes source leads from
importable EPUBs. A scan, partial volume, export link or free reading page is not a reviewed EPUB.

## Platforms and access

| Platform                                                                                                 | Useful languages/formats                   | Access and reuse evidence                                                                                                                                                                                            | Importer                |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| [Standard Ebooks](https://standardebooks.org/)                                                           | English EPUB                               | Edited digital text; inspect artwork/territorial scope. [Full feeds](https://standardebooks.org/feeds) require authorized access.                                                                                    | Supported               |
| [Wolne Lektury](https://wolnelektury.pl/api/)                                                            | Polish EPUB                                | Public API; preserve [editorial licenses/attribution](https://wolnelektury.pl/info/zasady-wykorzystania/).                                                                                                           | Supported               |
| [TextGrid](https://textgridrep.org/docs/download)                                                        | German, some Polish; EPUB exports, TEI/XML | Public catalog and [APIs](https://doc.dev.textgridlab.org/). Item licenses vary: verified examples include CC BY 3.0 DE and CC BY 4.0.                                                                               | Adapter needed          |
| [Project Gutenberg](https://www.gutenberg.org/ebooks/offline_catalogs.html)                              | Multiple languages; EPUB, HTML             | Use official metadata/mirroring routes and [robot policy](https://www.gutenberg.org/policy/robot_access.html); retain [license](https://www.gutenberg.org/policy/license.html). US clearance has territorial limits. | Adapter needed          |
| [BNE Digital](https://www.bne.es/es/colecciones/epubs)                                                   | Primarily Spanish EPUB                     | Institution describes corrected OCR, free download and reuse; confirm exact item/license. Catalog access failed from this research environment.                                                                      | Adapter needed          |
| [DTA DiBiLit](https://github.com/deutschestextarchiv/DiBiLit-Korpus)                                     | German TEI/XML                             | Official open corpus, CC BY-SA 4.0; needs conversion and attribution/share-alike handling.                                                                                                                           | Conversion + adapter    |
| [Wikisource](https://wikisource.org/wiki/Wikisource:WS_Export/en)                                        | All six languages; HTML, EPUB export       | Public MediaWiki API; validate full transclusion, proofread status and contributor licenses. Red links are not books.                                                                                                | Adapter needed          |
| [NBUV Ukrainica](https://irbis-nbuv.gov.ua/ulib/) / [Culture of Ukraine](https://elib.nlu.org.ua/)       | Ukrainian scans                            | Verified historical editions; no general EPUB/reuse API established.                                                                                                                                                 | Transcription + adapter |
| [e-rara](https://www.e-rara.ch/) / [BSB](https://www.digitale-sammlungen.de/) / Polish digital libraries | PDF/DjVu/scans                             | Useful original editions and item rights labels; check every institution/item.                                                                                                                                       | Transcription + adapter |
| [Gallica](https://api.bnf.fr/fr/api-opds-du-catalogue-de-livres-numeriques-de-gallica)                   | French EPUB/OPDS, scans                    | [Commercial reuse requires a license](https://gallica.bnf.fr/accueil/fr/html/conditions-dutilisation-de-gallica); free downloads do not grant redistribution.                                                        | Permission + adapter    |

BNR, textos.info, Lesya Ukrainka's encyclopedia, BYU Sophie and Cervantes provide additional leads.
Their new records retain formats and unresolved reuse/edition checks. Cervantes item licenses can
include explicit BNE CC BY 4.0 exceptions; its [general terms](https://www.cervantesvirtual.com/marco-legal/)
restrict redistribution. Do not apply one site's general claim to every contributed edition.
Chytvo's [archival mirror](https://chtyvo.shron.org/) is discovery material, not a blanket reuse license.

## Supported provider collections

Use a shortlist title/author/language plus `provider` and `providerId`, for example:
`standard-ebooks` / `jane-austen/emma`, or `wolne-lektury` / `pan-tadeusz`.
Standard Ebooks uses a two-part author/title slug and its standard EPUB, not restricted bulk feeds.
Wolne Lektury uses a book slug and verifies official API language/download metadata.
A different provider creates a separate edition; it never replaces an acquired reading identity.
Never supply another provider's bytes under an IA identity or invent an IA identifier.

1. `pnpm --filter catalog import:reading-assets --bootstrap --file /path/collection.json --output /path/candidates.json`
2. `pnpm --filter catalog import:reading-assets --inspect --file /path/candidates.json --output /path/inspected.json`
3. `pnpm --filter catalog import:reading-assets --apply --file /path/inspected.json`

Use existing admin-token/user-agent configuration and the [deployment mount](catalog-import-deployment.md).
Allowlisted HTTPS fetches cap metadata at 4 MiB and EPUBs at 50 MiB. Inspection retains source metadata
and exact SHA-256; apply compares source/local bytes again. Changed bytes require reinspection.
Public EPUBs, covers, snapshots and reader packages live in Catalog PostgreSQL; Main retains user data.

## Publication and review

The collection [publishes after processing with review deferred](catalog-publication.md).
Discovery research does not download/import/publish candidates or change this policy.
Inspect all volumes, translations, artwork, modern notes and navigation; retain source/license notices.
Admins can complete review after publication, unpublish and restore copies explicitly.
Two small TextGrid exports were checked as genuine EPUB ZIP packages; literary quality remains unreviewed.
