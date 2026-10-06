import { semanticRole } from './semantic-role';
import {
  findFirstNodeByTag,
  orderedXmlParser,
  type OrderedNode,
} from '../xml-utils';
import type { EdgeRole, SourceSection } from './types';

// Positive evidence only. A short, untitled story is never front/back matter.
export function classifyDocument(xml: string, labels: string[]): SourceSection {
  const body = findFirstNodeByTag(
    orderedXmlParser.parse(xml) as OrderedNode[],
    'body',
  );
  if (!body) return { role: 'unknown', evidence: 'no body' };
  if (labels.some((label) => /^(table of )?contents$/i.test(label.trim())))
    return result('contents', 'authored contents destination');
  const semantic = semanticRole(body);
  if (semantic !== 'unknown')
    return result(semantic, 'semantic type covers document content');
  for (const label of labels) {
    const name = label.trim().toLowerCase().replace(/[’']/g, '');
    if (/^(table of )?contents$/.test(name)) return result('contents', label);
    if (
      /^(cover|title page|half title|copyright|dedication|epigraph)$/.test(
        name,
      ) ||
      /^also by\b/.test(name)
    )
      return result('front', label);
    if (
      /^(notes|endnotes|bibliography|index|glossary|acknowledg(e)?ments|about the author|afterword|appendix|colophon)$/.test(
        name,
      ) ||
      /^whats next on\s+your reading list\??$/.test(name)
    )
      return result('back', label);
  }
  return result('unknown', 'no positive edge evidence');
}

function result(role: EdgeRole, evidence: string): SourceSection {
  return { role, evidence };
}
