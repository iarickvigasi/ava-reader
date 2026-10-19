"""Map exact layout joins separately; never remove a printed hyphen or guess text offsets."""

import re
from typing import Any

from ..contracts.common import text_digest
from ..contracts.layout_wrap import compound_wrap


def _wraps(source: str, compact: bool, compounds: bool) -> list[tuple[int, int, str]]:
    pattern = r"[ \t]*(?:\r\n|\r|\n)[ \t]*" if compact else r"\r\n|\r|\n"
    events = []
    for match in re.finditer(pattern, source):
        start, end = match.span()
        if compounds:
            while start > 0 and source[start - 1] in " \t":
                start -= 1
            while end < len(source) and source[end] in " \t":
                end += 1
            if compound_wrap(source, start, end):
                events.append((start, end, ""))
                continue
        events.append((*match.span(), " "))
    return events


def _selected_wraps(
    source: str, text: str, events: list[tuple[int, int, str]]
) -> list[tuple[int, int, str]] | None:
    source_at = canonical_at = 0
    selected = []
    for start, end, replacement in events:
        unchanged = source[source_at:start]
        if not text.startswith(unchanged, canonical_at):
            return None
        canonical_at += len(unchanged)
        original = source[start:end]
        if text.startswith(original, canonical_at):
            canonical_at += len(original)
        elif replacement == "" and text.startswith(
            re.sub(r"\r\n|\r|\n", " ", original), canonical_at
        ):
            # Native line edges retain their spaces/tabs as identity; only the
            # newline changes, independently of a compacted cross-owner wrap.
            newline = re.search(r"\r\n|\r|\n", original)
            assert newline is not None
            selected.append((start + newline.start(), start + newline.end(), " "))
            canonical_at += len(original) - len(newline[0]) + 1
        elif replacement == "" and text.startswith(" ", canonical_at):
            # A retained internal wrap and a compacted cross-owner wrap may coexist.
            # Both are witnessed separator changes; printed hyphens stay identity.
            selected.append((start, end, " "))
            canonical_at += 1
        elif text.startswith(replacement, canonical_at):
            selected.append((start, end, replacement))
            canonical_at += len(replacement)
        else:
            return None
        source_at = end
    return selected if source[source_at:] == text[canonical_at:] else None


def line_wrap_map(source: str, text: str) -> dict[str, Any]:
    # Retained display separators remain exact identity spans; only layout wraps change.
    # Compound mode removes only proven layout whitespace between letter-hyphen/letter.
    for compact, compounds in ((False, False), (True, False), (False, True), (True, True)):
        selected = _selected_wraps(source, text, _wraps(source, compact, compounds))
        if selected is not None:
            events = selected
            break
    else:
        raise ValueError("Unaccounted source-to-canonical text transformation")
    segments = []
    source_at = canonical_at = 0
    for start, end, replacement in events:
        if start > source_at:
            size = start - source_at
            segments.append(
                dict(
                    source_start=source_at,
                    source_end=start,
                    canonical_start=canonical_at,
                    canonical_end=canonical_at + size,
                    kind="identity",
                )
            )
            canonical_at += size
        segments.append(
            dict(
                source_start=start,
                source_end=end,
                canonical_start=canonical_at,
                canonical_end=canonical_at + len(replacement),
                kind="line_wrap",
            )
        )
        source_at = end
        canonical_at += len(replacement)
    if source_at < len(source):
        segments.append(
            dict(
                source_start=source_at,
                source_end=len(source),
                canonical_start=canonical_at,
                canonical_end=len(text),
                kind="identity",
            )
        )
    return dict(source_text=source, source_sha256=text_digest(source), segments=segments)
