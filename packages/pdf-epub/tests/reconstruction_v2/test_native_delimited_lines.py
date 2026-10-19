"""Authored activity rows are prose display lines, not poetry inferred from semicolons."""

import hashlib
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments
from tests.reconstruction_v2.test_native_literal import responses

ITEMS = [
    "Choose a new chapter to read;",
    "Record the main observations in a notebook;",
    "Take a quiet walk along the river;",
    "Compare the results with a colleague;",
    "Ask the keeper for another example;",
    "Spend some time outside the city and return with a notebook "
    "after recording the observations carefully.",
]
BODY = [
    "The ordinary body paragraph provides the complete broad measure for this source page.",
    "Every original word remains available without replacing a source-backed observation.",
    "A third prose line identifies the normal margin and gives nearby printed context.",
    "The final body line stays separate from the choices that follow in the source.",
]


def activity_source(
    path,
    introduction="A reader may choose the following activities:",
    inset=66,
    first_y=640,
    intro_x=48,
    wrap_x=48,
):
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    fonts = {}
    for name, base in [("F1", "Times-Roman"), ("F2", "Times-Italic")]:
        fonts[NameObject("/" + name)] = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/" + base),
            }
        )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject(fonts)}
    )
    rows = [("Preface", 48, 770)]
    rows += [(text, 48, 735 - index * 15) for index, text in enumerate(BODY)]
    rows += [(introduction, intro_x, 655)]
    rows += [(text, inset, first_y - index * 15) for index, text in enumerate(ITEMS[:5])]
    rows += [
        ("Spend some time outside the city and return with a notebook", inset, first_y - 75),
        ("after recording the observations carefully.", wrap_x, first_y - 90),
        ("The next ordinary paragraph remains outside the activity choices.", 48, 520),
    ]
    commands = []
    for text, x, y in rows:
        if "quiet" in text:
            before, after = text.split("quiet")
            commands.append(
                f"BT /F1 11 Tf {x} {y} Td ({before}) Tj /F2 11 Tf (quiet) Tj "
                f"/F1 11 Tf ({after}) Tj ET"
            )
        else:
            commands.append(f"BT /F1 11 Tf {x} {y} Td ({text}) Tj ET")
    stream = DecodedStreamObject()
    stream.set_data("\n".join(commands).encode())
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)


class NativeDelimitedLines(unittest.TestCase):
    def assert_activity_roundtrip(self, inset=66, first_y=640, intro_x=48, wrap_x=48):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "activities.pdf"
            activity_source(path, inset=inset, first_y=first_y, intro_x=intro_x, wrap_x=wrap_x)
            scratch = path.parent
            pages = prepare_source(path, scratch, hashlib.sha256(path.read_bytes()).hexdigest())
            _, segments, state = source_segments(path, scratch, pages, [])
            tasks = prepare_refinement(path, scratch, pages, segments, state)
            result = reconstruct(path, scratch, pages, [], responses(tasks, "paragraph"))
            self.assertFalse(any(b.kind == "verse" for b in result.book.blocks))
            activity = next(
                b
                for b in result.book.blocks
                if hasattr(b, "content") and b.content.text.startswith(ITEMS[0])
            )
            self.assertEqual("paragraph", activity.kind)
            self.assertEqual("\n".join(ITEMS), activity.content.text)
            self.assertFalse(result.book.lists)
            self.assertIsNotNone(activity.content.normalization)
            self.assertEqual(
                1, sum(s.kind == "line_wrap" for s in activity.content.normalization.segments)
            )
            self.assertEqual(5, activity.content.text.count("\n"))
            self.assertTrue(
                any(
                    hasattr(b, "content")
                    and b.content.text.startswith("The next ordinary paragraph")
                    and b.id != activity.id
                    for b in result.book.blocks
                )
            )
            at = activity.content.text.index("quiet")
            styles = {s.id: s for s in result.book.styles}
            self.assertTrue(
                any(
                    span.start <= at < span.end and styles[span.style_id].italic
                    for span in activity.content.spans
                    if span.style_id
                )
            )
            imported, _ = portable_epub(result.epub)
            self.assertEqual(result.book, imported)
            return result.book, activity

    def test_source_delimited_activities_keep_item_breaks_and_unwrap_only_last_item(self):
        self.assert_activity_roundtrip()

    def test_margin_aligned_source_display_requires_a_separated_colon_intro(self):
        self.assert_activity_roundtrip(inset=48, first_y=630)

    def test_intro_alignment_does_not_erase_body_relative_inset(self):
        book, activity = self.assert_activity_roundtrip(
            inset=66, first_y=630, intro_x=66, wrap_x=66
        )
        style = next(s for s in book.styles if s.id == activity.style_id)
        self.assertAlmostEqual(18 / 11, style.block_indent_em)
        self.assertEqual(0, style.indent_em)

    def test_no_colon_does_not_make_short_prose_poetry_or_a_literal_display(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "prose.pdf"
            activity_source(path, "These are ordinary lines without a source introduction.")
            pages = prepare_source(path, path.parent, hashlib.sha256(path.read_bytes()).hexdigest())
            _, segments, _ = source_segments(path, path.parent, pages, [])
            self.assertFalse(any(s.kind == "verse" for s in segments))
            self.assertFalse(any(s.preserve_line_breaks for s in segments))
            self.assertEqual(1, sum(s.text.count("Take a quiet walk") for s in segments))
