"""Positive non-quote context preserves typography without excusing ambiguous quotations."""

import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.page_checkpoints import PreparedPageMap
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan
from ava_pdf_epub.reconstruction_v2.source_feature_selection import source_feature_selection
from ava_pdf_epub.reconstruction_v2.source_feature_tasks import source_feature_tasks
from ava_pdf_epub.reconstruction_v2.source_nonquote_context import (
    nonquote_context,
    record_contents_context,
)
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal
from ava_pdf_epub.reconstruction_v2.structure_claims import StructureClaim

from .source_feature_fixtures import case


class NonquoteContextTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source, self.page, self.segments, _, _ = case(self.root, include_quote=False)
        self.pages = PreparedPageMap([self.page])
        self.row = self.segments[-1].model_copy(
            update={
                "text": "Preface vii",
                "style": Style(id="observed", italic=True),
                "spans": [ObservedSpan(start=8, end=11, style=Style(id="upright", italic=False))],
            }
        )
        self.claim = StructureClaim("Preface", self.row.id, printed_page="vii")

    def test_complete_contents_keeps_styles_and_optional_unknowns_without_model_call(self):
        state = AssemblyState()
        record_contents_context([self.claim], [self.row], state)
        before = self.row.model_dump()
        self.assertEqual(
            [],
            source_feature_tasks(
                self.source,
                self.root,
                [self.page],
                [self.row],
                state,
                0,
            ),
        )
        self.assertEqual(before, self.row.model_dump())
        self.assertEqual(4, len(state.source_feature_evidence))
        self.assertTrue(
            all(e["reason"] == "source_context_unavailable" for e in state.source_feature_evidence)
        )
        state.release_observations()
        self.assertEqual({}, state.source_contents_rows)

    def test_partial_or_stale_contents_proof_does_not_excuse_italic_prose(self):
        for text in [
            "Preface vii and an unrelated passage",
            "Preface vii\nAfterword x",
            "Other vii",
        ]:
            changed = self.row.model_copy(update={"text": text, "spans": []})
            state = AssemblyState()
            record_contents_context([self.claim], [changed], state)
            self.assertEqual({}, state.source_contents_rows)
            with self.assertRaises(SourceContentRefusal):
                source_feature_selection([changed], self.pages, state)
        state = AssemblyState()
        record_contents_context([self.claim], [self.row], state)
        for changes in [
            {"text": "Another vii"},
            {"kind": "quote"},
            {"box": self.row.box.model_copy(update={"x0": 41})},
            {"continues_to_next": True},
        ]:
            changed = self.row.model_copy(update=changes)
            with self.assertRaises(SourceContentRefusal):
                source_feature_selection([changed], self.pages, state)

    def test_contents_with_body_keeps_style_comparison_without_quote_authority(self):
        state = AssemblyState()
        record_contents_context([self.claim], [self.row], state)
        body = next(s for s in self.segments if s.id == "body")
        requests, _, missing = source_feature_selection([self.row, body], self.pages, state)
        self.assertEqual([], missing)
        self.assertEqual(1, len(requests))
        self.assertEqual([], requests[0].allowed_roles)
        self.assertNotIn("paragraph_role", requests[0].requested_features)
        self.assertIn("italic", requests[0].requested_features)

    def notice(self):
        image = Image.new("RGB", (1024, 1280), "white")
        draw, font = ImageDraw.Draw(image), ImageFont.load_default(size=24)
        text = "This page intentionally left blank"
        width = draw.textlength(text, font=font)
        x, y = (1024 - width) / 2, 180
        draw.text((x, y), text, font=font, fill="black")
        self.source = self.root / "sole-notice.pdf"
        image.save(self.source, format="PDF", resolution=144)
        self.page = prepare_page(self.source, self.root, 1)
        self.pages = PreparedPageMap([self.page])
        return self.row.model_copy(
            update={
                "id": f"page1-{self.page.tasks[0].task_id[10:22]}-0",
                "text": text,
                "spans": [],
                "box": self.row.box.model_copy(
                    update={"x0": x / 2, "x1": (x + width) / 2, "y0": y / 2, "y1": (y + 30) / 2}
                ),
                "style": Style(id="notice", italic=True, align="center"),
            }
        )

    def test_exact_sole_centered_notice_retains_italic_and_conditional_ocr_risk(self):
        notice, state = self.notice(), AssemblyState()
        page = self.page.model_copy(
            update={
                "observation": self.page.observation.model_copy(
                    update={"risks": ["conditional_visibility"]}
                )
            }
        )
        before = notice.model_dump()
        self.assertTrue(nonquote_context(notice, [notice], PreparedPageMap([page]), state))
        self.assertEqual(
            [],
            source_feature_tasks(
                self.source,
                self.root,
                [page],
                [notice],
                state,
                0,
            ),
        )
        self.assertEqual(before, notice.model_dump())
        self.assertEqual(["conditional_visibility"], page.observation.risks)
        self.assertEqual(4, len(state.source_feature_evidence))

    def test_notice_lookalikes_links_continuation_extra_content_and_risks_stay_refused(self):
        notice = self.notice()
        for change in [
            {"text": "An italic epigraph"},
            {"text": notice.text + " — A visitor"},
            {"kind": "quote"},
            {"continues_from_previous": True},
            {"related_to": "other"},
            {"style": Style(id="notice", italic=True, align="left")},
            {"box": notice.box.model_copy(update={"x0": 1, "x1": 100})},
            {"spans": [ObservedSpan(start=0, end=4, url="https://example.org")]},
        ]:
            changed = notice.model_copy(update=change)
            with self.assertRaises(SourceContentRefusal):
                source_feature_selection([changed], self.pages, AssemblyState())
        extra = notice.model_copy(update={"id": "attribution", "text": "A visitor"})
        with self.assertRaises(SourceContentRefusal):
            source_feature_selection([notice, extra], self.pages, AssemblyState())
        for risks in [["optional_content"], ["unknown-risk"]]:
            page = self.page.model_copy(
                update={"observation": self.page.observation.model_copy(update={"risks": risks})}
            )
            with self.assertRaises(SourceContentRefusal):
                source_feature_selection([notice], PreparedPageMap([page]), AssemblyState())
        state = AssemblyState(internal_targets=[("other", 0, 1, notice.id, 0)])
        with self.assertRaises(SourceContentRefusal):
            source_feature_selection([notice], self.pages, state)

    def test_full_page_ocr_owner_and_graphic_coverage_are_required(self):
        notice = self.notice()
        task = self.page.tasks[0]
        for change in [
            {"source_sha256": "f" * 64},
            {"page_number": 2},
            {"region_box": task.region_box.model_copy(update={"x0": 1})},
            {"profile_id": "other"},
            {"page_width_pt": 123},
            {"task_id": "recognize-" + "f" * 64},
        ]:
            page = self.page.model_copy(update={"tasks": [task.model_copy(update=change)]})
            self.assertFalse(
                nonquote_context(notice, [notice], PreparedPageMap([page]), AssemblyState())
            )
        for tasks in [[], [task, task]]:
            page = self.page.model_copy(update={"tasks": tasks})
            self.assertFalse(
                nonquote_context(notice, [notice], PreparedPageMap([page]), AssemblyState())
            )
        graphic = self.page.observation.graphics[0]
        for graphics in [
            [graphic, graphic],
            [graphic.model_copy(update={"kind": "vector"})],
            [graphic.model_copy(update={"box": graphic.box.model_copy(update={"x1": 100})})],
        ]:
            page = self.page.model_copy(
                update={
                    "observation": self.page.observation.model_copy(update={"graphics": graphics})
                }
            )
            self.assertFalse(
                nonquote_context(notice, [notice], PreparedPageMap([page]), AssemblyState())
            )

    def test_long_upright_contents_row_is_not_ordinary_body_reference(self):
        text = (
            "A long printed navigation label that describes a chapter "
            "and is not an ordinary paragraph 22"
        )
        row = self.row.model_copy(update={"text": text, "style": None, "spans": []})
        heading = self.segments[0]
        state = AssemblyState()
        record_contents_context(
            [StructureClaim(text[:-3], row.id, printed_page="22")], [row], state
        )
        requests, _, missing = source_feature_selection([row, heading], self.pages, state)
        self.assertEqual([], requests)
        self.assertEqual({row.id, heading.id}, {s.id for s in missing})
