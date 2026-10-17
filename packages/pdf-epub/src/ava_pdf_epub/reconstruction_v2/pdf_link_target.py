"""PDF coordinates select a source fragment before proving its accepted destination."""

from collections.abc import Mapping

from pypdf import PdfReader

from ..pdf_navigation import NavigationTarget
from .continuation_presentation_contract import POLICY
from .geometry import overlap
from .native_line_offsets import NativeLineOffset, mapped_line_offset
from .observations import PageObservation
from .ocr_glyph_target import ocr_glyph_target
from .ocr_link_offset import visual_line_offset
from .pdf_target_frame import target_frame
from .segments import Segment


def page_target(
    target: NavigationTarget,
    segments: list[Segment],
    reader: PdfReader,
    observation: PageObservation,
    *,
    source_line_maps: Mapping[str, NativeLineOffset] | None = None,
    source_continuation_policy: str | None = None,
) -> tuple[str, int]:
    local = [s for s in segments if s.page == target.page and s.text]
    if not local or target.page is None:
        raise ValueError("PDF_LINK_TARGET_REQUIRES_REVIEW")
    if target.top is not None or target.left is not None:
        left, top, negative = target_frame(
            target, reader, observation, strict=source_continuation_policy == POLICY
        )
        if negative:
            local = [s for s in local if s.kind != "furniture" and not s.source_marginal_furniture]
        lines = [line for line in observation.lines if line.box.y1 >= top and line.box.x1 >= left]
        for line in lines:
            owners = [s for s in local if line.id in s.native_line_ids]
            if not owners:
                if source_continuation_policy == POLICY:
                    mapped = ocr_glyph_target(
                        observation,
                        line,
                        [s for s in segments if s.page == target.page],
                        left,
                        top,
                        source_continuation_policy,
                        excluded_ids=frozenset(
                            s.id
                            for s in segments
                            if negative and (s.kind == "furniture" or s.source_marginal_furniture)
                        ),
                    )
                    if mapped is not None:
                        return mapped
                    continue
                visual = [
                    s
                    for s in local
                    if s.method == "ocr"
                    and s.kind not in {"table", "figure", "furniture", "unsupported"}
                    and not s.source_marginal_furniture
                    and any(g.text.strip() and overlap(g.box, s.box) for g in line.glyphs)
                ]
                if not visual:
                    continue
                # A covered but unprovable line must not redirect to later text.
                if len(visual) != 1:
                    raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
                visual_at = visual_line_offset(observation, line, visual[0])
                if visual_at is None:
                    raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
                return visual[0].id, visual_at
            if len(owners) != 1:
                raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
            owner = owners[0]
            at = mapped_line_offset(line, owner, source_line_maps)
            if at is None:
                at = owner.text.find(line.text)
                if at < 0 or owner.text.find(line.text, at + 1) >= 0:
                    raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
            return owner.id, at
        raise ValueError("PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW")
    return local[0].id, 0
