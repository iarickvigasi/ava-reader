"""Optional source candidates preserve physical text without qualifying it as native."""

import unittest

from ava_pdf_epub.reconstruction_v2.index_layout import mark_index_layout
from ava_pdf_epub.reconstruction_v2.index_transcription_candidates import (
    index_transcription_candidates,
)
from ava_pdf_epub.reconstruction_v2.native_structure_source import qualified_native_lines
from ava_pdf_epub.reconstruction_v2.observations import Graphic, RequiredRegion

from .index_fixture import index_page
from .test_ocr_link_context import line
from .test_pdf_links import box

PROFILE = "ava-pdf-prose-en-uk-v3"


class IndexTranscriptionCandidateTests(unittest.TestCase):
    def test_fused_stream_rows_are_literal_candidates_in_column_order(self):
        page = index_page(fused=True)
        rows = [
            line("left0", "Schrodinger’s Cat  170", 36, 100) if r.id == "left0" else r
            for r in page.lines
        ]
        page = mark_index_layout(page.model_copy(update={"lines": rows}))
        raw = page.model_dump_json()
        hint = index_transcription_candidates(page, PROFILE)["untrusted_index_candidates"]
        self.assertEqual("unverified_pdf_text", hint["basis"])
        self.assertEqual("physical_rows_not_logical_entries", hint["scope"])
        self.assertEqual("General index", hint["header"])
        self.assertEqual("Schrodinger’s Cat  170", hint["columns"][0][0])
        self.assertEqual("alpha2 12", hint["columns"][0][2])
        self.assertEqual([f"omega{i} {20 + i}" for i in range(6)], hint["columns"][1])
        self.assertEqual(raw, page.model_dump_json())
        self.assertIsNone(qualified_native_lines(page, PROFILE))

    def test_missing_hidden_artifact_or_unclaimed_content_omits_the_whole_hint(self):
        page = mark_index_layout(index_page())
        row = page.lines[-1]
        for lines in [
            page.lines[1:],
            [
                *page.lines,
                line("intro", "Unclaimed introduction spans both original columns", 36, 65),
            ],
            [*page.lines, page.lines[-1]],
            [
                *page.lines[:-1],
                row.model_copy(
                    update={"glyphs": [g.model_copy(update={"visible": False}) for g in row.glyphs]}
                ),
            ],
            [
                *page.lines[:-1],
                row.model_copy(
                    update={
                        "glyphs": [
                            g.model_copy(update={"source_artifact": True}) for g in row.glyphs
                        ]
                    }
                ),
            ],
            [r for r in page.lines if not r.id.startswith("right")],
        ]:
            self.assertEqual(
                {},
                index_transcription_candidates(page.model_copy(update={"lines": lines}), PROFILE),
            )

    def test_unsafe_and_non_index_observations_keep_existing_recognition(self):
        page = mark_index_layout(index_page())
        for changes in [
            {"risks": []},
            {"risks": [*page.risks, "unknown"]},
            {"risks": [*page.risks, "native_spacing_unavailable"]},
            {"rotation": 90},
            {"graphics": [Graphic(kind="image", box=box(36, 100, 70, 110))]},
            {"required_regions": [RequiredRegion(kind="text", box=box(36, 100, 70, 110))]},
        ]:
            self.assertEqual(
                {}, index_transcription_candidates(page.model_copy(update=changes), PROFILE)
            )

    def test_oversize_literal_whitespace_cannot_overflow_the_evidence_envelope(self):
        page = mark_index_layout(index_page())
        rows = [
            r.model_copy(update={"text": r.text.replace(" ", " " * 100001)})
            if r.id == "left0"
            else r
            for r in page.lines
        ]
        self.assertEqual(
            {}, index_transcription_candidates(page.model_copy(update={"lines": rows}), PROFILE)
        )
