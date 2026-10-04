import type {
  ListGroup,
  NoteRole,
  Style,
  TextValue,
} from "./canonical-reader.generated";
import type { ReaderInline, ReaderLinkTarget } from "./reader-inlines";

export type ReaderBlockAlign = "left" | "center" | "right" | "justify";
export type ReaderBlockBase = {
  canonical?: boolean;
  id: string;
  text: string;
  anchorId?: string | null;
  anchorIds?: string[];
  sourceAnchors?: { id: string; textOffset: number }[];
  align?: ReaderBlockAlign;
  fontSizeScale?: number;
  fontWeight?: number;
  textIndent?: number;
  preserveWhitespace?: boolean;
  presentation?: Style;
  canonicalText?: TextValue;
};
export type ReaderListItem = ReaderBlockBase & {
  inlines: ReaderInline[];
  children?: ReaderListBlock[];
};
export type ReaderListBlock = ReaderBlockBase & {
  kind: "list";
  ordered: boolean;
  markerStyle?: ListGroup["marker_style"];
  start?: number;
  items: ReaderListItem[];
  canonical?: boolean;
};
export type ReaderTextBlock = ReaderBlockBase & {
  kind:
    | "paragraph"
    | "blockquote"
    | "aside"
    | "caption"
    | "credit"
    | "verse"
    | "code"
    | "note";
  inlines: ReaderInline[];
  noteRole?: NoteRole;
  returns?: { label: string; target: ReaderLinkTarget }[];
};
export type ReaderTableCell = ReaderBlockBase & {
  rowSpan?: number;
  columnSpan?: number;
  row: number;
  column: number;
  headerAxis?: "row" | "column" | "both" | null;
  headerIds: string[];
  inlines: ReaderInline[];
};
export type ReaderBlock =
  | ReaderTextBlock
  | ReaderListBlock
  | (ReaderBlockBase & {
      kind: "heading";
      level: number;
      inlines: ReaderInline[];
    })
  | (ReaderBlockBase & {
      kind: "image";
      alt: string | null;
      src: string;
      resourceId?: string;
      href?: string;
      target?: ReaderLinkTarget;
      sourceOffset?: number;
      captionId?: string | null;
      creditId?: string | null;
      width?: number;
      height?: number;
    })
  | (ReaderBlockBase & {
      kind: "table";
      cells: ReaderTableCell[];
      captionId?: string | null;
    })
  | (ReaderBlockBase & { kind: "separator" });
