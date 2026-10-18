"""Authored source-correlated compound and a literal OCR chapter reference."""

import hashlib

from ava_pdf_epub.reconstruction_v2.compound_heading_claims import resolve_heading_claims
from ava_pdf_epub.reconstruction_v2.native_line_offsets import NativeLineOffset
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan
from ava_pdf_epub.reconstruction_v2.structure_claims import StructureClaim, title_key

from .test_compound_headings import heading, workspace


def fixture(text="A😀 café, as in Chapter 1.", *, number="1", alias=True, prefix=""):
    label = "Chapter " + number
    at = text.index(label)
    pieces = [
        heading(prefix + "number", number, native_line_ids=[prefix + "number-line"]),
        heading(
            prefix + "title", "An opening – subtitle", 50, native_line_ids=[prefix + "title-line"]
        ),
    ]
    caller = heading(
        prefix + "caller",
        text,
        100,
        kind="paragraph",
        heading_level=None,
        method="ocr",
        spans=[ObservedSpan(start=at, end=at + len(label), target_text=label)],
    )
    state = workspace([*pieces, caller])
    state.source_continuation_policy = "ava-source-continuation-presentation-1"
    for piece in pieces:
        ident = piece.native_line_ids[0]
        state.native_line_maps[ident] = NativeLineOffset(
            line_id=ident,
            segment_id=piece.id,
            start=0,
            end=len(piece.text),
            text_sha256=hashlib.sha256(piece.text.encode()).hexdigest(),
        )
    claim = StructureClaim(number + " An opening - subtitle", None, pdf_page=1, depth=0)
    items, _ = resolve_heading_claims([claim], {}, [*pieces, caller], state)
    items[0] = items[0].model_copy(update={"chapter_start": True, "chapter_role": "bodymatter"})
    state.segments.update({s.id: s for s in items})
    if alias:
        state.source_outline_aliases.append((claim.title, 1, 0))
    else:
        state.source_outline_targets[(title_key(claim.title), 1, 0)] = items[0].id
    return items, state
