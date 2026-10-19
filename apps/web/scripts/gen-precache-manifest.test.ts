import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";

it("precaches built fonts even when the reader has not used their style yet", () => {
  const web = mkdtempSync(join(tmpdir(), "ava-font-precache-"));
  const script = join(process.cwd(), "scripts/gen-precache-manifest.mjs");
  const put = (path: string) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "fixture bytes");
  };
  try {
    mkdirSync(join(web, "public"));
    for (const name of [
      "chunks/reader.js",
      "css/reader.css",
      "media/body.woff",
      "media/unused-serif-italic.woff2",
      "media/cover.png",
      "chunks/reader.js.map",
    ]) {
      put(join(web, ".next/static", name));
    }
    put(join(web, "public/unrelated.woff2"));
    execFileSync(process.execPath, [script], { cwd: web, stdio: "pipe" });
    expect(JSON.parse(readFileSync(join(web, "public/precache-assets.json"), "utf8"))).toEqual([
      "/_next/static/chunks/reader.js",
      "/_next/static/css/reader.css",
      "/_next/static/media/body.woff",
      "/_next/static/media/unused-serif-italic.woff2",
    ]);
  } finally {
    rmSync(web, { recursive: true, force: true });
  }
});
