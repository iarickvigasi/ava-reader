"""Read bounded advance witnesses without changing the existing page layout/cache."""

from typing import Any

from pdfminer.converter import PDFPageAggregator
from pdfminer.layout import LTChar, LTContainer
from pdfminer.pdfinterp import PDFPageInterpreter

from .observations import Glyph
from .spacing_metric import SpacingMetric, spacing_metric

MetricKey = tuple[str, str, float, float, float, float, float]


def glyph_metric_key(glyph: Glyph) -> MetricKey:
    return (
        glyph.text,
        glyph.font,
        glyph.size,
        glyph.box.x0,
        glyph.box.y0,
        glyph.box.x1,
        glyph.box.y1,
    )


class _SpacingCapture(PDFPageAggregator):
    def render_string(self, textstate: Any, seq: Any, ncs: Any, graphicstate: Any) -> None:
        before = len(self.cur_item._objs)
        super().render_string(textstate, seq, ncs, graphicstate)
        for obj in self.cur_item._objs[before:]:
            if isinstance(obj, LTChar):
                obj.spacing_metric = spacing_metric(textstate, obj)  # type: ignore[attr-defined]


def capture_spacing(page: Any) -> dict[MetricKey, SpacingMetric | None]:
    device = _SpacingCapture(page.pdf.rsrcmgr, pageno=page.page_number)
    PDFPageInterpreter(page.pdf.rsrcmgr, device).process_page(page.page_obj)
    metrics: dict[MetricKey, SpacingMetric | None] = {}
    count = 0

    def visit(objects: Any) -> None:
        nonlocal count
        for obj in objects:
            if isinstance(obj, LTContainer):
                visit(obj._objs)
            elif isinstance(obj, LTChar):
                count += 1
                if count > 200000:
                    raise ValueError("Page spacing glyph bound exceeded")
                char = page.process_object(obj)
                key: MetricKey = (
                    str(char["text"]),
                    str(char["fontname"]),
                    float(char["size"]),
                    float(char["x0"]),
                    float(char["top"]),
                    float(char["x1"]),
                    float(char["bottom"]),
                )
                metrics[key] = None if key in metrics else getattr(obj, "spacing_metric", None)

    visit(device.get_result()._objs)
    return metrics
