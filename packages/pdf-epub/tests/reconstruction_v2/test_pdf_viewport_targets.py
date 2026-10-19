"""A PDF viewport origin is not a fabricated reflowable page-start target."""

import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DictionaryObject,
    FloatObject,
    NameObject,
    NullObject,
    NumberObject,
)

from ava_pdf_epub.pdf_navigation import NavigationTarget, pdf_navigation
from ava_pdf_epub.reconstruction_v2.pdf_links import page_target
from tests.reconstruction_v2.test_pdf_links import box, observation
from tests.reconstruction_v2.test_refinement_grouping import segment


class PdfViewportTargets(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        path = Path(temp.name) / "authored-page.pdf"
        writer = PdfWriter()
        writer.add_blank_page(width=100, height=100)
        writer.write(path)
        self.reader = PdfReader(path, strict=True)
        self.addCleanup(self.reader.close)
        self.observation = observation()
        self.owner = segment("body", "prefix Go suffix").model_copy(
            update={"method": "native", "native_line_ids": ["line"]}
        )

    def target(self, left=-20.0, top=105.0, mode="/XYZ"):
        coordinates = [FloatObject(v) if v is not None else NullObject() for v in (left, top)]
        destination = ArrayObject(
            [
                self.reader.pages[0].indirect_reference,
                NameObject(mode),
                *coordinates,
                NumberObject(0),
            ]
        )
        return pdf_navigation(
            self.reader,
            DictionaryObject(
                {NameObject("/Subtype"): NameObject("/Link"), NameObject("/Dest"): destination}
            ),
        )

    def test_source_mode_and_original_coordinates_are_retained(self):
        target = self.target()
        self.assertEqual("/XYZ", getattr(target, "fit", None))
        self.assertEqual((-20.0, 105.0), (target.left, target.top))
        self.assertEqual(NavigationTarget(page=1, left=-20, top=105), target)
        self.assertNotIn("fit", repr(target))

    def test_above_or_left_viewport_maps_exact_nonzero_source_text_offset(self):
        for left, top in [(-20, 105), (-20, 80), (0, 105)]:
            with self.subTest(left=left, top=top):
                target = self.target(left, top)
                self.assertEqual(
                    ("body", 7), page_target(target, [self.owner], self.reader, self.observation)
                )
                self.assertEqual((left, top), (target.left, target.top))

    def test_kept_body_is_selected_after_a_dropped_leading_folio(self):
        folio = self.observation.lines[0].model_copy(
            update={"id": "folio", "box": box(0, 2, 20, 12)}
        )
        page = self.observation.model_copy(update={"lines": [folio, *self.observation.lines]})
        dropped = self.owner.model_copy(
            update={
                "id": "dropped",
                "kind": "furniture",
                "text": "Go",
                "native_line_ids": ["folio"],
            }
        )
        self.assertEqual(
            ("body", 7), page_target(self.target(), [dropped, self.owner], self.reader, page)
        )
        with self.assertRaisesRegex(ValueError, "PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW"):
            page_target(self.target(), [dropped], self.reader, page)

    def test_in_page_passage_and_right_column_offsets_remain_distinct(self):
        right = self.observation.lines[0].model_copy(
            update={"id": "right", "box": box(60, 20, 80, 30)}
        )
        lower = right.model_copy(
            update={"id": "lower", "text": "Later", "box": box(60, 50, 80, 60)}
        )
        page = self.observation.model_copy(
            update={"lines": [*self.observation.lines, right, lower]}
        )
        owners = [
            self.owner,
            self.owner.model_copy(update={"id": "right-body", "native_line_ids": ["right"]}),
            self.owner.model_copy(
                update={
                    "id": "later-body",
                    "text": "prefix Later suffix",
                    "native_line_ids": ["lower"],
                }
            ),
        ]
        for left, top, expected in [
            (0, 80, ("body", 7)),
            (60, 80, ("right-body", 7)),
            (60, 55, ("later-body", 7)),
        ]:
            with self.subTest(left=left, top=top):
                self.assertEqual(
                    expected, page_target(self.target(left, top), owners, self.reader, page)
                )

    def test_nonfinite_coordinates_never_get_a_viewport_projection(self):
        for label, left, top in [
            ("leftNaN", float("nan"), 105),
            ("leftInf", float("inf"), 105),
            ("leftNegativeInf", -float("inf"), 105),
            ("topNaN", -20, float("nan")),
            ("topInf", -20, float("inf")),
            ("topNegativeInf", -20, -float("inf")),
        ]:
            with (
                self.subTest(label=label),
                self.assertRaisesRegex(ValueError, "PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW"),
            ):
                page_target(self.target(left, top), [self.owner], self.reader, self.observation)

    def test_unretained_and_ambiguous_text_cannot_become_a_destination(self):
        for label, owners in [
            ("missing", []),
            ("duplicateOwner", [self.owner, self.owner.model_copy(update={"id": "second"})]),
            ("duplicateText", [self.owner.model_copy(update={"text": "Go Go"})]),
            ("noLineOwnership", [self.owner.model_copy(update={"native_line_ids": []})]),
        ]:
            with self.subTest(label=label), self.assertRaises(ValueError):
                page_target(self.target(), owners, self.reader, self.observation)

    def test_unknown_mode_null_axes_and_right_or_bottom_origins_stay_refused(self):
        target = self.target()
        for label, value in [
            ("modeUnavailable", replace(target, fit=None)),
            ("modeFitH", replace(target, fit="/FitH")),
            ("leftNull", self.target(None, 105)),
            ("topNull", self.target(-20, None)),
            ("right", self.target(101, 105)),
            ("bottom", self.target(-20, -1)),
        ]:
            with (
                self.subTest(label=label),
                self.assertRaisesRegex(ValueError, "PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW"),
            ):
                page_target(value, [self.owner], self.reader, self.observation)

    def test_foreign_observation_or_unknown_page_frame_is_not_admitted(self):
        for label, page in [
            ("foreignPage", self.observation.model_copy(update={"number": 2})),
            ("differentWidth", self.observation.model_copy(update={"width_pt": 101})),
            ("differentHeight", self.observation.model_copy(update={"height_pt": 101})),
            ("observationRotated", self.observation.model_copy(update={"rotation": 90})),
        ]:
            with (
                self.subTest(label=label),
                self.assertRaisesRegex(ValueError, "PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW"),
            ):
                page_target(self.target(), [self.owner], self.reader, page)
        source = self.reader.pages[0]
        for label, key, value in [
            ("pageRotated", "/Rotate", NumberObject(90)),
            ("userUnit", "/UserUnit", NumberObject(2)),
        ]:
            with self.subTest(label=label):
                source[NameObject(key)] = value
                with self.assertRaisesRegex(ValueError, "PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW"):
                    page_target(self.target(), [self.owner], self.reader, self.observation)
                del source[NameObject(key)]
        source.cropbox.lower_left = (1, 0)
        with self.assertRaisesRegex(ValueError, "PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW"):
            page_target(self.target(), [self.owner], self.reader, self.observation)
        source.cropbox.lower_left = (0, 0)
        source.cropbox.upper_right = (100, 99)
        with self.assertRaisesRegex(ValueError, "PDF_LINK_TARGET_GEOMETRY_REQUIRES_REVIEW"):
            page_target(self.target(), [self.owner], self.reader, self.observation)
