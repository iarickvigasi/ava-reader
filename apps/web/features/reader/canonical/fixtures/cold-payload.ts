import { canonicalFixture } from "./payload";
import source from "./cold-reader-package.json";

// Two authored intermediary chapters make the independent oracle's existing
// note chapter cold (outside ±1). This is a reader fixture, not PDF extraction.
export function coldCanonicalFixture() {
  return canonicalFixture(source);
}
