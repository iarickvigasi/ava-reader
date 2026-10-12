"""Capture glyph-bound paint roles in the existing pdfplumber layout pass."""

import math
from collections.abc import Sequence
from typing import Any

from pdfminer.layout import LTChar, LTContainer, LTFigure
from pdfminer.pdfcolor import PDFColorSpace
from pdfminer.pdfdevice import PDFTextSeq
from pdfminer.pdffont import PDFType3Font
from pdfminer.pdfinterp import PDFGraphicState, PDFPageInterpreter, PDFTextState
from pdfminer.utils import PathSegment
from pdfplumber.page import PDFPageAggregatorWithMarkedContent


def _plain_color(value: Any) -> bool:
    values = value if isinstance(value, tuple) else (value,)
    return len(values) in {1, 3} and all(
        type(v) in {int, float} and math.isfinite(v) and 0 <= v <= 1 for v in values
    )


def _color(value: Any) -> str:
    values = value if isinstance(value, tuple) else (value,)
    rgb = values * 3 if len(values) == 1 else values
    return "#" + "".join(f"{round(v * 255):02x}" for v in rgb)


def _uniform(matrix: Any) -> bool:
    return (
        len(matrix) == 6
        and all(math.isfinite(v) for v in matrix)
        and matrix[1] == matrix[2] == 0
        and matrix[0] > 0
        and matrix[0] == matrix[3]
    )


class _PaintAggregator(PDFPageAggregatorWithMarkedContent):
    def begin_tag(self, tag: Any, props: Any = None) -> None:
        super().begin_tag(tag, props)
        self._tag_ordinal = getattr(self, "_tag_ordinal", 0) + 1
        self._tag_instance = self._tag_ordinal

    def end_tag(self) -> None:
        super().end_tag()
        self._tag_instance = None

    def paint_path(
        self,
        graphicstate: PDFGraphicState,
        stroke: bool,
        fill: bool,
        evenodd: bool,
        path: Sequence[PathSegment],
    ) -> None:
        before = len(self.cur_item._objs)
        direct = not isinstance(self.cur_item, LTFigure)
        super().paint_path(graphicstate, stroke, fill, evenodd, path)
        if direct:
            for obj in self.cur_item._objs[before:]:
                obj.ncs = graphicstate.ncs  # type: ignore[attr-defined]

    def render_string(
        self,
        textstate: PDFTextState,
        seq: PDFTextSeq,
        ncs: PDFColorSpace,
        graphicstate: PDFGraphicState,
    ) -> None:
        before = len(self.cur_item._objs)
        mode = textstate.render
        bold = (
            mode == 2
            and not isinstance(textstate.font, PDFType3Font)
            and 0 < graphicstate.linewidth <= textstate.fontsize * textstate.matrix[0] * 0.05
            and _plain_color(graphicstate.ncolor)
            and graphicstate.ncs.name in {"DeviceRGB", "DeviceGray"}
            and graphicstate.scs == graphicstate.ncs
            and graphicstate.scolor == graphicstate.ncolor
            and _uniform(textstate.matrix)
            and self.ctm is not None
            and _uniform(self.ctm)
            and textstate.scaling == 100
            and graphicstate.dash is None
        )
        super().render_string(textstate, seq, ncs, graphicstate)
        for obj in self.cur_item._objs[before:]:
            if isinstance(obj, LTChar):
                obj.native_tag_instance = getattr(self, "_tag_instance", None)  # type: ignore[attr-defined]
                obj.native_paint_bold = bold  # type: ignore[attr-defined]
                color = (
                    _color(graphicstate.ncolor)
                    if (mode == 0 or bold)
                    and not isinstance(textstate.font, PDFType3Font)
                    and graphicstate.ncs.name in {"DeviceRGB", "DeviceGray"}
                    and _plain_color(graphicstate.ncolor)
                    else None
                )
                # Neutral black follows the existing reader/theme ink; colored source ink
                # remains an explicit glyph style, including ordinary filled list markers.
                obj.native_ink_color = color  # type: ignore[attr-defined]
                obj.native_paint_color = color if color != "#000000" else None  # type: ignore[attr-defined]
                obj.native_paint_qualified = mode == 0 or bold  # type: ignore[attr-defined]


def painted_chars(page: Any) -> tuple[list[dict[str, Any]], bool]:
    # One normal layout interpretation, not a second independent text extractor.
    # The pinned pdfplumber page subsequently uses this same layout for tables/graphics.
    device = _PaintAggregator(page.pdf.rsrcmgr, pageno=page.page_number, laparams=page.pdf.laparams)
    PDFPageInterpreter(page.pdf.rsrcmgr, device).process_page(page.page_obj)
    page._layout = device.get_result()
    chars: list[dict[str, Any]] = []

    def visit(objects: Any, direct: bool = True) -> None:
        for obj in objects:
            if isinstance(obj, LTContainer):
                visit(obj._objs, direct and not isinstance(obj, LTFigure))
            elif isinstance(obj, LTChar):
                chars.append(
                    {
                        **page.process_object(obj),
                        "native_tags_direct": direct,
                        "native_tag_instance": getattr(obj, "native_tag_instance", None),
                        "paint_bold": getattr(obj, "native_paint_bold", False),
                        "paint_ink_color": getattr(obj, "native_ink_color", None),
                        "paint_color": getattr(obj, "native_paint_color", None),
                        "paint_qualified": getattr(obj, "native_paint_qualified", False),
                    }
                )
                if len(chars) > 200000:
                    raise ValueError("Page glyph bound exceeded")

    visit(page._layout._objs)
    return chars, bool(chars) and all(c["paint_qualified"] for c in chars)
