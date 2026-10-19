"""Independent source actions, labels, titles and repeated rows must all agree."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, NumberObject, TextStringObject

from .toc_caller_fixture import fixture


class TocCallerAuthorityTests(unittest.TestCase):
    def test_no_implicit_prefixed_duplicate_malformed_or_changed_source_label(self):
        for mode in (
            "implicit",
            "prefix",
            "duplicate",
            "nested",
            "unsorted",
            "wrong",
            "style",
            "initial",
        ):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                f = fixture(Path(directory))
                writer = PdfWriter(clone_from=f.source)
                tree = writer._root_object["/PageLabels"]
                rule = tree["/Nums"][5]
                if mode == "implicit":
                    del writer._root_object["/PageLabels"]
                elif mode == "prefix":
                    rule[NameObject("/P")] = TextStringObject("p")
                elif mode == "duplicate":
                    tree["/Nums"].extend(
                        [NumberObject(4), DictionaryObject({NameObject("/S"): NameObject("/D")})]
                    )
                elif mode == "nested":
                    tree[NameObject("/Kids")] = ArrayObject([])
                elif mode == "unsorted":
                    tree["/Nums"][2] = NumberObject(3)
                elif mode == "wrong":
                    rule[NameObject("/St")] = NumberObject(2)
                elif mode == "style":
                    rule[NameObject("/S")] = NameObject("/A")
                elif mode == "initial":
                    rule[NameObject("/St")] = NumberObject(0)
                writer.write(f.source)
                f.reader = PdfReader(f.source)
                f.annotation = f.reader.pages[0]["/Annots"][0].get_object()
                self.assertIsNone(f.prove())

    def test_wrong_ambiguous_or_partial_outline_and_different_original_action_refuse(self):
        for mode in ("title", "target", "duplicate", "partial", "action", "foreign-action"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                f = fixture(Path(directory))
                writer = PdfWriter(clone_from=f.source)
                outline = writer._root_object["/Outlines"]["/First"].get_object()
                if mode == "title":
                    outline[NameObject("/Title")] = TextStringObject("1 Alpha - beta changed")
                elif mode == "partial":
                    outline[NameObject("/Title")] = TextStringObject("1 Alpha - beta")
                elif mode in ("target", "action"):
                    action = (
                        outline["/A"] if mode == "target" else writer.pages[0]["/Annots"][0]["/A"]
                    )
                    action["/D"][0] = writer.pages[4].indirect_reference
                elif mode == "duplicate":
                    writer.add_outline_item("1 Alpha - beta continued", 3)
                elif mode == "foreign-action":
                    writer.pages[0]["/Annots"][0].get_object()[NameObject("/A")] = DictionaryObject(
                        {
                            NameObject("/S"): NameObject("/URI"),
                            NameObject("/URI"): TextStringObject("https://example.org"),
                        }
                    )
                writer.write(f.source)
                f.reader = PdfReader(f.source)
                f.annotation = f.reader.pages[0]["/Annots"][0].get_object()
                self.assertIsNone(f.prove())

    def test_source_ordinal_is_optional_only_in_unique_complete_outline_title(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            writer = PdfWriter(clone_from=f.source)
            writer._root_object["/Outlines"]["/First"][NameObject("/Title")] = TextStringObject(
                "Alpha - beta continued"
            )
            writer.write(f.source)
            f.reader = PdfReader(f.source)
            f.annotation = f.reader.pages[0]["/Annots"][0].get_object()
            self.assertEqual([("wrapped", 0, len(f.owners[0].text))], f.prove())
