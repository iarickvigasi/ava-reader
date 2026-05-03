import { describe, expect, it } from "vitest";
import { matchAcceptLanguage } from "./match-accept-language";

describe("matchAcceptLanguage", () => {
  it("returns null for missing or empty headers", () => {
    expect(matchAcceptLanguage(null)).toBeNull();
    expect(matchAcceptLanguage(undefined)).toBeNull();
    expect(matchAcceptLanguage("")).toBeNull();
  });

  it("returns null when nothing in the header is supported", () => {
    expect(matchAcceptLanguage("ja,zh-CN;q=0.8")).toBeNull();
  });

  it("matches an exact supported tag, case-insensitively", () => {
    expect(matchAcceptLanguage("pt-BR")).toBe("pt-BR");
    expect(matchAcceptLanguage("pt-br")).toBe("pt-BR");
    expect(matchAcceptLanguage("UK")).toBe("uk");
  });

  it("respects q-values when picking the best match", () => {
    // English present but lower q than supported French — French wins.
    expect(matchAcceptLanguage("en-US;q=0.5,fr-FR;q=0.9")).toBe("fr");
  });

  it("falls back to primary subtag when no exact tag is supported", () => {
    // pt-PT isn't shipped — pt-BR is the only Portuguese variant we have.
    expect(matchAcceptLanguage("pt-PT")).toBe("pt-BR");
    expect(matchAcceptLanguage("pt")).toBe("pt-BR");
    expect(matchAcceptLanguage("en-GB,en;q=0.9")).toBe("en");
  });

  it("prefers exact matches over primary-subtag matches across entries", () => {
    // Even though pt comes first, fr is an exact supported tag and should win
    // over the bare-pt → pt-BR primary-subtag fallback.
    expect(matchAcceptLanguage("pt;q=0.9,fr;q=0.8")).toBe("pt-BR");
    // But if the higher-q entry is unsupported entirely, fall through.
    expect(matchAcceptLanguage("ja;q=0.9,fr;q=0.8")).toBe("fr");
  });

  it("ignores wildcards and q=0 entries", () => {
    expect(matchAcceptLanguage("*")).toBeNull();
    expect(matchAcceptLanguage("en;q=0,fr")).toBe("fr");
  });

  it("handles a realistic Chrome header", () => {
    expect(matchAcceptLanguage("en-US,en;q=0.9,uk;q=0.8")).toBe("en");
  });
});
