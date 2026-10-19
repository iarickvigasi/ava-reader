"""One coalesced source caller exports as one anchor and keeps exact portable text/styles."""

import io
import unittest
import zipfile
from xml.etree import ElementTree as ET

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.epub_v2.export import export_epub
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.append_internal_link import append_internal_link
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState

from .helpers import fixture


class InternalLinkExportTests(unittest.TestCase):
    def test_same_source_caller_reimports_with_styles_and_no_nested_anchor(self):
        original, assets, _ = fixture()
        raw = original.model_dump()
        block = next(b for b in raw["blocks"] if b["id"] == "style-demo")
        before = block["content"].copy()
        target = dict(kind="internal", chapter_id="chapter-two", block_id="heading-two", offset=0)
        state = AssemblyState()
        for identity, end in [("source-pdf", 17), ("source-contents", 12)]:
            append_internal_link(
                block["content"],
                dict(id=identity, start=0, end=end, link=target),
                state,
                block["id"],
            )
        self.assertEqual(block["content"]["text"], before["text"])
        self.assertEqual(block["content"]["sha256"], before["sha256"])
        raw["addresses"].append(
            dict(
                resource_path="text/chapter-one.xhtml",
                fragment="source-pdf",
                target=dict(
                    kind="internal", chapter_id="chapter-one", block_id="style-demo", offset=0
                ),
            )
        )
        book = CanonicalBookV2.model_validate(raw)
        data = export_epub(book, assets)
        self.assertEqual(portable_epub(data)[0], book)
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            paths = [
                name
                for name in archive.namelist()
                if name.endswith(".xhtml") and b'data-ava-block="style-demo"' in archive.read(name)
            ]
            self.assertEqual(len(paths), 1)
            document = ET.fromstring(archive.read(paths[0]))
        ns = "{http://www.w3.org/1999/xhtml}"
        paragraph = next(n for n in document.iter() if n.get("data-ava-block") == "style-demo")
        anchors = list(paragraph.iter(ns + "a"))
        self.assertEqual(len(anchors), 1)
        self.assertEqual("".join(anchors[0].itertext()), before["text"][:17])
        self.assertFalse(any(list(a.iter(ns + "a"))[1:] for a in anchors))
