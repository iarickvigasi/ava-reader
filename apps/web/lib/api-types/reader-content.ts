import type { ListGroup, Style, TextValue } from "./canonical-reader.generated";

export type ReaderLinkTarget = {
  chapterId: string;
  blockId: string;
  textOffset: number;
  note?: boolean;
};
export type ReaderInline =
  | {
      kind: "text";
      text: string;
      bold?: boolean;
      fontWeight?: number;
      href?: string;
      italic?: boolean;
      script?: "super" | "sub";
      presentation?: Style;
      target?: ReaderLinkTarget;
      spanId?: string;
      sourceOffset?: number;
    }
  | {
      kind: "image";
      alt: string | null;
      href?: string;
      naturalWidth?: number | null;
      src: string;
    };
export type ReaderBlockAlign = "left" | "center" | "right" | "justify";
export type ReaderBlockBase = {
  canonical?: boolean;
  id: string;
  text: string;
  anchorId?: string | null;
  align?: ReaderBlockAlign;
  fontSizeScale?: number;
  fontWeight?: number;
  textIndent?: number;
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
  returns?: { label: string; target: ReaderLinkTarget }[];
};
export type ReaderTableCell = ReaderBlockBase & {
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
