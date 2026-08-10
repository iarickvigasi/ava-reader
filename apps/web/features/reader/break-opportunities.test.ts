import { describe, expect, it } from "vitest";
import { splitAtBreakOpportunities } from "./break-opportunities";

describe("reader break opportunities", () => {
  it("leaves ordinary prose as a single part", () => {
    expect(splitAtBreakOpportunities("Slime molds show intelligence.")).toEqual([
      "Slime molds show intelligence.",
    ]);
  });

  it("splits a long url after each punctuation run", () => {
    expect(
      splitAtBreakOpportunities("https://www.nasa.gov/feature/goddard"),
    ).toEqual(["https://", "www.", "nasa.", "gov/", "feature/", "goddard"]);
  });

  it("keeps a punctuation run whole so a scheme never splits mid-token", () => {
    expect(splitAtBreakOpportunities("archive.org/web/2020*/nasa")).toEqual([
      "archive.",
      "org/",
      "web/",
      "2020*/",
      "nasa",
    ]);
  });

  it("leaves short tokens alone so prose keeps its default breaks", () => {
    expect(splitAtBreakOpportunities("e.g. the well-known 3.5 result")).toEqual([
      "e.g. the well-known 3.5 result",
    ]);
  });

  it("never breaks between two digits", () => {
    expect(splitAtBreakOpportunities("978-0-13-235088-4")).toEqual([
      "978-0-13-235088-4",
    ]);
  });

  it("splits only the long token in a mixed line", () => {
    expect(
      splitAtBreakOpportunities("see <https://nasa.gov/dark-matter> now"),
    ).toEqual(["see <https://", "nasa.", "gov/", "dark-", "matter> now"]);
  });

  it("emits no empty part when a long token ends in punctuation", () => {
    expect(splitAtBreakOpportunities("https://nasa.gov/features/")).toEqual([
      "https://",
      "nasa.",
      "gov/",
      "features/",
    ]);
  });

  it("leaves a long word without punctuation to the css safety net", () => {
    expect(
      splitAtBreakOpportunities("Kernschmelzenüberwachungsverordnung"),
    ).toEqual(["Kernschmelzenüberwachungsverordnung"]);
  });
});
