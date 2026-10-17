"""Chapter-local headings preserve source sections without a skipped semantic parent."""

import io
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.heading_hierarchy import section_level
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct

FIXTURES = Path(__file__).parent / "fixtures"
XHTML = "{http://www.w3.org/1999/xhtml}"


class HeadingHierarchyTest(unittest.TestCase):
    def test_native_sections_rank_within_their_chapter_and_emit_h2(self):
        source = FIXTURES / "native.pdf"
        oracle = json.loads((FIXTURES / "native-oracle.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = [prepare_page(source, scratch, page) for page in range(1, 9)]
            result = reconstruct(source, scratch, pages, [])
        blocks = {b.id: b for b in result.book.blocks}
        with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
            opf = ET.fromstring(archive.read("EPUB/package.opf"))
            ns = {"opf": "http://www.idpf.org/2007/opf"}
            items = {
                n.attrib["id"]: n.attrib["href"] for n in opf.findall("opf:manifest/opf:item", ns)
            }
            spine = [items[n.attrib["idref"]] for n in opf.findall("opf:spine/opf:itemref", ns)]
            for chapter, expected, href in zip(
                result.book.chapters, oracle["chapters"], spine, strict=True
            ):
                document = ET.fromstring(archive.read("EPUB/" + href))
                for section in expected["sections"]:
                    matches = [
                        blocks[i]
                        for i in chapter.block_ids
                        if blocks[i].kind == "heading"
                        and blocks[i].content.text == section["title"]
                    ]
                    self.assertEqual(1, len(matches))
                    self.assertEqual(2, matches[0].level)
                    self.assertTrue(
                        any(
                            "".join(h.itertext()) == section["title"]
                            for h in document.iter(XHTML + "h2")
                        )
                    )
                    self.assertTrue(
                        any(t.label == section["title"] and t.parent_id for t in result.book.toc)
                    )

    def test_nested_and_later_larger_sections_never_invent_missing_ancestors(self):
        ancestors = []
        levels = [section_level(size, ancestors) for size in [14, 12, 11, 12, 17, 14, 17]]
        self.assertEqual([2, 3, 4, 3, 2, 3, 2], levels)
        ancestors.clear()
        self.assertEqual(2, section_level(11, ancestors))

    def test_corroborated_outline_level_wins_over_font_size_but_requires_parent(self):
        ancestors = []
        self.assertEqual(2, section_level(14, ancestors, 2))
        self.assertEqual(3, section_level(18, ancestors, 3))
        self.assertEqual(2, section_level(12, ancestors, 2))
        with self.assertRaisesRegex(ValueError, "unobserved parent"):
            section_level(10, [], 3)


if __name__ == "__main__":
    unittest.main()
