"""Source-state and object proof share the existing native painter, not text correspondence."""

import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pdfminer.layout import LTChar
from pdfminer.pdffont import PDFType3Font

from .native_colour_pdfium import ObjectColourProof, tool_identity, uniform_objects
from .native_colour_state import SourceColourState, operands, source_colour_state
from .observations import Glyph


@dataclass
class ColourCapture:
    state: SourceColourState
    objects: ObjectColourProof
    frame: list[float]
    view_sha256: str
    shows: int = 0
    glyphs: int = 0
    valid: bool = True
    raw_glyph_sha256: str = ""

    def record(self, textstate: Any, ncs: Any, gs: Any, objects: Any, direct: bool) -> None:
        self.shows += 1
        glyphs = [obj for obj in objects if isinstance(obj, LTChar)]
        self.glyphs += len(glyphs)
        try:
            raw = gs.ncolor if isinstance(gs.ncolor, tuple) else (gs.ncolor,)
            self.valid &= (
                direct and textstate.render == 0 and not isinstance(textstate.font, PDFType3Font)
            )
            self.valid &= ncs.name == "Separation" and ncs.ncomponents == 1
            self.valid &= operands(raw) == self.state.operands
        except (TypeError, ValueError):
            self.valid = False

    def apply(
        self, chars: list[dict[str, Any]], glyphs: list[Glyph], risks: list[str]
    ) -> list[Glyph]:
        if (
            risks
            or not self.valid
            or self.shows != self.state.shows
            or self.shows != self.objects.count
            or self.glyphs != len(chars)
            or len(glyphs) != len(chars)
        ):
            self.valid = False
            return glyphs
        try:
            if tool_identity() != self.objects.tool_sha256:
                self.valid = False
        except (ImportError, AttributeError, OSError, RuntimeError, ValueError):
            self.valid = False
        if not self.valid:
            return glyphs
        rgb = "#" + "".join(f"{v:02x}" for v in self.state.expected.rgb)
        display = None if rgb == "#000000" else rgb
        if any(
            g.paint_ink_color not in (None, rgb) or g.paint_color not in (None, display)
            for g in glyphs
        ):
            self.valid = False
            return glyphs
        # Preserve raw PDF operands/components. Only existing derived fields change.
        raw = [
            {
                key: c.get(key)
                for key in (
                    "text",
                    "fontname",
                    "size",
                    "matrix",
                    "x0",
                    "y0",
                    "x1",
                    "y1",
                    "non_stroking_color",
                    "ncs",
                )
            }
            for c in chars
        ]
        self.raw_glyph_sha256 = hashlib.sha256(
            json.dumps(raw, sort_keys=True, allow_nan=False).encode()
        ).hexdigest()
        return [
            g.model_copy(update={"paint_ink_color": rgb, "paint_color": display}) for g in glyphs
        ]


def colour_capture(
    source: Path, number: int, page: Any, reader: Any, *, original: Any, original_reader: Any
) -> ColourCapture | None:
    media, crop = [float(v) for v in page.mediabox], [float(v) for v in page.cropbox]
    if (
        len(media) != 4
        or media != crop
        or media[:2] != [0, 0]
        or not all(math.isfinite(v) for v in media)
        or page.rotation != 0
        or page.get("/UserUnit", 1) != 1
    ):
        return None
    try:
        if (
            list(original.mediabox) != list(page.mediabox)
            or list(original.cropbox) != list(page.cropbox)
            or original.rotation != page.rotation
            or original.get("/UserUnit", 1) != page.get("/UserUnit", 1)
        ):
            return None
        if original.get_contents().get_data() != page.get_contents().get_data():
            return None
        state = source_colour_state(page, reader)
        if state != source_colour_state(original, original_reader):
            return None
        proof = uniform_objects(source, number, state.expected.rgb, media) if state else None
        return (
            ColourCapture(state, proof, media, hashlib.sha256(source.read_bytes()).hexdigest())
            if state and proof
            else None
        )
    except (KeyError, TypeError, ValueError, OverflowError):
        return None
