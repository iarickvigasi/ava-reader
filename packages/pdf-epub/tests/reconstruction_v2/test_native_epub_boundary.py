"""Real native PDF source oracles cross both lossless reader and visible EPUB boundaries."""

import io
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from ava_pdf_epub.contracts.blocks import ListItemBlock
from ava_pdf_epub.contracts.graph_links import TEXT_NODES
from ava_pdf_epub.epub_v2.context import Context
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.epub_v2.reader import prepare_reader
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct

FIXTURES = Path(__file__).parent / "fixtures"


class NativeEpubBoundary(unittest.TestCase):
    def verify_boundary(self, name, page_count, expected, expected_lists=()):
        source = FIXTURES / f"{name}.pdf"
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            pages = [prepare_page(source, scratch, page) for page in range(1, page_count + 1)]
            self.assertFalse(any(page.tasks for page in pages))
            result = reconstruct(source, scratch, pages, [])
        book = result.book
        ctx = Context(book)
        texts = [node.content.text for node in ctx.nodes.values() if isinstance(node, TEXT_NODES)]
        for text in expected:
            self.assertEqual(1, texts.count(text), text)
        self.assertEqual(
            sorted(texts.index(t) for t in expected), [texts.index(t) for t in expected]
        )
        self.assertEqual(
            list(expected_lists),
            [node.content.text for node in ctx.nodes.values() if isinstance(node, ListItemBlock)],
        )
        imported, assets = portable_epub(result.epub)
        self.assertEqual(book, imported)
        self.assertEqual(result.assets, assets)
        first = prepare_reader(book, "original-native-content")
        second = prepare_reader(imported, "new-owned-epub-content")
        self.assertEqual(first.book, second.book)
        self.assertEqual(first.required_capabilities, second.required_capabilities)
        self.assertNotEqual(first.final_content_id, second.final_content_id)
        with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
            entries = {path: archive.read(path) for path in archive.namelist()}
        roots = [ET.fromstring(entries["EPUB/" + ctx.paths[chapter]]) for chapter in book.spine]
        visible = [
            (node.get("data-ava-text"), "".join(node.itertext()))
            for root in roots
            for node in root.iter()
            if node.get("data-ava-text")
        ]
        wanted = [
            (node.id, node.content.text)
            for node in ctx.nodes.values()
            if isinstance(node, TEXT_NODES)
        ]
        self.assertEqual(wanted, visible)
        self.assertEqual(len(wanted), len({identifier for identifier, _ in visible}))
        for path, data in entries.items():
            if not path.endswith(".xhtml"):
                continue
            root = ET.fromstring(data)
            ids = [n.get("id") for n in root.iter() if n.get("id")]
            self.assertEqual(len(ids), len(set(ids)), path)
            for link in (n.get("href") for n in root.iter() if n.get("href")):
                if link.startswith("../") and "#" in link:
                    target, fragment = link.split("#")
                    tree = ET.fromstring(entries["EPUB/" + target.removeprefix("../")])
                    self.assertEqual(1, sum(n.get("id") == fragment for n in tree.iter()), link)

    def test_complete_native_oracle_and_rich_generated_epub_reimport(self):
        oracle = json.loads((FIXTURES / "native-oracle.json").read_text())
        expected = []
        list_texts = []
        for paragraph in oracle["paragraphs"]:
            if paragraph["kind"] == "list":
                for item in paragraph["items"]:
                    item_texts = [item["text"], *item["children"]]
                    list_texts.extend(item_texts)
                    expected.extend(item_texts)
            elif paragraph["kind"] != "table":
                expected.append(paragraph["text"])
        self.assertEqual(
            ["Pack the lantern.", "Check the wick.", "Keep the spare match dry.", "Fold the map."],
            list_texts,
        )
        self.verify_boundary("native", 8, expected, list_texts)

    def test_two_column_interruptions_joins_and_restarted_note_labels(self):
        oracle = json.loads((FIXTURES / "two-column-oracle.json").read_text())
        expected = [node["text"] for node in oracle["nodes"] if "text" in node]
        self.verify_boundary("two-column", 3, expected)
