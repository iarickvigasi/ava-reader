// These bounds mirror the darkest reader palette's paper/surface and highlight
// tokens. The palette test fails if the CSS changes beyond this contrast bound.
const DARK_INK = [243, 237, 229] as const;
const DARK_BACKGROUNDS = [
  "#161a21",
  "#1d242d",
  "#212a35",
  "#573120",
  "#52401b",
  "#26483a",
  "#20415f",
  "#3a335f",
  "#572436",
  "#4d2c5b",
];
const MIN_CONTRAST = 4.5;
type Rgb = readonly number[];

function rgb(hex: string): Rgb {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

function luminance(color: Rgb): number {
  return color.reduce((sum, channel, index) => {
    const value = channel / 255;
    const linear =
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

const MIN_DARK_LUMINANCE = Math.max(
  ...DARK_BACKGROUNDS.map(
    (hex) => (luminance(rgb(hex)) + 0.05) * MIN_CONTRAST - 0.05,
  ),
);

function darkForeground(hex: string): string {
  const source = rgb(hex);
  if (luminance(source) >= MIN_DARK_LUMINANCE) return hex;
  let low = 0;
  let high = 1;
  const blend = (amount: number) =>
    source.map((channel, index) =>
      Math.round(channel + (DARK_INK[index] - channel) * amount),
    );
  for (let step = 0; step < 12; step++) {
    const middle = (low + high) / 2;
    if (luminance(blend(middle)) >= MIN_DARK_LUMINANCE) high = middle;
    else low = middle;
  }
  return `#${blend(high)
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function sourceForeground(hex: string): string {
  return `light-dark(${hex}, ${darkForeground(hex)})`;
}

export function sourceBackgroundInk(hex: string): string {
  const lightness = luminance(rgb(hex));
  return (lightness + 0.05) / 0.05 >= 1.05 / (lightness + 0.05)
    ? "#000000"
    : "#ffffff";
}
