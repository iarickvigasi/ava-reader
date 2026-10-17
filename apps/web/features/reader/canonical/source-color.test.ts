import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sourceForeground, sourceBackgroundInk } from "./source-color";

// Independent WCAG contrast oracle against the actual declared CSS tokens.
const css = readFileSync(
  new URL("../../../app/globals.css", import.meta.url),
  "utf8",
);
const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));
const token = (section: string, name: string) => {
  const value = section.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))?.[1];
  if (!value) throw Error(`Missing palette ${name}`);
  return value;
};
const luminance = (hex: string) => {
  const channels = hex
    .slice(1)
    .match(/../g)!
    .map((part) => parseInt(part, 16) / 255);
  const linear = channels.map((x) =>
    x < 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4),
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};
const contrast = (a: string, b: string) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);
const colors = [
  "apricot",
  "mimosa",
  "jade",
  "sky",
  "lavender",
  "rose",
  "mauve",
];

describe("reader source foreground projection", () => {
  it("retains each exact light-mode color and makes the night projection legible", () => {
    const backgrounds = [
      "paper",
      "paper-strong",
      "surface-strong",
      ...colors.map((c) => `highlight-${c}`),
    ].map((name) => token(dark, name));
    for (const color of [
      "#000000",
      "#231f20",
      "#123456",
      "#1f3763",
      "#ffffff",
      "#ffff00",
      "#0000ff",
      "#ff0000",
      "#00ff00",
      "#ff00ff",
    ]) {
      const projected = sourceForeground(color).match(
        /^light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)$/,
      )!;
      expect(projected[1]).toBe(color);
      for (const background of backgrounds)
        expect(contrast(projected[2], background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(sourceForeground("#ffffff")).toBe("light-dark(#ffffff, #ffffff)");
  });
  it("keeps every themed user highlight readable and supplies source-island fallbacks", () => {
    for (const palette of [css, dark])
      for (const color of colors) {
        expect(
          contrast(token(palette, "ink"), token(palette, `highlight-${color}`)),
        ).toBeGreaterThanOrEqual(4.5);
      }
    for (const background of [
      "#000000",
      "#123456",
      "#ffffff",
      "#ffff00",
      "#808080",
    ]) {
      expect(
        contrast(sourceBackgroundInk(background), background),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
