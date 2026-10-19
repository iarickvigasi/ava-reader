"""A kerned Type1 row whose terminal ink overhangs its logical advance box."""

import ctypes
from dataclasses import replace
from types import SimpleNamespace

from ava_pdf_epub.reconstruction_v2.spacing_capture import glyph_metric_key
from ava_pdf_epub.reconstruction_v2.spacing_hyphen_source import HyphenSourceContext

from .spacing_fixture import spacing_fixture


class Matrix(ctypes.Structure):
    _fields_ = [(name, ctypes.c_float) for name in ("a", "b", "c", "d", "e", "f")]


def source_hyphen_fixture():
    line, old = spacing_fixture(text="ar-")
    glyphs = list(line.glyphs)
    previous = glyphs[-2]
    glyphs[-2] = previous.model_copy(
        update={"box": previous.box.model_copy(update={"x1": glyphs[-1].box.x0 + 0.1})}
    )
    line = line.model_copy(update={"glyphs": glyphs})
    metrics = {}
    base = next(iter(old.values()))
    for glyph in glyphs:
        metrics[glyph_metric_key(glyph)] = replace(
            base, state=(1, 100, 10, 10), source_origin=(glyph.box.x0, 275)
        )
    g = glyphs[-1].box
    ink = (g.x0 + 0.5, 22.0, g.x1 + 0.001, 28.0)
    config = dict(
        font=b"Helvetica",
        size=1.0,
        origin=(g.x0 + 0.01, 275.0),
        matrix=(10, 0, 0, 10, 0, 0),
        marked=1,
        count=1,
    )

    def font_info(_, index, buffer, length, flags):
        if buffer is not None:
            buffer.value = config["font"]
        return len(config["font"]) + 1

    def matrix(_, index, pointer):
        for key, value in zip(("a", "b", "c", "d", "e", "f"), config["matrix"], strict=True):
            setattr(pointer._obj, key, value)
        return 1

    def origin(_, index, x, y):
        x._obj.value, y._obj.value = config["origin"]
        return 1

    raw = SimpleNamespace(
        FS_MATRIX=Matrix,
        FPDFText_GetUnicode=lambda *_: 2,
        FPDFText_IsHyphen=lambda *_: config["marked"],
        FPDFText_GetFontSize=lambda *_: config["size"],
        FPDFText_GetFontInfo=font_info,
        FPDFText_GetMatrix=matrix,
        FPDFText_GetCharOrigin=origin,
    )
    text = SimpleNamespace(
        count_chars=lambda: config["count"],
        get_charbox=lambda _: (ink[0], 300 - ink[3], ink[2], 300 - ink[1]),
    )
    observation = SimpleNamespace(lines=[line], width_pt=500, height_pt=300)
    return line, ink, observation, HyphenSourceContext(text, raw, metrics, 1, {ink: (0,)}), config
