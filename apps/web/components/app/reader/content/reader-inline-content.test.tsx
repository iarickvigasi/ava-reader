import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ReaderInline } from "@/lib/api-types";
import { ReaderInlineContent } from "./reader-inline-content";

function render(inlines: ReaderInline[]) {
  return renderToStaticMarkup(<ReaderInlineContent inlines={inlines} />);
}

describe("ReaderInlineContent", () => {
  it("preserves passage language and exact Ukrainian characters without transliteration", () => {
    const text = "Її пам’ять: є ґанок, і пісня 😀";
    const html = render([{ kind: "text", language: "uk", text }]);
    expect(html).toContain('lang="uk"');
    expect(html).toContain(text);
    expect(
      render([{ kind: "text", language: "und", text: "Unknown" }]),
    ).toContain('lang="und"');
    expect(render([{ kind: "text", text: "Legacy" }])).not.toContain("lang=");
  });
  it("preserves source highlight and combined decorations without altering Unicode text", () => {
    const html = render([
      {
        kind: "text",
        text: "A😀B <source>",
        presentation: {
          id: "annotation",
          color: "#000000",
          background_color: "#ffff00",
          underline: true,
          strike_through: true,
        },
      },
    ]);
    expect(html).toContain("background-color:#ffff00");
    expect(html).toContain("color:#000000");
    expect(html).toContain("text-decoration-line:underline line-through");
    expect(html).toContain("A😀B &lt;source&gt;");
    expect(html).not.toContain("<img");
  });
  it("applies a canonical script baseline and explicit relative size only once", () => {
    const html = render([
      {
        kind: "text",
        text: "2",
        presentation: {
          id: "super",
          vertical_align: "super",
          relative_size: 0.7,
        },
      },
    ]);
    expect(html).toContain('<sup style="font-size:inherit">');
    expect(html).toContain("font-size:0.7em");
    expect(html).not.toContain("vertical-align:super");
  });
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
