"""Only explicit zero-ink generated boundary padding of a complete unchanged line is ignored."""

import unittest
from types import SimpleNamespace

from ava_pdf_epub.reconstruction_v2.spacing_padding import qualify_decoder_padding

from .spacing_fixture import spacing_fixture


def padding_fixture(value="30 ", *, generated=1, area=False, stream=None):
    line, _ = spacing_fixture(text=value.strip(" "))
    proposal = value
    data = stream if stream is not None else value
    first, last = line.glyphs[0].box, line.glyphs[-1].box
    left = data.find(value)
    leading = len(value) - len(value.lstrip(" "))
    trailing = len(value) - len(value.rstrip(" "))
    marks = {left + j for j in [*range(leading), *range(len(value) - trailing, len(value))]}

    def box(index):
        glyph = first if index < left + leading else last
        x, y = (glyph.x0 + glyph.x1) / 2, (glyph.y0 + glyph.y1) / 2
        return x, 300 - y, x + (1 if area else 0), 300 - y + (1 if area else 0)

    raw = SimpleNamespace(
        FPDFText_GetUnicode=lambda _, i: ord(data[i]),
        FPDFText_IsGenerated=lambda _, i: generated if i in marks else 0,
        FPDFText_IsHyphen=lambda *_: 0,
    )
    text = SimpleNamespace(count_chars=lambda: len(data), get_charbox=box)
    obs = SimpleNamespace(lines=[line], width_pt=500, height_pt=300)
    return line, proposal, obs, text, raw


class SpacingPaddingTests(unittest.TestCase):
    def test_generated_prefix_suffix_padding_of_an_exact_line_preserves_original_text(self):
        for value in ("30 ", " 30", " 30 ", "ordinary prose "):
            line, value, obs, text, raw = padding_fixture(value)
            before = line.model_dump()
            self.assertEqual([line.text], qualify_decoder_padding([value], obs, text, raw))
            self.assertEqual(before, line.model_dump())

    def test_real_or_unknown_spaces_and_positive_area_marks_are_never_trimmed(self):
        for options in ({"generated": 0}, {"generated": -1}, {"area": True}):
            _, value, obs, text, raw = padding_fixture(**options)
            self.assertEqual([value], qualify_decoder_padding([value], obs, text, raw))
        _, value, obs, text, raw = padding_fixture()
        raw.FPDFText_IsHyphen = lambda *_: 1
        self.assertEqual([value], qualify_decoder_padding([value], obs, text, raw))

    def test_wrong_glyph_or_competing_line_owner_and_ambiguous_raw_matches_refuse(self):
        for where in ("peer", "duplicate", "outside", "wrong-end", "raw-duplicate"):
            line, value, obs, text, raw = padding_fixture()
            if where == "peer":
                obs.lines.append(line.model_copy(update={"id": "other"}))
            elif where == "duplicate":
                obs.lines.append(line)
            elif where == "outside":
                text.get_charbox = lambda *_: (0.0, 0.0, 0.0, 0.0)
            elif where == "wrong-end":
                g = line.glyphs[0].box
                text.get_charbox = lambda *_, g=g: (
                    (g.x0 + g.x1) / 2,
                    275.0,
                    (g.x0 + g.x1) / 2,
                    275.0,
                )
            else:
                raw.FPDFText_GetUnicode = lambda _, i, value=value: ord((value + value)[i])
                raw.FPDFText_IsGenerated = lambda _, i, value=value: int((value + value)[i] == " ")
                text.count_chars = lambda value=value: len(value) * 2
            if len(obs.lines) > 1:
                self.assertEqual([value] * 2, qualify_decoder_padding([value] * 2, obs, text, raw))
            else:
                self.assertEqual([value], qualify_decoder_padding([value], obs, text, raw))

    def test_interior_space_or_other_text_changes_and_real_source_boundary_whitespace_remain(self):
        line, _, obs, text, raw = padding_fixture("AlphaBeta ")
        for value in ("Alpha Beta ", "different ", "AlphaBeta\t", "AlphaBeta\x02 "):
            self.assertEqual([value], qualify_decoder_padding([value], obs, text, raw))
        original = line.model_copy(update={"text": " " + line.text})
        obs.lines = [original]
        value = " " + original.text
        self.assertEqual([value], qualify_decoder_padding([value], obs, text, raw))

    def test_raw_character_and_occurrence_bounds_fail_closed(self):
        _, value, obs, text, raw = padding_fixture()
        text.count_chars = lambda: 200001
        with self.assertRaisesRegex(RuntimeError, "bound"):
            qualify_decoder_padding([value], obs, text, raw)
        data = value * 65
        raw.FPDFText_GetUnicode = lambda _, i: ord(data[i])
        raw.FPDFText_IsGenerated = lambda _, i: int(data[i] == " ")
        text.count_chars = lambda: len(data)
        self.assertEqual([value], qualify_decoder_padding([value], obs, text, raw))

    def test_invisible_or_whitespace_endpoint_cannot_anchor_generated_padding(self):
        for visible in (False, True):
            line, value, obs, text, raw = padding_fixture(" \t30")
            glyphs = [line.glyphs[0].model_copy(update={"visible": visible}), *line.glyphs[1:]]
            changed = line.model_copy(update={"glyphs": glyphs})
            obs.lines = [changed]
            self.assertEqual([value], qualify_decoder_padding([value], obs, text, raw))
