import { cpSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

const [service, destination] = process.argv.slice(2);
if (!["api", "catalog"].includes(service) || !destination) {
  throw new Error(
    "Use prepare-runtime-dependencies.mjs api|catalog destination",
  );
}
const modules = join(destination, "node_modules");
if (service === "api") {
  // Prisma generates outside the package tarball; deploy intentionally skips install scripts.
  const require = createRequire(resolve("apps/api/package.json"));
  const client = dirname(require.resolve("@prisma/client/package.json"));
  cpSync(resolve(client, "../../.prisma"), join(modules, ".prisma"), {
    recursive: true,
  });
}
// The locked Prisma client brings optional build-time peers into its production closure.
// Keep native/other optional dependencies, but do not ship the CLI or TypeScript compiler.
const store = join(modules, ".pnpm");
for (const name of readdirSync(store)) {
  if (name.startsWith("prisma@") || name.startsWith("typescript@")) {
    rmSync(join(store, name), { recursive: true, force: true });
  }
}
