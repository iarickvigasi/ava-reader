import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReaderInline } from "@/lib/api-types";
import { ReaderInlineContent } from "./reader-inline-content";

function render(inlines: ReaderInline[]) {
  return renderToStaticMarkup(<ReaderInlineContent inlines={inlines} />);
}

describe("ReaderInlineContent", () => {
  it("raises a superscript run so an exponent reads as a power", () => {
    const html = render([
      { kind: "text", text: "10" },
      { kind: "text", script: "super", text: "500" },
    ]);

    expect(html).toMatch(/<sup[^>]*>(?:(?!<\/sup>).)*500/);
    expect(html).not.toMatch(/<sup[^>]*>(?:(?!<\/sup>).)*10</);
  });

  it("lowers a subscript run", () => {
    const html = render([{ kind: "text", script: "sub", text: "2" }]);

    expect(html).toMatch(/<sub[^>]*>(?:(?!<\/sub>).)*2/);
  });

  it("leaves a baseline run unwrapped", () => {
    const html = render([{ kind: "text", text: "10500" }]);

    expect(html).not.toContain("<sup");
    expect(html).not.toContain("<sub");
    expect(html).toContain("10500");
  });

  it("keeps a superscript footnote marker linked", () => {
    const html = render([
      { href: "#fn1", kind: "text", script: "super", text: "1" },
    ]);

    expect(html).toContain("<sup");
    expect(html).toContain('href="#fn1"');
  });

  it("keeps bold styling inside a superscript", () => {
    const html = render([
      { bold: true, kind: "text", script: "super", text: "500" },
    ]);

    expect(html).toContain("<sup");
    expect(html).toContain("font-bold");
  });
});
