"""Original source origins, resource/state and explicit raw marker must all corroborate overhang."""

import math
import unittest
from dataclasses import replace

from ava_pdf_epub.reconstruction_v2.spacing_capture import glyph_metric_key
from ava_pdf_epub.reconstruction_v2.spacing_hyphen import corroborate_terminal_hyphen

from .source_hyphen_fixture import source_hyphen_fixture


class SourceHyphenTests(unittest.TestCase):
    def result(self, line, ink, observation, context):
        return corroborate_terminal_hyphen(
            line, line.text[:-1] + "\x02", [ink], observation, source_context=context
        )

    def test_kerned_source_order_owns_overhanging_ink_without_changing_source(self):
        line, ink, observation, context, _ = source_hyphen_fixture()
        before = line.model_dump()
        self.assertEqual(line.text, self.result(line, ink, observation, context))
        self.assertEqual(before, line.model_dump())
        self.assertEqual(line.text[:-1] + "\x02", self.result(line, ink, observation, None))

    def test_font_nominal_size_transform_scaling_and_explicit_marker_cannot_be_guessed(self):
        for option, value in (
            ("font", b"OtherFace"),
            ("font", b"Helvetica" + bytes([0]) + b"OtherFace"),
            ("font", b"Helvetica" + bytes([0, 255])),
            ("font", b"Helvetica" + bytes([255])),
            ("font", b"Subset+Helvetica"),
            ("size", 10.0),
            ("matrix", (10.000001, 0, 0, 10, 0, 0)),
            ("matrix", (10, 0.01, 0, 10, 0, 0)),
            ("marked", -1),
            ("count", 2),
        ):
            with self.subTest(option=option, value=value):
                line, ink, observation, context, config = source_hyphen_fixture()
                config[option] = value
                self.assertEqual(
                    line.text[:-1] + "\x02", self.result(line, ink, observation, context)
                )
        line, ink, observation, context, _ = source_hyphen_fixture()
        for key, metric in list(context.metrics.items()):
            context.metrics[key] = replace(metric, state=(1, 99, 10, 10))
        self.assertEqual(line.text[:-1] + "\x02", self.result(line, ink, observation, context))

    def test_missing_nonfinite_or_disordered_source_origin_and_foreign_raw_origin_refuse(self):
        for kind in ("missing", "nan", "order", "baseline", "outside", "raw-nan", "metric"):
            line, ink, observation, context, config = source_hyphen_fixture()
            first = glyph_metric_key(line.glyphs[0])
            metric = context.metrics[first]
            if kind == "missing":
                context.metrics[first] = replace(metric, source_origin=None)
            elif kind == "nan":
                context.metrics[first] = replace(metric, source_origin=(math.nan, 275))
            elif kind == "order":
                context.metrics[first] = replace(metric, source_origin=(500, 275))
            elif kind == "baseline":
                context.metrics[first] = replace(metric, source_origin=(20, 274))
            elif kind == "outside":
                config["origin"] = (line.glyphs[-1].box.x0 - 0.01, 275)
            elif kind == "raw-nan":
                config["origin"] = (math.nan, 275)
            else:
                context.metrics[first] = None
            with self.subTest(kind=kind):
                self.assertEqual(
                    line.text[:-1] + "\x02", self.result(line, ink, observation, context)
                )

    def test_optional_raw_api_absence_and_foreign_ink_owner_do_not_grant_authority(self):
        line, ink, observation, context, _ = source_hyphen_fixture()
        del context.raw.FPDFText_GetMatrix
        self.assertEqual(line.text[:-1] + "\x02", self.result(line, ink, observation, context))
        line, ink, observation, context, _ = source_hyphen_fixture()
        observation.lines.append(line.model_copy(update={"id": "foreign"}))
        self.assertEqual(line.text[:-1] + "\x02", self.result(line, ink, observation, context))

    def test_terminal_source_cell_has_no_owner_at_its_right_endpoint(self):
        line, ink, observation, context, config = source_hyphen_fixture()
        config["origin"] = (line.glyphs[-1].box.x1, 275)
        self.assertEqual(line.text[:-1] + "\x02", self.result(line, ink, observation, context))

    def test_page_catalogue_rechecks_count_index_flags_and_selected_box(self):
        for indices in ((), (-1,), (1,), (0, 0), (False,)):
            line, ink, observation, context, _ = source_hyphen_fixture()
            changed = replace(context, marker_indices={ink: indices})
            self.assertEqual(line.text[:-1] + "\x02", self.result(line, ink, observation, changed))
        line, ink, observation, context, config = source_hyphen_fixture()
        config["count"] = 2
        self.assertEqual(line.text[:-1] + "\x02", self.result(line, ink, observation, context))
        line, ink, observation, context, config = source_hyphen_fixture()
        context.text.get_charbox = lambda _: (0, 0, 1, 1)
        self.assertEqual(line.text[:-1] + "\x02", self.result(line, ink, observation, context))

    def test_each_fallback_reads_only_its_catalogued_raw_marker(self):
        line, ink, observation, context, config = source_hyphen_fixture()
        config["count"] = 200000
        context = replace(context, raw_count=200000)
        calls = []

        def unicode_at(_, index):
            calls.append(index)
            return 2 if index == 0 else ord("A")

        context.raw.FPDFText_GetUnicode = unicode_at
        for _ in range(5):
            self.assertEqual(line.text, self.result(line, ink, observation, context))
        self.assertEqual([0] * 5, calls)
