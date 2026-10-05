"""Finalize source text before quoting style runs; historical instructions stay byte exact."""

from .ordered_list_prompt import ORDERED_LIST_PROMPT, PINNED_ORDERED_LIST_PROMPT

TEXT_STYLE_CONSISTENCY_INSTRUCTIONS = """
TEXT FIRST, THEN INLINE OBSERVATIONS:
1. Decide each segment/cell's actual reading characters from the source before writing spans.
Reliable native_evidence lines are exact character evidence: conserve their scalars. A scan
shows glyphs and placement, not the PDF's original Unicode encoding. For ordinary letters
or digits printed above/below their baseline, use the ordinary reading character in text
and vertical_align:"super"/"sub" on its span. Do not encode that same placement again by
substituting a Unicode presentation character. For example, visibly lowered ordinary3 in
"v3" stays text:"v3" with exact_text:"3" and vertical_align:"sub".
This is a source transcription rule, never an instruction to fold existing Unicode text.
If reliable source evidence identifies an intrinsic character such as "₃" or "⁴", preserve
it exactly. Its intrinsic glyph shape alone does not authorize an extra vertical_align.
Never blanket-convert Unicode digits, letters, fractions, mathematical symbols or ligatures.
When essential character identity cannot be established, report unresolved rather than guess.

2. Finalize and freeze the complete text of each segment and each individual table cell.
Then copy anchor.exact_text directly from THAT final text, not from your visual description,
a remembered draft, another segment, another cell, or a visually similar spelling. Derive
anchor.before from the immediately preceding characters and anchor.after from the immediately
following characters in the same final text. Include exact spaces and punctuation; a context
may be omitted/empty, but a supplied context cannot skip a space or character.
For intrinsic text:"v₃", exact_text:"₃" can match; exact_text:"3" cannot. For ordinary
text:"v3", exact_text:"3" can match; exact_text:"₃" cannot. Never mix the two forms.

3. Self-check EVERY span, including notes, links, table cells and all style exceptions:
find exact_text in its final owning text; filter matches by the exact adjacent before/after
contexts; exactly ONE match must remain. Zero matches means a mismatched quotation/context;
several matches need more exact context within the allowed bound. This check is case-sensitive
and code-point exact: é differs from e plus combining acute, a normal space differs from NBSP,
fi differs from ﬁ, and visually similar Latin/Cyrillic letters or emoji are not interchangeable.
Do not apply NFC/NFKC, replace punctuation/whitespace, drop combining marks/variation selectors,
or collapse emoji sequences to make an anchor match. Numeric start/end stay omitted/null.
After any source-grounded text correction, rebuild and recheck ALL of that text's anchors.
Never erase observed styling, invent text or return contradictory spans to force validation.
If source-grounded text and a uniquely matching quote cannot both be established, use unresolved.
"""

TEXT_STYLE_PROMPT = ORDERED_LIST_PROMPT + TEXT_STYLE_CONSISTENCY_INSTRUCTIONS
TEXT_STYLE_PROMPT_VERSION = "ava-prose-region-15"
PINNED_TEXT_STYLE_PROMPT = PINNED_ORDERED_LIST_PROMPT + TEXT_STYLE_CONSISTENCY_INSTRUCTIONS
PINNED_TEXT_STYLE_PROMPT_VERSION = "ava-prose-region-16"
