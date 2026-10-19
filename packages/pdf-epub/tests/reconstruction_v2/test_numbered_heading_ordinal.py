"""A numbered-title tab never excuses a second gap or reversal inside a multi-digit ordinal."""

import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject

from .numbered_heading_fixture import fixture
from .test_pdf_links import box


class NumberedHeadingOrdinalTests(unittest.TestCase):
    def test_contiguous_multi_digit_ordinal_passes_but_separated_or_reversed_digits_refuse(self):
        for mode in ("contiguous", "gap", "reversed"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                f = fixture(Path(directory), subtitle=False)
                page = f.page.model_copy(deep=True)
                original = page.lines[0]
                left, right = (10, 4) if mode == "reversed" else (4, 14 if mode == "gap" else 8)
                glyphs = [
                    original.glyphs[0].model_copy(
                        update={"text": text, "box": box(x, 10, x + 4, 20)}
                    )
                    for text, x in (("1", left), ("2", right))
                ]
                page.lines[0] = original.model_copy(
                    update={
                        "text": "12",
                        "box": box(4, 10, max(left, right) + 4, 20),
                        "glyphs": glyphs,
                    }
                )
                for i in (1, 2):
                    line = page.lines[i]
                    moved = line.box.model_copy(
                        update={"x0": line.box.x0 + 10, "x1": line.box.x1 + 10}
                    )
                    shifted = [
                        g.model_copy(
                            update={
                                "box": g.box.model_copy(
                                    update={"x0": g.box.x0 + 10, "x1": g.box.x1 + 10}
                                )
                            }
                        )
                        for g in line.glyphs
                    ]
                    page.lines[i] = line.model_copy(update={"box": moved, "glyphs": shifted})
                owner = f.owners[0].model_copy(
                    update={
                        "text": f.owners[0].text.replace("5 ", "12 ", 1),
                        "box": box(4, 10, 94, 32),
                    }
                )
                writer = PdfWriter(clone_from=f.source)
                first = writer._root_object["/Outlines"]["/First"]
                first[NameObject("/Title")] = TextStringObject(
                    str(first["/Title"]).replace("5 ", "12 ", 1)
                )
                writer.write(f.source)
                f.reader = PdfReader(f.source)
                if mode == "contiguous":
                    self.assertEqual(
                        ("chapter", 0), f.resolve(page=page, owners=[owner, *f.owners[1:]])
                    )
                else:
                    with self.assertRaisesRegex(ValueError, "TARGET_GEOMETRY"):
                        f.resolve(page=page, owners=[owner, *f.owners[1:]])
