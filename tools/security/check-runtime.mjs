import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const status = readFileSync("/proc/1/status", "utf8");
if (
  process.getuid() !== 10001 ||
  !/^CapEff:\s+0+$/m.test(status) ||
  !/^NoNewPrivs:\s+1$/m.test(status)
)
  throw new Error("Runtime UID/capability/privilege restrictions failed");
const temporary = `/tmp/ava-security-smoke-${process.pid}`;
writeFileSync(temporary, "ok");
unlinkSync(temporary);
let blocked = false;
try {
  writeFileSync("/app/ava-security-smoke", "unsafe");
} catch (error) {
  if (error.code !== "EROFS") throw error;
  blocked = true;
}
if (!blocked) throw new Error("Application filesystem was writable");
console.log("Runtime identity, privileges and filesystem checks passed");
