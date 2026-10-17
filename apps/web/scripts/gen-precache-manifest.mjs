// Post-build step for route precaching (see docs/specs/4-offline/4.5-route-precaching.md).
// Globs built scripts, styles and fonts for the service worker's activation
// precache. Unused reader font faces must be listed before going offline. Globbing the output dir avoids coupling to any Next-internal
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
  .filter((entry) => entry.isFile() && /\.(js|css|woff2?)$/.test(entry.name))
  .map((entry) => {
    const dir = entry.parentPath ?? entry.path;
    const rel = join(dir, entry.name).replace(/\\/g, "/");
    return `/${rel.replace(/^\.next\//, "_next/")}`;
  })
  .sort();

writeFileSync(OUT_FILE, `${JSON.stringify(urls)}\n`);
console.log(`[precache] wrote ${urls.length} assets → ${OUT_FILE}`);
