// Optional read-only adapter probe; no authentication, database or library writes.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");

async function main() {
  const [root, epubPath, outputPath] = process.argv.slice(2);
  if (!root || !epubPath || !outputPath) {
    throw new Error("Usage: node probe-ava.cjs AVA_ROOT BOOK.epub REPORT.json");
  }
  const api = path.resolve(root, "apps/api");
  const local = createRequire(path.join(api, "package.json"));
  local("ts-node").register({
    transpileOnly: true,
    project: path.join(api, "tsconfig.json"),
    compilerOptions: {
      module: "CommonJS",
      moduleResolution: "Node",
      resolvePackageJsonExports: false,
      resolvePackageJsonImports: false,
    },
  });
  const metadataSource = path.join(api, "src/shared/metadata-extractor.ts");
  const parserSource = path.join(api, "src/reader/epub-reader-package.ts");
  const { extractBookMetadata } = local(metadataSource);
  const { buildReaderPackageFromEpub } = local(parserSource);
  const hash = (bytes) =>
    crypto.createHash("sha256").update(bytes).digest("hex");
  const buffer = fs.readFileSync(epubPath);
  const started = performance.now();
  const metadata = await extractBookMetadata({
    buffer,
    mimetype: "application/epub+zip",
    originalname: "book.epub",
  });
  const book = await buildReaderPackageFromEpub({
    buffer,
    checksum: hash(buffer),
    authors: metadata.authors,
    language: metadata.language,
    title: metadata.title,
  });
  const toc = [];
  const visit = (nodes) => {
    for (const node of nodes) {
      toc.push(node);
      visit(node.children || []);
    }
  };
  visit(book.toc);
  const report = {
    scope:
      "Actual AVA parser and metadata extraction only; no UI, persistence, audio or device claim.",
    epub_sha256: hash(buffer),
    parser_sha256: hash(fs.readFileSync(parserSource)),
    metadata_extractor_sha256: hash(fs.readFileSync(metadataSource)),
    wall_seconds: (performance.now() - started) / 1000,
    metadata: {
      ...metadata,
      coverImage: metadata.coverImage
        ? {
            mimeType: metadata.coverImage.mimeType,
            sha256: hash(metadata.coverImage.bytes),
            bytes: metadata.coverImage.bytes.length,
          }
        : null,
    },
    chapters: book.chapters.map((c) => ({
      href: c.href,
      label: c.label,
      blocks: c.blocks.length,
    })),
    toc_entries: toc.length,
    unresolved_toc_entries: toc.filter(
      (n) => n.href && (!n.chapterId || !n.blockId),
    ).length,
    toc: toc.map((n) => ({
      label: n.label,
      href: n.href,
      chapterId: n.chapterId,
      blockId: n.blockId,
    })),
  };
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", {
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      chapters: report.chapters.length,
      toc: report.toc_entries,
      unresolved: report.unresolved_toc_entries,
      wall_seconds: report.wall_seconds,
    }),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
