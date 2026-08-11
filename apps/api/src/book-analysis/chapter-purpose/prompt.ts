import type { ChapterDigest } from './build-digest';

// Bumped whenever the wording below changes, so a stored result can be traced
// to the prompt that produced it and selectively re-run later.
export const CHAPTER_PURPOSE_PROMPT_VERSION = 1;

const PURPOSE_DEFINITIONS = [
  'BODY — the work itself: the narrative or argument chapters the reader came for.',
  'FRONT_MATTER — title page, copyright, dedication, epigraph, acknowledgements, colophon.',
  'TOC — a table of contents.',
  'PREFACE — preface, foreword, introduction, translator’s or editor’s note, before the body.',
  'AFTERWORD — afterword, epilogue-as-commentary, or a closing essay by another hand.',
  'APPENDIX — supplementary material after the body: appendices, tables, supporting documents.',
  'NOTES — endnotes or collected footnotes, usually numbered and citation-dense.',
  'REFERENCES — bibliography, works cited, sources, further reading.',
  'INDEX — an alphabetical index of terms with page or location numbers.',
  'GLOSSARY — defined terms, usually short alphabetical entries.',
  'PROMOTIONAL — publisher or author promotion: "also by this author", ads, review excerpts.',
  'UNKNOWN — genuinely impossible to tell from the evidence given.',
];

const SYSTEM_PROMPT = [
  'You classify the chapters of a digitised book by what each one is for.',
  '',
  'You receive one entry per chapter: a title, structural signals measured from its text, and a',
  'short sample of its words. Return one classification per chapter, echoing the numeric index',
  'exactly as given. Classify every chapter you are shown.',
  '',
  'Titles are unreliable. Many books have no usable table of contents, so a title may be missing,',
  'machine-generated, or shown as "(untitled)". A title never outweighs the sample and the signals.',
  '',
  'Judge chapters relative to one another. In most books the great majority of chapters are BODY',
  'and the apparatus is a handful of outliers at the start and end. If thirty chapters look alike',
  'and three do not, the thirty are the body.',
  '',
  'Reading the signals:',
  '- words / blocks / median — body prose runs long paragraphs; reference material runs short entries.',
  '- digits — bibliographies, indexes and endnotes are numerically dense; prose is not.',
  '- links — a contents page is almost entirely links.',
  '- pos — position through the book; front matter clusters at the start, apparatus at the end.',
  '',
  'Purposes:',
  ...PURPOSE_DEFINITIONS.map((definition) => `- ${definition}`),
  '',
  'Use confidence "low" when the evidence is thin or conflicting. A low-confidence chapter is',
  'treated as readable text downstream, so prefer "low" over a confident guess.',
].join('\n');

export function buildChapterPurposePrompt(input: {
  allTitles?: string[];
  authors: string[];
  bookTitle: string;
  digests: ChapterDigest[];
  totalChapters: number;
}) {
  const sections: string[] = [];
  const meta = [input.bookTitle, input.authors.join(', ')]
    .filter((part) => part.length > 0)
    .join(' — ');

  sections.push(`Book: ${meta}\nChapters: ${input.totalChapters}`);

  // Only sent when a book is large enough to split across requests — for a
  // single-batch book the titles are already in the digests below.
  if (input.allTitles && input.allTitles.length > 0) {
    sections.push(
      `Every chapter title in order:\n${input.allTitles
        .map((title, index) => `[${index}] ${title}`)
        .join('\n')}`,
    );
  }

  sections.push(
    `Chapters to classify:\n\n${input.digests.map(renderDigest).join('\n\n')}`,
  );

  return { prompt: sections.join('\n\n'), system: SYSTEM_PROMPT };
}

function renderDigest(digest: ChapterDigest): string {
  const { signals } = digest;
  const stats = [
    `${signals.wordCount} words`,
    `${signals.blockCount} blocks`,
    `median ${signals.medianBlockWords}`,
    `digits ${signals.digitPercent}%`,
    `links ${signals.linkCount}`,
    `headings ${signals.headingCount}`,
    `images ${signals.imageCount}`,
    `pos ${signals.positionPercent}%`,
  ].join(' · ');

  return `[${digest.index}] "${sanitize(digest.title)}" · ${stats}\n"""${sanitize(
    digest.sample,
  )}"""`;
}

// Chapter text is untrusted: it comes from whatever EPUB was imported. A book
// containing the fence would otherwise close its own quoted block and have the
// rest of its words read as instructions.
function sanitize(text: string): string {
  return text.replace(/"{3,}/g, '"');
}
