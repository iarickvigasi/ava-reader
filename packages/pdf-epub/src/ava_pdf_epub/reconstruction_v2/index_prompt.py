"""A separate task identity for source-observed index structure, not generic prose cleanup."""

from typing import Final

from .text_style_prompt import TEXT_STYLE_PROMPT

INDEX_PROMPT_VERSION: Final = "ava-prose-region-17"
INDEX_INSTRUCTIONS = """
INDEX LAYOUT: the host observed an index heading and dense two-column term/reference rows.
Inspect the image to reconstruct its actual structure; the host has NOT proved entry boundaries.
Read the complete left column top to bottom, then the complete right column. Keep any full-width
heading or introduction separate. Running titles and folios remain furniture. Never copy fused
native rows across columns as a single entry or treat this image as a numerical table.

Use one paragraph per logical index entry or subentry, with supported source indentation.
Do not invent bullets, list counters, alphabetical headings, expanded terms or destinations.
Preserve term spelling, diacritics, ligatures, punctuation and every printed reference/range.
Keep independent entries separate even when their first letter is lowercase or they lack a period.
Join wrapped term, numeric and see/see-also lines ONLY to their own entry; retain hanging indents
and distinguish a wrapped continuation from an indented new subentry. Do not merge a parent and
its separate subentries into a prose paragraph. Preserve visible bold/italic/reset runs in spans,
including chapter references printed bold. A term's italic style is not evidence of quotation.
Use ordinary paragraph kind for entries; preserve their alignment, block_indent_em and indent_em.
An entry can continue at a crop/column edge only when the image supplies that evidence. Otherwise
both continuation flags are false. If hierarchy, grouping or transcription is essentially uncertain,
report unresolved rather than flatten, invent text or silently discard a reference.
"""
INDEX_PROMPT = TEXT_STYLE_PROMPT + INDEX_INSTRUCTIONS
