"""An external CID is distinguishable from an unsafe or incomplete local mapping."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.observations import Graphic
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan

from .local_font_fixture import observed, result, source
from .test_pdf_links import box
from .test_refinement_grouping import segment


class LocalFontMappingTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / "source.pdf"
        source(self.path)

    def test_external_cid_corroborates_only_fonts_under_current_authority(self):
        before, got, state = result(self.path, observed())
        self.assertEqual(got[0].style.family, "sans-serif")
        self.assertEqual(before[0].text, got[0].text)
        self.assertEqual(before[0].box, got[0].box)
        self.assertEqual(before[0].method, got[0].method)
        self.assertIn("regional mapping", state.structure_findings[0].message)
        old, unchanged, old_state = result(self.path, observed(), current=False)
        self.assertEqual(old, unchanged)
        self.assertEqual(old_state.structure_findings, [])

    def test_local_incomplete_hidden_artifact_or_unexplained_risk_never_qualifies(self):
        page = observed()
        line = page.lines[0]
        cases = [
            page.model_copy(update=dict(lines=[line])),
            page.model_copy(update=dict(risks=[*page.risks, "unknown_mapping_risk"])),
            page.model_copy(update=dict(risks=[*page.risks, "clipped_glyph"])),
            page.model_copy(update=dict(graphics=[Graphic(kind="image", box=box())])),
        ]
        for update in [
            dict(text="x"),
            dict(text="(cid:4)"),
            dict(text="\ufffd"),
            dict(visible=False),
            dict(source_artifact=True),
        ]:
            local = line.model_copy(
                update=dict(glyphs=[line.glyphs[0].model_copy(update=update), line.glyphs[1]])
            )
            cases.append(page.model_copy(update=dict(lines=[local, page.lines[1]])))
        for candidate in cases:
            with self.subTest(page=candidate):
                before, got, state = result(self.path, candidate)
                self.assertEqual(before, got)
                self.assertEqual(state.structure_findings, [])

    def test_nonfont_styles_links_ranges_and_all_other_fields_remain_exact(self):
        item = segment("ocr", "Go").model_copy(
            update=dict(
                box=box(),
                style=Style(id="base", family="serif", align="right", color="#123456"),
                spans=[
                    ObservedSpan(
                        start=0,
                        end=2,
                        url="https://example.org/",
                        style=Style(id="span", italic=True, underline=True, color="#654321"),
                    )
                ],
            )
        )
        before, got, _ = result(self.path, observed(), [item])
        self.assertEqual(
            before[0].model_dump(exclude={"style", "spans"}),
            got[0].model_dump(exclude={"style", "spans"}),
        )
        self.assertEqual(got[0].style.color, "#123456")
        self.assertEqual(got[0].style.align, "right")
        self.assertEqual(got[0].spans[0].url, item.spans[0].url)
        self.assertEqual(got[0].spans[0].style.color, "#654321")
        self.assertTrue(got[0].spans[0].style.underline)

    def test_another_native_owner_of_the_same_ink_is_ambiguous(self):
        item = segment("ocr", "Go").model_copy(update=dict(box=box()))
        native = item.model_copy(update=dict(id="native", method="native"))
        before, got, state = result(self.path, observed(), [item, native])
        self.assertEqual(before, got)
        self.assertEqual(state.structure_findings, [])
