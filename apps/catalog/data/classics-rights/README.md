# Classics rights and source research

Researched 2026-10-29. Six JSON files contain the 300 shortlist titles, 50 in each language.
All 300 entries have `publicationPolicy: PUBLISH_WITH_REVIEW_DEFERRED`: publish after processing.
`publication: null` retains pending exact-file review; this policy is not worldwide legal clearance.
The publication CLI accepts a copy of this shape with explicitly approved file-bound reviews;
see [publication instructions](../../../../docs/catalog-publication.md).

## What the data establishes

- Each entry retains the seed author/title/language and an author-bibliography URL. All 86 author
  pages were fetched; their SHA-256 hashes identify the observed page responses.
- `titleMentionedOnAuthorPage` is normalized string matching, not a verified complete edition.
  `deathYearPresentOnPage` records presence of the year, not a full biographical fact-check.
- `titleEvidenceUrls` contains links followed successfully from author bibliographies or additional
  library records investigated for unmatched titles. A successful request is not proof of EPUB quality.
- Ordinary life-plus-70 and life-plus-100 comparison dates use the seed death year. They deliberately
  do not resolve all national exceptions or separate publication/critical-edition rights.
- [rules.json](rules.json) supplies shared legal/territory evidence. The US check needs an evidenced
  first-publication date, not an electronic release date. No row claims worldwide clearance.
- Source candidates match the original language and author in provider metadata. Partial-title
  matches are labelled; they can describe a larger collection/volume and require identity review.
- Wikisource candidates are checked work pages, not verified EPUB exports. Some pages/exports may
  be incomplete; no download URL, file hash or completeness approval is invented.

## Source discovery and coverage

All 300 titles now have a **source lead**, including the 78 previously missing titles.
A lead may be an EPUB, exportable transcription, HTML, PDF/DjVu scan, manuscript or partial volume.
The 78 additions include 29 titles with an advertised EPUB or verified export link; 22 TextGrid
export URLs were observed, and two small exports were checked as genuine EPUB ZIP packages.
The other additions still need export validation/conversion, missing volumes or access/permission work.
Records retain `formats`, `completeness`, `reuseStatus`, verification errors and source/item evidence.
71 new candidate records have successful HTTP checks. Others retain indexed evidence or access errors;
a successful catalog response is not a checksum-bound file or proof of complete text.

New platforms include TextGrid, e-rara, BSB, NBUV Ukrainica, Culture of Ukraine, BYU Sophie,
Cervantes, BNR and regional Polish digital libraries. [Provider guide](../../../../docs/catalog-digital-sources.md)
records access routes, licenses and adapter gaps. No new adapters or publication mutations were added.
Existing publication policy remains unchanged; completed file reviews still belong in `publication`.
For example, Lodore needs all three volumes, Méphis currently has a volume-one lead, Jarilla's
1920 scan may be condensed, and Довічний жаль needs locating/transcribing in the 1908 journal scan.

| Language | Titles | With a source lead (any format) |
| -------- | -----: | ------------------------------: |
| uk       |     50 |                              50 |
| en       |     50 |                              50 |
| de       |     50 |                              50 |
| fr       |     50 |                              50 |
| es       |     50 |                              50 |
| pl       |     50 |                              50 |
