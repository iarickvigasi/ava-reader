"""Fill only unknown native indents from bounded source context; preserve all text and spans."""

from collections.abc import Sequence

from .apply_native_indent import apply_native_indent, indent_unknown
from .assembly_state import AssemblyState
from .native_indent_context import native_indent_reference
from .native_indent_peers import indent_peers
from .native_indent_rows import indent_rows, native_typeface, proven_indent_rows
from .prepared import PreparedPage
from .reading_order import reading_order
from .segments import Segment


def recover_native_indents(
    segments: list[Segment], prepared: Sequence[PreparedPage], state: AssemblyState
) -> list[Segment]:
    pages = {p.observation.number: p.observation for p in prepared}
    local = {n: [s for s in segments if s.page == n] for n in pages}
    placements = {
        n: {p.segment.id: p for p in reading_order(local[n], pages[n].width_pt)} for n in pages
    }
    layouts = {
        n: (page, any(p.column for p in placements[n].values())) for n, page in pages.items()
    }
    peers = {n: indent_peers(pages[n], local[n]) for n in pages}
    proofs = {n: indent_rows(p, local[n]) for n, p in pages.items()}
    output = []
    for segment in segments:
        style = segment.style
        literal = segment.preserve_line_breaks or segment.kind in {"code", "verse"}
        if (
            segment.method != "native"
            or style is None
            or style.align not in {"start", "left"}
            or (segment.kind != "paragraph" and not literal)
            or (not literal and (style.italic is not False or style.bold is not False))
            or segment.structure_candidate
        ):
            output.append(segment)
            continue
        rows = proven_indent_rows(segment, proofs[segment.page])
        signature = native_typeface(rows) if rows is not None else None
        if not rows or signature is None:
            if style.indent_em is None or style.block_indent_em is None:
                indent_unknown(
                    state,
                    segment,
                    "NATIVE_INDENT_SOURCE_UNPROVEN",
                    "Incomplete native IDs, ink, ownership or fonts leave indentation unknown.",
                )
            output.append(segment)
            continue
        if not literal and len(rows) != 1:
            output.append(segment)
            continue
        placement = placements[segment.page][segment.id]
        reference = native_indent_reference(
            pages[segment.page],
            placement.column,
            placement.band,
            layouts,
            [peer for n in range(segment.page - 1, segment.page + 2) for peer in peers.get(n, [])],
            signature,
            rows[0].box.x0,
            literal,
        )
        if reference is None:
            if style.indent_em is None or (literal and style.block_indent_em is None):
                indent_unknown(
                    state,
                    segment,
                    "NATIVE_INDENT_CONTEXT_UNQUALIFIED",
                    (
                        "Native displacement lacks repeated matching local context; "
                        "indentation stays unknown."
                    ),
                )
            output.append(segment)
            continue
        output.append(apply_native_indent(segment, rows, signature[1], literal, reference, state))
    state.segments.update({s.id: s for s in output})
    return output
