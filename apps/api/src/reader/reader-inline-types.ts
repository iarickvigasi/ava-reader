import type { ReaderLinkTarget } from './reader-link-target';
import type { Style } from '../pdf-conversion/contracts/generated/ava-book-2';

export type ReaderInline =
  | {
      kind: 'text';
      text: string;
      language?: string;
      bold?: boolean;
      fontWeight?: number;
      href?: string;
      anchorIds?: string[];
      sourceOffset?: number;
      sourceNormalization?: { sourceText: string; boundaryUtf16: number[] };
      target?: ReaderLinkTarget;
      italic?: boolean;
      script?: 'super' | 'sub';
      presentation?: Style;
    }
  | {
      alt: string | null;
      href?: string;
      kind: 'image';
      naturalWidth?: number | null;
      naturalHeight?: number | null;
      anchorIds?: string[];
      sourceOffset?: number;
      target?: ReaderLinkTarget;
      src: string;
      presentation?: Style;
    };
