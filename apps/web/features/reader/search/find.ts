import {
  MAX_SEARCH_QUERY,
  MAX_SEARCH_RESULTS,
  type SearchPassage,
  type SearchResults,
} from "./types";

// Unicode simple case folding keeps original UTF-16 offsets, including astral
// characters. Literal search never removes accents, changes prose or invokes AI.
export function findBookText(
  passages: SearchPassage[],
  query: string,
): SearchResults {
  const needle = query.trim();
  if (!needle || needle.length > MAX_SEARCH_QUERY)
    return { hits: [], truncated: false };
  const pattern = new RegExp(
    needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "giu",
  );
  const hits: SearchResults["hits"] = [];
  for (const passage of passages) {
    for (const match of passage.text.matchAll(pattern)) {
      if (hits.length === MAX_SEARCH_RESULTS) return { hits, truncated: true };
      hits.push({
        ...passage,
        textOffset: match.index,
        endOffset: match.index + match[0].length,
      });
    }
  }
  return { hits, truncated: false };
}

export function searchExcerpt(hit: SearchResults["hits"][number]) {
  // Slice by code points so snippet edges cannot split emoji surrogate pairs.
  let start = Math.max(0, hit.textOffset - 82);
  let end = Math.min(hit.text.length, hit.endOffset + 122);
  const lowSurrogate = (offset: number) => {
    const code = hit.text.charCodeAt(offset);
    return code >= 0xdc00 && code <= 0xdfff;
  };
  if (start > 0 && lowSurrogate(start)) start++;
  if (end < hit.text.length && lowSurrogate(end)) end--;
  const before = Array.from(hit.text.slice(start, hit.textOffset));
  const after = Array.from(hit.text.slice(hit.endOffset, end));
  return {
    before: `${start > 0 || before.length > 40 ? "…" : ""}${before.slice(-40).join("")}`,
    match: hit.text.slice(hit.textOffset, hit.endOffset),
    after: `${after.slice(0, 60).join("")}${end < hit.text.length || after.length > 60 ? "…" : ""}`,
  };
}
