/**
 * Compile parsed CSS rules into the hint shape the block normalizer
 * cares about: per-tag and per-class lookups for the three properties
 * we render (text-align, font-size, text-indent).
 *
 * Cascade is approximated as document order — later rules win, mirroring
 * how flat publisher EPUB stylesheets are usually written. Specificity
 * is intentionally ignored; for the simple selectors we accept (class,
 * tag, tag.class collapsed to class) it would buy nothing but bugs.
 */

import {
  parseStylesheet,
  type CssRule,
  type SimpleSelector,
} from './parse-stylesheet';
import { resolveFontSizeScale } from '../blocks/font-size';
import { resolveFontWeightValue } from '../blocks/font-weight';
import { resolveTextAlignFromStyle } from '../blocks/text-align';
import { resolveTextIndentValue } from '../blocks/text-indent';
import type { ReaderTextAlign } from '../blocks/text-align';

export type StylesheetClassHints = {
  align?: ReaderTextAlign;
  fontSizeScale?: number;
  fontWeight?: number;
  textIndent?: number;
};

export type StylesheetHintMap = {
  classHints: Map<string, StylesheetClassHints>;
  tagHints: Map<string, StylesheetClassHints>;
};

export function createEmptyStylesheetHintMap(): StylesheetHintMap {
  return {
    classHints: new Map(),
    tagHints: new Map(),
  };
}

export function buildStylesheetHintMap(
  cssTexts: ReadonlyArray<string>,
): StylesheetHintMap {
  const map = createEmptyStylesheetHintMap();

  for (const css of cssTexts) {
    const rules = parseStylesheet(css);
    for (const rule of rules) {
      ingestRule(rule, map);
    }
  }

  return map;
}

export function mergeStylesheetClassHints(
  base: StylesheetClassHints | undefined,
  overlay: StylesheetClassHints | undefined,
): StylesheetClassHints | undefined {
  if (!base) return overlay;
  if (!overlay) return base;
  return {
    align: overlay.align ?? base.align,
    fontSizeScale: overlay.fontSizeScale ?? base.fontSizeScale,
    fontWeight: overlay.fontWeight ?? base.fontWeight,
    textIndent: overlay.textIndent ?? base.textIndent,
  };
}

function ingestRule(rule: CssRule, map: StylesheetHintMap): void {
  const declared = extractDeclaredHints(rule.declarations);
  if (!declared) {
    return;
  }

  for (const selector of rule.selectors) {
    applyDeclaredHints(map, selector, declared);
  }
}

function applyDeclaredHints(
  map: StylesheetHintMap,
  selector: SimpleSelector,
  declared: StylesheetClassHints,
): void {
  const target =
    selector.kind === 'class'
      ? upsert(map.classHints, selector.className)
      : upsert(map.tagHints, selector.tagName);

  // Last-rule-wins: explicit declarations from this rule overwrite
  // anything an earlier rule for the same selector set.
  if (declared.align !== undefined) target.align = declared.align;
  if (declared.fontSizeScale !== undefined) {
    target.fontSizeScale = declared.fontSizeScale;
  }
  if (declared.textIndent !== undefined)
    target.textIndent = declared.textIndent;
  if (declared.fontWeight !== undefined)
    target.fontWeight = declared.fontWeight;
}

function upsert<K>(
  map: Map<K, StylesheetClassHints>,
  key: K,
): StylesheetClassHints {
  let entry = map.get(key);
  if (!entry) {
    entry = {};
    map.set(key, entry);
  }
  return entry;
}

function extractDeclaredHints(
  declarations: Record<string, string>,
): StylesheetClassHints | null {
  const hints: StylesheetClassHints = {};
  let saw = false;

  const alignValue = declarations['text-align'];
  if (alignValue !== undefined) {
    const align = resolveTextAlignFromStyle(`text-align: ${alignValue}`);
    if (align) {
      hints.align = align;
      saw = true;
    }
  }

  const fontSizeValue = declarations['font-size'];
  if (fontSizeValue !== undefined) {
    const fontSizeScale = resolveFontSizeScale(fontSizeValue.toLowerCase());
    if (fontSizeScale !== null) {
      hints.fontSizeScale = fontSizeScale;
      saw = true;
    }
  }

  const textIndentValue = declarations['text-indent'];
  if (textIndentValue !== undefined) {
    const textIndent = resolveTextIndentValue(textIndentValue.toLowerCase());
    if (textIndent !== null) {
      hints.textIndent = textIndent;
      saw = true;
    }
  }

  const fontWeightValue = declarations['font-weight'];
  if (fontWeightValue !== undefined) {
    const fontWeight = resolveFontWeightValue(fontWeightValue.toLowerCase());
    if (fontWeight !== null) {
      hints.fontWeight = fontWeight;
      saw = true;
    }
  }

  return saw ? hints : null;
}
