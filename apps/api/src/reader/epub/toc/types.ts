export type ParsedTocNode = {
  children: ParsedTocNode[];
  href: string | null;
  id: string;
  label: string;
};

export type NcxNode = {
  content?: { ['@_src']?: string };
  navLabel?: { text?: string };
  navPoint?: NcxNode | NcxNode[];
};
