"""Generated padding may point at another item only after the complete real raw run is owned."""

import math
import unittest
from types import SimpleNamespace

from ava_pdf_epub.reconstruction_v2.spacing_padding import qualify_decoder_padding
from ava_pdf_epub.reconstruction_v2.spacing_raw_run import source_owned_run

from .spacing_fixture import spacing_fixture


def run_fixture():
    line, _ = spacing_fixture(text="30")
    peer, _ = spacing_fixture(text="X")
    peer = peer.model_copy(
        update={
            "id": "other",
            "box": peer.box.model_copy(update={"x0": 100, "x1": 104}),
            "glyphs": [
                peer.glyphs[0].model_copy(
                    update={"box": peer.glyphs[0].box.model_copy(update={"x0": 100, "x1": 104})}
                )
            ],
        }
    )
    boxes = [(20.5, 272.0, 23.5, 278.0), (24.5, 272.0, 27.5, 278.0), (101.0, 275.0, 101.0, 275.0)]
    config = {"stream": "30 ", "generated": 1, "realGenerated": 0, "marked": 0}
    text = SimpleNamespace(
        count_chars=lambda: len(config["stream"]), get_charbox=lambda i: boxes[i % 3]
    )
    raw = SimpleNamespace(
        FPDFText_GetUnicode=lambda _, i: ord(config["stream"][i]),
        FPDFText_IsGenerated=lambda _, i: (
            config["generated"] if config["stream"][i] == " " else config["realGenerated"]
        ),
        FPDFText_IsHyphen=lambda *_: config["marked"],
    )
    obs = SimpleNamespace(lines=[line, peer], width_pt=500, height_pt=300)
    return line, obs, text, raw, config, boxes


class SourceRawRunTests(unittest.TestCase):
    def test_complete_literal_run_owns_padding_even_when_its_point_is_in_following_item(self):
        line, obs, text, raw, _, _ = run_fixture()
        before = line.model_dump()
        self.assertEqual([line.text, "X"], qualify_decoder_padding(["30 ", "X"], obs, text, raw))
        self.assertEqual(before, line.model_dump())

    def test_real_unknown_or_painted_padding_and_generated_real_glyphs_refuse(self):
        for option, value in (
            ("generated", 0),
            ("generated", -1),
            ("realGenerated", 1),
            ("marked", 1),
        ):
            line, obs, text, raw, config, _ = run_fixture()
            config[option] = value
            self.assertEqual(["30 ", "X"], qualify_decoder_padding(["30 ", "X"], obs, text, raw))
        for box in ((101, 275, 101.1, 275), (math.nan, 275, math.nan, 275), (501, 275, 501, 275)):
            line, obs, text, raw, _, boxes = run_fixture()
            boxes[2] = box
            self.assertEqual(["30 ", "X"], qualify_decoder_padding(["30 ", "X"], obs, text, raw))

    def test_foreign_ink_ambiguous_stream_or_any_glyph_overhang_is_not_approximated(self):
        for kind in ("foreign", "duplicate", "overhang", "invisible", "different"):
            line, obs, text, raw, config, boxes = run_fixture()
            if kind == "foreign":
                obs.lines.append(line.model_copy(update={"id": "foreign"}))
            elif kind == "duplicate":
                config["stream"] = "30 30 "
            elif kind == "overhang":
                boxes[0] = (20.5, 272, math.nextafter(24, math.inf), 278)
            elif kind == "invisible":
                obs.lines[0] = line.model_copy(
                    update={
                        "glyphs": [
                            line.glyphs[0].model_copy(update={"visible": False}),
                            line.glyphs[1],
                        ]
                    }
                )
            else:
                config["stream"] = "31 "
            proposed = ["30 ", "X"] + (["30 "] if kind == "foreign" else [])
            with self.subTest(kind=kind):
                self.assertEqual(proposed, qualify_decoder_padding(proposed, obs, text, raw))

    def test_new_run_bound_is_64_glyphs_and_does_not_restrict_old_endpoint_proof(self):
        for length, far in ((64, True), (65, True), (65, False)):
            line, _ = spacing_fixture(text="A" * length, gap=0)
            last = line.glyphs[-1].box
            point = 400.0 if far else (last.x0 + last.x1) / 2
            data = line.text + " "

            def box(index, length=length, point=point, line=line):
                if index == length:
                    return point, 275.0, point, 275.0
                g = line.glyphs[index].box
                return g.x0 + 0.5, 272.0, g.x1 - 0.5, 278.0

            text = SimpleNamespace(count_chars=lambda data=data: len(data), get_charbox=box)
            raw = SimpleNamespace(
                FPDFText_GetUnicode=lambda _, i, data=data: ord(data[i]),
                FPDFText_IsGenerated=lambda _, i, length=length: int(i == length),
                FPDFText_IsHyphen=lambda *_: 0,
            )
            obs = SimpleNamespace(lines=[line], width_pt=500, height_pt=300)
            expected = line.text if length == 64 or not far else data
            with self.subTest(length=length, far=far):
                self.assertEqual([expected], qualify_decoder_padding([data], obs, text, raw))

    def test_unknown_zero_and_surrogate_source_scalars_do_not_form_a_raw_witness(self):
        for code in (0, 0xD800, 0xDFFF):
            line, _ = spacing_fixture(text="A")
            # Deliberately malformed internal copy: normal model validation rejects this first.
            line = line.model_copy(
                update={
                    "text": chr(code),
                    "glyphs": [line.glyphs[0].model_copy(update={"text": chr(code)})],
                }
            )
            text = SimpleNamespace(
                count_chars=lambda: 2,
                get_charbox=lambda i: (20.5, 272, 23.5, 278) if i == 0 else (400, 275, 400, 275),
            )
            raw = SimpleNamespace(
                FPDFText_GetUnicode=lambda _, i, code=code: code if i == 0 else 32,
                FPDFText_IsGenerated=lambda _, i: int(i == 1),
                FPDFText_IsHyphen=lambda *_: 0,
            )
            obs = SimpleNamespace(lines=[line], width_pt=500, height_pt=300)
            with self.subTest(code=code):
                self.assertFalse(source_owned_run(text, raw, 0, line, obs))
                self.assertEqual(
                    [line.text + " "], qualify_decoder_padding([line.text + " "], obs, text, raw)
                )
