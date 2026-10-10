// Offline microbenchmark: no services, provider calls or source text output.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = process.argv[2];
const output = process.argv[3];
if (!fixture || !output)
  throw new Error(
    "Usage: node benchmark-canonical-inlines.mjs <accepted-reader.json> <metadata-report.json>",
  );
const bytes = fs.readFileSync(fixture);
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (
  sha256 !== "9debb8ffeba42f740c037a430e92e5222a8a823def08192f98f1cdd0688c8d4f"
)
  throw new Error("Unexpected benchmark fixture");
const book = JSON.parse(bytes).book;
const inputDigest = () =>
  createHash("sha256").update(JSON.stringify(book)).digest("hex");
const before = inputDigest();
const server = await createServer({
  root,
  configFile: path.join(root, "vitest.config.ts"),
  envFile: false,
  server: { middlewareMode: true, ws: false, watch: null },
  appType: "custom",
});
try {
  const { canonicalInlines, canonicalTarget } = await server.ssrLoadModule(
    "/features/reader/canonical/inlines.ts",
  );
  const { indexCanonicalBook } = await server.ssrLoadModule(
    "/features/reader/canonical/index-book.ts",
  );
  const { canonicalStyle } = await server.ssrLoadModule(
    "/features/reader/canonical/style.ts",
  );
  const { splitAtBreakOpportunities } = await server.ssrLoadModule(
    "/features/reader/break-opportunities.ts",
  );
  const breakOffsets = (inlines) => {
    const offsets = [];
    let position = 0;
    for (const inline of inlines) {
      const parts = splitAtBreakOpportunities(inline.text);
      parts.forEach((part, index) => {
        position += part.length;
        if (index < parts.length - 1) offsets.push(position);
      });
    }
    return offsets;
  };
  let changedBreakNodes = 0;
  const styles = indexCanonicalBook(book).styles;
  const semanticRuns = (inlines, parent) => {
    const inherited = canonicalStyle(parent.presentation);
    const output = [];
    for (const inline of inlines) {
      const css = canonicalStyle(inline.presentation);
      const script = ["super", "sub"].includes(
        inline.presentation?.vertical_align,
      )
        ? inline.presentation.vertical_align
        : null;
      const effective = {
        fontWeight:
          inherited.fontWeight ?? (parent.kind === "heading" ? 700 : 400),
        fontStyle:
          inherited.fontStyle ??
          (parent.kind === "quote" ? "italic" : "normal"),
        fontVariant: inherited.fontVariant ?? "normal",
        fontFamily:
          parent.kind === "code"
            ? "monospace"
            : (inherited.fontFamily ?? "reader-default"),
        color: inherited.color ?? "reader-theme",
        ...css,
        fontSize: inline.presentation?.relative_size ?? (script ? 0.75 : 1),
        verticalAlign:
          script ??
          (css.verticalAlign === "baseline" ? undefined : css.verticalAlign),
      };
      const key = JSON.stringify([
        Object.entries(effective)
          .filter(([, value]) => value !== undefined)
          .sort(([a], [b]) => a.localeCompare(b)),
        inline.language,
        inline.href,
        inline.target,
        inline.spanId,
        inline.target || inline.href ? inline.sourceOffset : null,
      ]);
      const prior = output.at(-1);
      if (prior?.key === key) prior.units += inline.text.length;
      else output.push({ key, units: inline.text.length });
    }
    return output;
  };
  const nodes = book.blocks.flatMap((block) =>
    block.kind === "table"
      ? block.cells.map((cell) => ({
          content: cell.content,
          chapterBlockId: block.id,
          parent: {
            kind: "table-cell",
            presentation: styles.get(cell.style_id),
          },
        }))
      : block.content
        ? [
            {
              content: block.content,
              chapterBlockId: block.id,
              parent: {
                kind: block.kind,
                presentation: styles.get(block.style_id),
              },
            },
          ]
        : [],
  );
  let scans = 0;
  // Frozen 286f2069 algorithm, including stable overlap priority/null handling.
  const baseline = (content, targetBook = book, targetStyles = styles) => {
    const spans = content.spans ?? [];
    const edges = [
      ...new Set([
        0,
        content.codepoint_utf16.length - 1,
        ...spans.flatMap((span) => [span.start, span.end]),
      ]),
    ].sort((a, b) => a - b);
    scans += spans.length * (edges.length - 1);
    return edges.slice(0, -1).map((start, index) => {
      const end = edges[index + 1];
      const active = spans
        .filter((span) => span.start <= start && span.end >= end)
        .sort((a, b) => a.start - b.start || b.end - a.end);
      const presentation = active.reduce(
        (style, span) => ({
          ...style,
          ...Object.fromEntries(
            Object.entries(
              span.style_id ? (targetStyles.get(span.style_id) ?? {}) : {},
            ).filter(([, value]) => value != null),
          ),
        }),
        { id: "inline" },
      );
      const linked = active.findLast((span) => span.link);
      return {
        kind: "text",
        text: content.text.slice(
          content.codepoint_utf16[start],
          content.codepoint_utf16[end],
        ),
        presentation,
        ...(content.language ? { language: content.language } : {}),
        sourceOffset: content.codepoint_utf16[linked?.start ?? start],
        spanId: linked?.id,
        ...(linked?.link?.kind === "external"
          ? { href: linked.link.url }
          : linked?.link
            ? { target: canonicalTarget(targetBook, linked.link) }
            : {}),
      };
    });
  };
  for (const node of nodes) {
    const old = baseline(node.content);
    const actual = canonicalInlines(book, node.content, node.parent);
    if (
      JSON.stringify(breakOffsets(old)) !== JSON.stringify(breakOffsets(actual))
    )
      changedBreakNodes += 1;
    if (
      JSON.stringify(semanticRuns(old, node.parent)) !==
      JSON.stringify(semanticRuns(actual, node.parent))
    )
      throw new Error("Flattened formatting conservation failed");
  }
  scans = 0;
  const run = (project) =>
    nodes.map((node) => {
      const inlines = project(node);
      if (inlines.map((inline) => inline.text).join("") !== node.content.text)
        throw new Error("Text conservation failed");
      return inlines.length;
    });
  const oldCounts = run((node) => baseline(node.content));
  const baselineScans = scans;
  let styleLookups = 0;
  const get = styles.get.bind(styles);
  styles.get = (key) => {
    styleLookups += 1;
    return get(key);
  };
  const newCounts = run((node) =>
    canonicalInlines(book, node.content, node.parent),
  );
  delete styles.get;
  const timings = (project) => {
    run(project);
    const samples = [];
    for (let sample = 0; sample < 5; sample += 1) {
      const started = performance.now();
      run(project);
      samples.push(Number((performance.now() - started).toFixed(3)));
    }
    return {
      milliseconds: samples,
      median_ms: [...samples].sort((a, b) => a - b)[2],
    };
  };
  const windowMaximum = (counts) => {
    const byBlock = new Map();
    nodes.forEach((node, index) =>
      byBlock.set(
        node.chapterBlockId,
        (byBlock.get(node.chapterBlockId) ?? 0) + (counts[index] ?? 0),
      ),
    );
    const chapters = book.spine.map((id) =>
      book.chapters
        .find((chapter) => chapter.id === id)
        .block_ids.reduce((sum, id) => sum + (byBlock.get(id) ?? 0), 0),
    );
    return Math.max(
      ...chapters.map((_, index) =>
        chapters
          .slice(Math.max(0, index - 1), index + 2)
          .reduce((sum, count) => sum + count, 0),
      ),
    );
  };
  const stressBook = {
    ...book,
    addresses: [],
    blocks: [],
    chapters: [],
    lists: [],
    resources: [],
    styles: [
      {
        id: "stress-parent",
        bold: true,
        italic: true,
        family: "serif",
        color: "#123456",
      },
      { id: "reset", bold: false, italic: null, relative_size: 0 },
      { id: "emphasis", italic: false, small_caps: true, relative_size: 1 },
    ],
  };
  const stressStyles = indexCanonicalBook(stressBook).styles;
  const parent = { kind: "paragraph", presentation: stressBook.styles[0] };
  const stress = [
    {
      name: "disjoint-2000",
      length: 4000,
      spans: Array.from({ length: 2000 }, (_, i) => ({
        id: `span-${i}`,
        start: i * 2,
        end: i * 2 + 1,
        style_id: "reset",
      })),
    },
    {
      name: "nested-128",
      length: 256,
      spans: Array.from({ length: 128 }, (_, i) => ({
        id: `span-${i}`,
        start: i,
        end: 256 - i,
        style_id: i % 2 ? "reset" : "emphasis",
      })),
    },
    {
      name: "stable-ties-512",
      length: 512,
      spans: Array.from({ length: 512 }, (_, i) => ({
        id: `span-${i}`,
        start: 0,
        end: 512,
        style_id: i % 2 ? "reset" : "emphasis",
      })),
    },
  ].map(({ name, length, spans }) => {
    const content = {
      text: "x".repeat(length),
      codepoint_utf16: Array.from({ length: length + 1 }, (_, i) => i),
      sha256: "0".repeat(64),
      spans,
    };
    scans = 0;
    const started = performance.now();
    const old = baseline(content, stressBook, stressStyles);
    const oldMs = performance.now() - started;
    const second = performance.now();
    const actual = canonicalInlines(stressBook, content, parent);
    const newMs = performance.now() - second;
    const equivalent =
      JSON.stringify(semanticRuns(old, parent)) ===
      JSON.stringify(semanticRuns(actual, parent));
    if (
      !equivalent ||
      actual.map((inline) => inline.text).join("") !== content.text
    )
      throw new Error("Stress conservation failed");
    return {
      name,
      spans: spans.length,
      baseline_fragments: old.length,
      candidate_fragments: actual.length,
      baseline_filter_visits: scans,
      baseline_ms: Number(oldMs.toFixed(3)),
      candidate_ms: Number(newMs.toFixed(3)),
      flattened_semantics_equal: equivalent,
    };
  });
  const report = {
    fixture_bytes: bytes.length,
    fixture_sha256: sha256,
    text_nodes: nodes.length,
    spans: nodes.reduce(
      (sum, node) => sum + (node.content.spans?.length ?? 0),
      0,
    ),
    baseline: {
      fragments: oldCounts.reduce((a, b) => a + b, 0),
      max_three_chapter_fragments: windowMaximum(oldCounts),
      inactive_and_active_span_filter_visits: baselineScans,
      ...timings((node) => baseline(node.content)),
    },
    candidate: {
      fragments: newCounts.reduce((a, b) => a + b, 0),
      max_three_chapter_fragments: windowMaximum(newCounts),
      span_style_lookups: styleLookups,
      inactive_span_filter_visits: 0,
      ...timings((node) => canonicalInlines(book, node.content, node.parent)),
    },
    flattened_semantics_equal: true,
    nodes_with_changed_break_opportunities: changedBreakNodes,
    stress_cases: stress,
    concurrency: process.env.AVA_BENCHMARK_CONCURRENCY ?? "unspecified",
    text_and_input_digest_preserved: before === inputDigest(),
    conditions: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      samples: 5,
      index_reused: true,
    },
    limits:
      "Offline warm derivation microbenchmark with UTF16 text and flattened CSS/caller checks, active heavily overlapping cascades can still be quadratic, not DOM count, endpoint/cold API, browser memory, RSS, pagination or device qualification. Path/ID/text/style labels are not emitted.",
  };
  if (!report.text_and_input_digest_preserved) throw new Error("Input changed");
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} finally {
  await server.close();
}
