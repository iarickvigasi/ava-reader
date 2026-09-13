import { parseFragment } from "parse5";

export function readDescriptionFragment(source: string) {
  const fragment = parseFragment(source);
  if (fragment.childNodes.some((node) => "tagName" in node)) return fragment;

  const decoded = fragment.childNodes
    .map((node) => ("value" in node ? node.value : ""))
    .join("");
  // Some EPUBs encode the entire HTML fragment twice. Recognize only a whole
  // encoded fragment, and unwrap once; escaped tags inside prose remain text.
  const encodedFragment = /^\s*<(?:p|div|blockquote|ul|ol|b|strong|i|em|span|font|br)\b[\s\S]*>\s*$/i;
  return encodedFragment.test(decoded) ? parseFragment(decoded) : fragment;
}
