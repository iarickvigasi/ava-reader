"""Cover assets require source evidence and keep pixels separate from selectable prose."""

import hashlib
import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.observations import Graphic
from ava_pdf_epub.reconstruction_v2.source_cover import preserve_source_cover

from .test_ocr_font_faces import checkpoint
from .test_pdf_links import box, observation


class SourceCoverTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.scratch = Path(self.directory.name)
        image = Image.new("RGB", (100, 100), "#abc123")
        image.putpixel((20, 30), (12, 34, 56))
        image.save(self.scratch / "page.png")
        self.bytes = (self.scratch / "page.png").read_bytes()
        page = observation().model_copy(
            update={
                "graphics": [Graphic(kind="image", box=box(0, 0, 100, 100))],
                "render_sha256": hashlib.sha256(self.bytes).hexdigest(),
            }
        )
        self.prepared = [checkpoint(page)]
        self.pages = [{"regions": [{"id": "existing", "band": 1, "column": 0}]}]
        self.chapters = [{"role": "frontmatter"}]
        self.metadata = [
            {
                "field": "title",
                "status": "accepted",
                "evidence": [{"page": 1, "box": box().model_dump()}],
            }
        ]
        self.state = AssemblyState()

    def extract(self):
        return preserve_source_cover(
            self.prepared, self.pages, self.chapters, self.metadata, self.scratch, self.state
        )

    def test_preserves_exact_pixels_and_explicit_source_accounting_without_text(self):
        ident = self.extract()
        self.assertIsNotNone(ident)
        with Image.open(io.BytesIO(self.state.assets[ident])) as actual:
            with Image.open(io.BytesIO(self.bytes)) as source:
                self.assertEqual(source.size, actual.size)
                self.assertEqual(source.tobytes(), actual.tobytes())
        resource = self.state.resources[0]
        self.assertEqual(hashlib.sha256(self.state.assets[ident]).hexdigest(), resource["sha256"])
        self.assertEqual("render", resource["evidence"][0]["method"])
        self.assertEqual("page1-source-cover", self.pages[0]["regions"][-1]["id"])
        self.assertEqual("cover", self.pages[0]["regions"][-1]["role"])
        self.assertEqual(1, self.pages[0]["regions"][0]["band"])
        self.assertEqual([], self.state.blocks)
        self.assertEqual("SOURCE_COVER_PIXELS_PRESERVED", self.state.structure_findings[0].code)

    def test_unknown_conflicting_or_later_title_does_not_invent_a_cover(self):
        cases = [
            [],
            self.metadata * 2,
            [{**self.metadata[0], "status": "unknown"}],
            [{**self.metadata[0], "evidence": [{"page": 2, "box": box().model_dump()}]}],
        ]
        for metadata in cases:
            with self.subTest(metadata=metadata):
                self.metadata = metadata
                self.assertIsNone(self.extract())
                self.assertEqual({}, self.state.assets)

    def test_body_small_or_ambiguous_art_is_not_misclassified(self):
        self.chapters = [{"role": "body"}]
        self.assertIsNone(self.extract())
        self.chapters = [{"role": "frontmatter"}]
        page = self.prepared[0].observation
        for graphics in ([Graphic(kind="image", box=box())], page.graphics * 2, []):
            self.prepared = [checkpoint(page.model_copy(update={"graphics": graphics}))]
            self.assertIsNone(self.extract())
        self.assertEqual({}, self.state.assets)

    def test_title_must_be_inside_source_art_and_render_must_be_unchanged(self):
        page = self.prepared[0].observation
        self.prepared = [
            checkpoint(
                page.model_copy(
                    update={"graphics": [Graphic(kind="image", box=box(10, 0, 100, 100))]}
                )
            )
        ]
        self.assertIsNone(self.extract())
        self.prepared = [checkpoint(page)]
        (self.scratch / "page.png").write_bytes(b"changed")
        with self.assertRaises((ValueError, OSError)):
            self.extract()
        self.assertEqual({}, self.state.assets)

    def test_existing_identical_asset_is_reused_with_cover_evidence(self):
        first = self.extract()
        self.state.resources[0]["evidence"] = [
            {"page": 1, "region_id": "existing", "method": "render", "box": box().model_dump()}
        ]
        self.pages = [{"regions": []}]
        second = self.extract()
        self.assertEqual(first, second)
        self.assertEqual(1, len(self.state.resources))
        self.assertEqual(1, len(self.state.assets))
        self.assertEqual(
            ["existing", "page1-source-cover"],
            [e["region_id"] for e in self.state.resources[0]["evidence"]],
        )
