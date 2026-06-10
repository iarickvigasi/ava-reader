// Post-build step for route precaching (see docs/specs/14-route-precaching.md).
// Globs the built static output and writes a flat list of asset URLs the
// service worker precaches on activate, so every route's JS/CSS chunks are
// present offline. Globbing the output dir avoids coupling to any Next-internal
// manifest shape. Runs from the web package root (cwd = apps/web).

import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STATIC_DIR = ".next/static";
const OUT_FILE = "public/precache-assets.json";

if (!existsSync(STATIC_DIR)) {
  console.error(`[precache] ${STATIC_DIR} missing — run \`next build\` first.`);
  process.exit(1);
}

const urls = readdirSync(STATIC_DIR, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(js|css)$/.test(entry.name))
  .map((entry) => {
    const dir = entry.parentPath ?? entry.path;
    const rel = join(dir, entry.name).replace(/\\/g, "/");
    return `/${rel.replace(/^\.next\//, "_next/")}`;
  })
  .sort();

writeFileSync(OUT_FILE, `${JSON.stringify(urls)}\n`);
console.log(`[precache] wrote ${urls.length} assets → ${OUT_FILE}`);
