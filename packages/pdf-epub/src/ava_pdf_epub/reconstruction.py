"""Conservative reconstruction over immutable source-linked block candidates."""

from __future__ import annotations

import hashlib
import re
import unicodedata
from bisect import bisect_left
from html.parser import HTMLParser
from typing import Literal

from .models import Block, Chapter, Issue, Page, PageBreak, Span


def digest_text(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def title_key(text: str) -> str:
    return " ".join(re.findall(r"\w+", unicodedata.normalize("NFC", text).casefold()))


class _InlineParser(HTMLParser):
    """No HTML is emitted: only exact-text style/link candidates survive."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text = ""
        self.stack: list[tuple[str, int, str | None]] = []
        self.ranges: list[tuple[str, int, int, str | None]] = []
        self.unsafe = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag not in {
            "em",
            "i",
            "strong",
            "b",
            "sup",
            "sub",
            "span",
            "a",
            "br",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
        }:
            self.unsafe = True
            return
        values = dict(attrs)
        smallcaps = tag == "span" and (
            values.get("class") == "smallcaps"
            or bool(
                re.fullmatch(r"font-variant\s*:\s*small-caps\s*;?", values.get("style") or "", re.I)
            )
        )
        allowed = {"href", "class", "style"} if smallcaps else {"href", "class"}
        if any(k not in allowed for k in values):
            self.unsafe = True
        if tag == "br":
            self.text += "\n"
        else:
            self.stack.append(
                (tag, len(self.text), "smallcaps" if smallcaps else values.get("href"))
            )

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "br" and not attrs:
            self.text += "\n"
        else:
            self.unsafe = True

    def handle_endtag(self, tag: str) -> None:
        if not self.stack or self.stack[-1][0] != tag:
            self.unsafe = True
            return
        opened, start, target = self.stack.pop()
        if start < len(self.text):
            self.ranges.append(
                (
                    "smallcaps" if opened == "span" and target == "smallcaps" else opened,
                    start,
                    len(self.text),
                    None if opened == "span" else target,
                )
            )

    def handle_data(self, data: str) -> None:
        self.text += data

    def handle_comment(self, data: str) -> None:
        self.unsafe = True


def _reference_spacing_ranges(
    text: str, parser: _InlineParser
) -> list[tuple[str, int, int, str | None]] | None:
    """Allow layout spaces at explicit note boundaries, never changed word boundaries."""
    source = [(i, c) for i, c in enumerate(parser.text) if not c.isspace()]
    target = [(i, c) for i, c in enumerate(text) if not c.isspace()]
    if [c for _, c in source] != [c for _, c in target] or not source:
        return None
    boundaries = {
        position
        for tag, start, end, href in parser.ranges
        if tag == "a" and href and href.startswith("#fn")
        for position in (start, end)
    }
    previous_source = previous_target = -1
    for (source_i, _), (target_i, _) in zip(source, target, strict=True):
        source_gap = parser.text[previous_source + 1 : source_i]
        target_gap = text[previous_target + 1 : target_i]
        if bool(source_gap) != bool(target_gap) and not (
            {previous_source + 1, source_i} & boundaries
        ):
            return None
        previous_source, previous_target = source_i, target_i
    if bool(parser.text[previous_source + 1 :]) != bool(text[previous_target + 1 :]):
        return None
    source_positions = [i for i, _ in source]
    result = []
    for tag, start, end, href in parser.ranges:
        first = bisect_left(source_positions, start)
        after = bisect_left(source_positions, end)
        if first < after:
            result.append((tag, target[first][0], target[after - 1][0] + 1, href))
    return result


def inline_spans(text: str, markup: str | None) -> tuple[list[Span], list[str]]:
    if not markup:
        return [], []
    parser = _InlineParser()
    try:
        parser.feed(markup)
        parser.close()
    except Exception:
        return [], ["inline_markup_invalid"]
    if parser.unsafe or parser.stack:
        return [], ["inline_markup_not_exact_safe_text"]
    offset = 0
    fragment = False
    spacing = False
    ranges = parser.ranges
    if parser.text != text:
        # Some recognizers return only the formatted clause. Unique exact correspondence
        # preserves its span without rewriting or fuzzily aligning any source words.
        aligned = _reference_spacing_ranges(text, parser)
        if aligned is not None:
            ranges = aligned
            spacing = True
        else:
            offset = text.find(parser.text) if parser.text else -1
            if offset < 0 or text.find(parser.text, offset + 1) >= 0:
                return [], ["inline_markup_not_exact_safe_text"]
            if (offset and text[offset - 1].isalnum() and parser.text[0].isalnum()) or (
                offset + len(parser.text) < len(text)
                and text[offset + len(parser.text)].isalnum()
                and parser.text[-1].isalnum()
            ):
                return [], ["inline_markup_not_exact_safe_text"]
            fragment = True
    spans = []
    warnings = ["inline_fragment_aligned"] if fragment else []
    if spacing:
        warnings.append("inline_reference_spacing_aligned")
    for tag, start, end, target in ranges:
        start, end = start + offset, end + offset
        if tag == "span" or re.fullmatch(r"h[1-6]", tag):
            continue
        if tag == "a":
            if target and re.fullmatch(r"#fn[^\s#]+", target):
                spans.append(Span(start=start, end=end, kind="noteref", target=target))
            elif target and re.match(r"^(https://|mailto:)", target, re.I):
                spans.append(Span(start=start, end=end, kind="link", target=target))
            else:
                warnings.append("unresolved_or_unsafe_link")
        else:
            kind = {"i": "em", "b": "strong"}.get(tag, tag)
            # Legacy HTML expresses emphasis; it is candidate evidence, not new inference.
            spans.append(Span(start=start, end=end, kind=kind))  # type: ignore[arg-type]
    links = sorted((s for s in spans if s.target), key=lambda s: s.start)
    if any(a.end > b.start for a, b in zip(links, links[1:], strict=False)):
        return [s for s in spans if not s.target], warnings + ["overlapping_link_candidates"]
    return sorted(spans, key=lambda s: (s.start, -s.end, s.kind)), warnings


def resolve_notes(pages: list[Page]) -> list[Issue]:
    issues: list[Issue] = []
    for page in pages:
        notes: dict[str, list[Block]] = {}
        referenced: set[str] = set()
        for block in page.blocks:
            if block.kind == "note" and block.label:
                notes.setdefault(block.label.strip(), []).append(block)
        for block in page.blocks:
            replacements = []
            for span in block.spans:
                if span.kind != "noteref":
                    replacements.append(span)
                    continue
                label = (span.target or "").removeprefix("#fn")
                candidates = notes.get(label, [])
                if block.text[span.start : span.end].strip() != label:
                    candidates = []
                if len(candidates) == 1:
                    replacements.append(span.model_copy(update={"target": candidates[0].id}))
                    referenced.add(candidates[0].id)
                else:
                    # Keep printed text/sup styling; never emit a guessed or broken href.
                    issues.append(
                        Issue(
                            code="unresolved_note_reference",
                            message=f"Note {label!r}: {len(candidates)} page candidates.",
                            page=page.number,
                            block_id=block.id,
                        )
                    )
            block.spans = replacements
        for blocks in notes.values():
            for note in blocks:
                if note.id not in referenced:
                    issues.append(
                        Issue(
                            code="unreferenced_note",
                            message="Extracted note has no resolved explicit source reference.",
                            page=page.number,
                            block_id=note.id,
                        )
                    )
    return issues


def chapters_from_plan(
    pages: list[Page], entries: list[dict[str, object]]
) -> tuple[list[Chapter], list[Issue]]:
    blocks = [b for p in pages for b in p.blocks]
    positions = {b.id: i for i, b in enumerate(blocks)}
    chapters: list[Chapter] = []
    issues: list[Issue] = []
    last = -1
    for entry in entries:
        title, page_number = entry.get("title"), entry.get("page_index")
        if (
            not isinstance(title, str)
            or not title.strip()
            or type(page_number) is not int
            or not 1 <= page_number <= len(pages)
        ):
            issues.append(
                Issue(
                    code="unresolved_chapter",
                    message="Chapter candidate has no supported title/page boundary.",
                )
            )
            continue
        candidates = []
        source_blocks = pages[page_number - 1].blocks
        for i, block in enumerate(source_blocks):
            if block.kind != "heading":
                continue
            for count in (1, 2, 3):
                group = source_blocks[i : i + count]
                if len(group) != count or any(b.kind != "heading" for b in group):
                    continue
                if title_key(" ".join(b.text for b in group)) == title_key(title):
                    candidates.append(block)
        unique = {b.id: b for b in candidates}
        if len(unique) != 1:
            issues.append(
                Issue(
                    code="unresolved_chapter",
                    message=f"Chapter {title!r} has {len(unique)} exact heading boundaries.",
                    page=page_number,
                )
            )
            continue
        block = next(iter(unique.values()))
        position = positions[block.id]
        if position <= last:
            issues.append(
                Issue(
                    code="chapter_order_conflict",
                    message=f"Chapter {title!r} overlaps a preceding boundary.",
                    page=page_number,
                )
            )
            continue
        lowered = title.casefold()
        kind: Literal["frontmatter", "bodymatter", "backmatter"] = (
            "backmatter"
            if re.search(r"\b(index|appendix|bibliography|references)\b", lowered)
            else "frontmatter"
            if re.search(r"\b(preface|foreword|translator|introduction)\b", lowered)
            else "bodymatter"
        )
        chapters.append(
            Chapter(
                id=f"chapter-{len(chapters) + 1:03d}",
                title=title,
                start_block_id=block.id,
                kind=kind,
                verified=False,
            )
        )
        last = position
    if blocks and (not chapters or chapters[0].start_block_id != blocks[0].id):
        chapters.insert(
            0,
            Chapter(
                id="front-001",
                title="Front matter" if chapters else "Book",
                start_block_id=blocks[0].id,
                kind="frontmatter" if chapters else "bodymatter",
            ),
        )
    return chapters, issues


def join_continuations(pages: list[Page], chapters: list[Chapter]) -> list[Issue]:
    """Join only two explicit compatible flags; uncertain hyphens stay for review."""
    boundaries = {c.start_block_id for c in chapters}
    targeted = {s.target for p in pages for block in p.blocks for s in block.spans if s.target}
    issues: list[Issue] = []
    for right_index, right in enumerate(pages[1:], 1):
        preceding = [(p, b) for p in pages[:right_index] for b in p.blocks if b.kind != "note"]
        left, a = preceding[-1] if preceding else (pages[right_index - 1], None)
        b = next((b for b in right.blocks if b.kind != "note"), None)
        if not a or not b or not (a.continues_to_next or b.continues_from_previous):
            continue
        if not (
            a.continues_to_next
            and b.continues_from_previous
            and a.kind == b.kind == "paragraph"
            and b.id not in boundaries
            and b.id not in targeted
            and a.style == b.style
            and max(e.page for e in a.evidence) == right.number - 1
            and min(e.page for e in b.evidence) == right.number
            and pages[right_index - 1].route not in {"blank", "needs_ocr"}
            and right.route not in {"blank", "needs_ocr"}
        ):
            issues.append(
                Issue(
                    code="unresolved_paragraph_continuation",
                    message="Page boundary lacks two compatible continuation observations.",
                    page=right.number,
                    block_id=b.id,
                )
            )
            continue
        if a.text.endswith(("-", "\u00ad")):
            issues.append(
                Issue(
                    code="ambiguous_boundary_hyphen",
                    message="Split text preserved; boundary hyphen needs source review.",
                    page=right.number,
                    block_id=b.id,
                )
            )
            continue
        separator = (
            "" if a.text.endswith(tuple(" \t\n")) or b.text.startswith(tuple(" \t\n")) else " "
        )
        offset = len(a.text) + len(separator)
        text = a.text + separator + b.text
        spans = a.spans + [
            s.model_copy(update={"start": s.start + offset, "end": s.end + offset}) for s in b.spans
        ]
        breaks = {item.page: item.offset for item in a.page_breaks}
        breaks[right.number] = offset
        conflicting_break = False
        for item in b.page_breaks:
            shifted = item.offset + offset
            if item.page in breaks and breaks[item.page] != shifted:
                conflicting_break = True
            breaks[item.page] = shifted
        if conflicting_break:
            issues.append(
                Issue(
                    code="conflicting_source_page_boundary",
                    message="Paragraph page offsets conflict; join withheld.",
                    page=right.number,
                    block_id=b.id,
                )
            )
            continue
        merged = a.model_copy(
            update={
                "text": text,
                "text_sha256": digest_text(text),
                "spans": spans,
                "evidence": a.evidence + b.evidence,
                "page_breaks": [
                    PageBreak(page=page, offset=position)
                    for page, position in sorted(breaks.items(), key=lambda item: item[1])
                ],
                "continues_to_next": b.continues_to_next,
            }
        )
        left.blocks[left.blocks.index(a)] = Block.model_validate(merged.model_dump())
        right.blocks.remove(b)
        # Do not remap incoming links to a discarded target without preserving its exact address.
        issues.append(
            Issue(
                code="joined_source_paragraph",
                message=f"Joined {a.id} and {b.id} with source evidence and realigned spans.",
                severity="info",
                page=right.number,
                block_id=a.id,
            )
        )
    return issues
