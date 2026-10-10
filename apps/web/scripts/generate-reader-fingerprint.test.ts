import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it } from "vitest";

it("keeps source identity stable across precache builds and binds real source changes", () => {
  const root = mkdtempSync(join(tmpdir(), "ava-reader-fingerprint-"));
  const web = join(root, "apps/web");
  const script = join(web, "scripts/generate-reader-fingerprint.mjs");
  const source = join(web, "app/page.tsx");
  const precache = join(web, "public/precache-assets.json");
  const manifest = join(root, "manifest.json");
  const put = (path: string, value: string) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, value);
  };
  const generate = (qa = "0") => {
    execFileSync(process.execPath, [script, "--manifest", manifest], {
      env: { ...process.env, NEXT_PUBLIC_AVA_READER_QA: qa },
    });
    return JSON.parse(readFileSync(manifest, "utf8")) as {
      fingerprint: string;
      files: Record<string, string>;
    };
  };
  try {
    put(
      script,
      readFileSync(
        join(process.cwd(), "scripts/generate-reader-fingerprint.mjs"),
        "utf8",
      ),
    );
    put(join(root, "pnpm-lock.yaml"), "lockfileVersion: 9.0");
    put(source, "export default function Page() { return null; }");
    mkdirSync(join(web, "features/reader/canonical"), { recursive: true });
    const before = generate();
    put(precache, '["/_next/static/first-build.js"]');
    const firstBuild = generate();
    put(precache, '["/_next/static/second-build.js"]');
    const secondBuild = generate();
    expect(firstBuild.fingerprint).toBe(before.fingerprint);
    expect(secondBuild.fingerprint).toBe(before.fingerprint);
    expect(secondBuild.files).not.toHaveProperty(
      "apps/web/public/precache-assets.json",
    );
    expect(secondBuild.files).toHaveProperty("apps/web/app/page.tsx");
    expect(secondBuild.files).toHaveProperty(
      "apps/web/scripts/generate-reader-fingerprint.mjs",
    );
    put(
      source,
      "export default function Page() { return <p>Changed source</p>; }",
    );
    const changed = generate();
    expect(changed.fingerprint).not.toBe(before.fingerprint);
    const qaFile = join(web, "features/reader/qa/build-config.ts");
    expect(readFileSync(qaFile, "utf8")).toContain("READER_QA_ENABLED = false");
    const instrumented = generate("1");
    expect(instrumented.fingerprint).not.toBe(changed.fingerprint);
    expect(instrumented.files).toHaveProperty(
      "apps/web/features/reader/qa/build-config.ts",
    );
    expect(readFileSync(qaFile, "utf8")).toContain("READER_QA_ENABLED = true");
    const check = (qa: string) =>
      execFileSync(process.execPath, [script, "--check"], {
        env: { ...process.env, NEXT_PUBLIC_AVA_READER_QA: qa },
        stdio: "pipe",
      });
    expect(() => check("0")).toThrow();
    expect(() => check("1")).not.toThrow();
    expect(generate().fingerprint).toBe(changed.fingerprint);
    expect(readFileSync(qaFile, "utf8")).toContain("READER_QA_ENABLED = false");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
