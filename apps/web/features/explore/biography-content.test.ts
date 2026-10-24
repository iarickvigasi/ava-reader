import { expect, it } from "vitest";
import { biographyContent } from "./biography-content";

it("extracts source definitions and resolves named references without exposing raw URLs", () => {
  const content = biographyContent(
    "A biography ([Source][1].)\n\n[1]: http://lewiscarrollsociety.org.uk/pages/lewiscarroll/life.html",
  );
  expect(content.text).toBe("A biography");
  expect(content.sources).toEqual([
    "http://lewiscarrollsociety.org.uk/pages/lewiscarroll/life.html",
  ]);
  expect(content.text).not.toContain("http");
});
it("keeps unknown references as plain text and never creates executable links", () => {
  const content = biographyContent(
    "[Source][1]\n[1]: javascript:alert(1)\n<script>alert(1)</script>",
  );
  expect(content.sources).toEqual([]);
  expect(content.text).toContain("[Source][1]");
});
