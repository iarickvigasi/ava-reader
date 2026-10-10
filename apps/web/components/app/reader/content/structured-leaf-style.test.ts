import { expect, it } from "vitest";
import { structuredLeafStyle } from "./structured-leaf-style";

it("retains explicit ordinary scalar resets and recomputes leaf size from its baseline", () => {
  expect(
    structuredLeafStyle(
      {
        id: "leaf",
        text: "Text",
        fontSizeScale: 0.5,
        fontWeight: 400,
        align: "center",
        textIndent: 0,
      },
      "list",
    ),
  ).toEqual({
    "--reader-block-scale": 0.5,
    fontWeight: 400,
    textAlign: "center",
    textIndent: "0em",
    fontSize:
      "calc(var(--reader-list-base,1.12rem) * var(--reader-font-scale) * var(--reader-block-scale,1))",
  });
});
it("inherits omitted scalars and preserves canonical relative typography and false resets", () => {
  expect(structuredLeafStyle({ id: "leaf", text: "Text" }, "table")).toEqual(
    {},
  );
  expect(
    structuredLeafStyle(
      {
        id: "leaf",
        text: "Text",
        fontWeight: 700,
        presentation: {
          id: "reset",
          relative_size: 0.7,
          bold: false,
          italic: false,
          small_caps: false,
          indent_em: 0,
        },
      },
      "table",
    ),
  ).toMatchObject({
    fontWeight: 400,
    fontSize: "0.7em",
    fontStyle: "normal",
    fontVariant: "normal",
    textIndent: "0em",
  });
});
it("does not discard an explicit zero size in favor of an inherited parent variable", () => {
  expect(
    structuredLeafStyle(
      { id: "leaf", text: "Text", fontSizeScale: 0 },
      "table",
    ),
  ).toMatchObject({ "--reader-block-scale": 0 });
});
