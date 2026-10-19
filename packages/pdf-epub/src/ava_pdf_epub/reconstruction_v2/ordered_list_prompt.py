"""Require observed ordinals on each ordered item, preserving historical prompt bytes."""

from .recognition_prompt import PINNED_UNICODE_PROMPT, UNICODE_STYLE_PROMPT

ORDERED_LIST_INSTRUCTIONS = """
ORDERED LIST OBSERVATIONS:
For EVERY list_item, return list_ordered and observed list_depth (1..3).
Ordered markers include decimal numbers, alphabetic letters, and Roman numerals.
For EVERY ordered item, list_start is the integer ordinal of THAT visible marker,
not the list's initial value: 0. -> 0, 1. -> 1, 2. -> 2; a. -> 1, b. -> 2;
A) -> 1, B) -> 2; i. -> 1, ii. -> 2, iii. -> 3; IV) -> 4, V) -> 5.
Interpret letters versus Roman numerals from the visible source sequence/context.
Never return null list_start for an ordered item, including nested items and
continuations across page/region boundaries. Never reset or invent numbering.
Keep the printed marker, its punctuation, and item text exactly in text. Preserve
observed nesting: outer 1./2. at depth 1, nested a./b. at depth 2 use ordinals 1/2.
Unordered bullets have list_ordered=false and list_start=null. Other kinds keep
list_ordered/list_start/list_depth null. If an essential marker, ordinal, or depth
cannot be read reliably, report the region in unresolved. Return that unrepresentable
region as kind unsupported, preserving only text actually visible; do not emit an
ordered item with a null ordinal, invent numbering, or silently omit essential content.
"""

ORDERED_LIST_PROMPT = UNICODE_STYLE_PROMPT + ORDERED_LIST_INSTRUCTIONS
ORDERED_LIST_PROMPT_VERSION = "ava-prose-region-13"
PINNED_ORDERED_LIST_PROMPT = PINNED_UNICODE_PROMPT + ORDERED_LIST_INSTRUCTIONS
PINNED_ORDERED_LIST_PROMPT_VERSION = "ava-prose-region-14"
