import type { Style } from "./canonical-reader.generated";

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
      language?: string;
      anchorIds?: string[];
      sourceNormalization?: { sourceText: string; boundaryUtf16: number[] };
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
      target?: ReaderLinkTarget;
      sourceOffset?: number;
      anchorIds?: string[];
      presentation?: Style;
      naturalHeight?: number | null;
      naturalWidth?: number | null;
      src: string;
    };
