import { describe, expect, it } from "vitest";
import { HOME_QUOTES, quoteOfTheDay } from "./home-quotes";

const MS_PER_DAY = 86_400_000;

describe("quoteOfTheDay", () => {
  it("returns the same quote for every instant within a UTC day", () => {
    const midnight = Date.UTC(2026, 7, 30);
    expect(quoteOfTheDay(midnight)).toEqual(
      quoteOfTheDay(midnight + MS_PER_DAY - 1),
    );
  });

  it("advances to the next quote on the next UTC day", () => {
    const midnight = Date.UTC(2026, 7, 30);
    expect(quoteOfTheDay(midnight)).not.toEqual(
      quoteOfTheDay(midnight + MS_PER_DAY),
    );
  });

  it("cycles through the whole list before repeating", () => {
    const cycleStart = HOME_QUOTES.length * MS_PER_DAY * 528;
    const seen = new Set(
      HOME_QUOTES.map(
        (_, day) => quoteOfTheDay(cycleStart + day * MS_PER_DAY).attribution,
      ),
    );
    expect(seen.size).toBe(HOME_QUOTES.length);
  });

  it("shuffles into a different order on the next cycle", () => {
    const cycleLength = HOME_QUOTES.length * MS_PER_DAY;
    const cycleStart = cycleLength * 528;
    const order = (start: number) =>
      HOME_QUOTES.map(
        (_, day) => quoteOfTheDay(start + day * MS_PER_DAY).attribution,
      ).join("|");
    expect(order(cycleStart)).not.toBe(order(cycleStart + cycleLength));
  });
});
