"""Authored comparisons retain both lines without reclassifying prose or dropping repetitions."""

import hashlib
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_boundary import inferred_continuation
from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementResponse
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins

PAIRS = [
    ("An original comparison", "A different comparison"),
    ("An unchanged observation", "An unchanged observation"),
    ("A second repeated finding", "A second repeated finding"),
    ("The fourth observation", "The other fourth observation"),
    ("The final original point", "The final contrasting point"),
]
BODY = [
    "Ordinary prose supplies a broad body measure and continues through a normal printed line.",
    "The next authored line continues that prose and should lose only its printed wrapping.",
    "Another broad body line keeps the fixture independent of the classifier under test.",
    "The final body line confirms this is ordinary prose outside the comparison display.",
]


def fixture(path, pairs=PAIRS, body_first_x=48):
    writer = PdfWriter()
    page = writer.add_blank_page(width=600, height=800)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Times-Roman"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
    )
    rows = [("Preface", 48, 740)]
    for index, pair in enumerate(pairs):
        rows.extend((line, 84, 700 - index * 45 - offset * 15) for offset, line in enumerate(pair))
    rows.extend(
        (line, body_first_x if index == 0 else 48, 390 - index * 15)
        for index, line in enumerate(BODY)
    )
    stream = DecodedStreamObject()
    stream.set_data(
        "\n".join(f"BT /F1 11 Tf {x} {y} Td ({line}) Tj ET" for line, x, y in rows).encode()
    )
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)


class NativePairedLines(unittest.TestCase):
    def segments(self, path, pairs=PAIRS):
        fixture(path, pairs)
        pages = prepare_source(path, path.parent, hashlib.sha256(path.read_bytes()).hexdigest())
        _, segments, _ = source_segments(path, path.parent, pages, [])
        return segments

    def test_source_pairs_keep_lines_words_and_paragraph_role(self):
        with tempfile.TemporaryDirectory() as directory:
            segments = self.segments(Path(directory) / "source.pdf")
            displayed = [s for s in segments if s.preserve_line_breaks]
            self.assertEqual(["\n".join(pair) for pair in PAIRS], [s.text for s in displayed])
            self.assertTrue(all(s.kind == "paragraph" for s in displayed))
            self.assertTrue(all(s.style.indent_em == 0 for s in displayed))
            self.assertTrue(all(abs(s.style.block_indent_em - 36 / 11) < 0.001 for s in displayed))
            self.assertTrue(all(s.text == s.source_text for s in displayed))
            body = next(s for s in segments if s.text.startswith(BODY[0]))
            self.assertEqual(" ".join(BODY), body.text)
            self.assertFalse(body.preserve_line_breaks)

    def test_ordinary_first_line_indent_does_not_become_block_indent(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.pdf"
            fixture(path, body_first_x=70)
            pages = prepare_source(path, path.parent, hashlib.sha256(path.read_bytes()).hexdigest())
            _, segments, _ = source_segments(path, path.parent, pages, [])
            body = next(s for s in segments if s.text.startswith(BODY[0]))
            self.assertIsNone(body.style.block_indent_em)
            self.assertAlmostEqual(body.style.indent_em, 2)

    def test_qualified_single_line_fragment_keeps_block_indent(self):
        from ava_pdf_epub.reconstruction_v2.native_spacing import native_spacing

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.pdf"
            fixture(path)
            pages = prepare_source(path, path.parent, hashlib.sha256(path.read_bytes()).hexdigest())
            pair = next(s for s in pages[0].native_segments if s.preserve_line_breaks)
            line_id = pair.native_line_ids[0]
            line = next(row for row in pages[0].observation.lines if row.id == line_id)
            partial = pair.model_copy(update={"native_line_ids": [line_id], "box": line.box})
            result = native_spacing(pages[0].observation, [partial])[0]
            self.assertAlmostEqual(result.style.block_indent_em, 36 / 11)
            self.assertEqual(result.style.indent_em, 0)

    def test_qualified_pair_is_not_centered_by_midpoint_coincidence(self):
        from ava_pdf_epub.reconstruction_v2.native_spacing import native_spacing

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.pdf"
            fixture(path)
            pages = prepare_source(path, path.parent, hashlib.sha256(path.read_bytes()).hexdigest())
            pair = next(s for s in pages[0].native_segments if s.preserve_line_breaks)
            paired = pair.model_copy(
                update={
                    "box": pair.box.model_copy(
                        update={"x1": pages[0].observation.width_pt - pair.box.x0}
                    )
                }
            )
            result = native_spacing(pages[0].observation, [paired])[0]
            self.assertEqual(result.style.align, "start")
            self.assertAlmostEqual(result.style.block_indent_em, 36 / 11)

    def test_no_repetition_or_isolated_pair_does_not_trigger_display(self):
        for pairs in (
            [PAIRS[1]],
            [(f"First observation {i}", f"Second observation {i}") for i in range(5)],
        ):
            with self.subTest(pairs=pairs), tempfile.TemporaryDirectory() as directory:
                segments = self.segments(Path(directory) / "source.pdf", pairs)
                self.assertFalse(any(s.preserve_line_breaks for s in segments))
                self.assertFalse(any(s.kind == "verse" for s in segments))

    def test_cross_page_display_join_keeps_newline_and_refuses_prose_mismatch(self):
        with tempfile.TemporaryDirectory() as directory:
            first = next(
                s for s in self.segments(Path(directory) / "source.pdf") if s.preserve_line_breaks
            )
            a = first.model_copy(
                update={"text": "first comparison", "source_text": None, "spans": []}
            )
            b = first.model_copy(
                update={
                    "id": "page2-first",
                    "page": 2,
                    "text": "second comparison",
                    "source_text": None,
                    "spans": [],
                }
            )
            state = AssemblyState(evidence={a.id: [], b.id: []})
            joined = stream_joins([a, b], state)
            self.assertEqual(["first comparison\nsecond comparison"], [s.text for s in joined])
            plain = b.model_copy(update={"preserve_line_breaks": False})
            self.assertFalse(inferred_continuation(a, plain, AssemblyState()))
            self.assertEqual(2, len(stream_joins([a, plain], AssemblyState())))

    def test_pairs_survive_canonical_export_and_epub_reimport(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "source.pdf"
            fixture(path)
            pages = prepare_source(path, path.parent, hashlib.sha256(path.read_bytes()).hexdigest())
            _, segments, state = source_segments(path, path.parent, pages, [])
            tasks = prepare_refinement(path, path.parent, pages, segments, state)
            receipts = []
            for task in tasks:
                crops = {c.node_id: c.id for c in task.crops if c.part == "head"}
                decisions = []
                for node in task.nodes:
                    if node.id not in task.decision_ids:
                        continue
                    self.assertEqual("Preface", node.text_excerpt)
                    decisions.append(
                        dict(
                            node_id=node.id,
                            text_sha256=node.text_sha256,
                            evidence_ids=[crops[node.id], crops[node.body_reference_id]],
                            role_kind="heading",
                            style=None,
                            heading_level=1,
                            parent_id=None,
                            chapter_start=True,
                            chapter_role="frontmatter",
                        )
                    )
                receipts.append(
                    BookRefinementResponse.model_validate(
                        dict(
                            schema_version="ava-book-refinement-response-3",
                            task_id=task.task_id,
                            source_sha256=task.source_sha256,
                            observation_sha256=task.observation_sha256,
                            image_sha256=task.image.sha256,
                            decisions=decisions,
                            joins=[],
                            unresolved=[],
                        )
                    )
                )
            result = reconstruct(path, path.parent, pages, [], receipts)
            expected = ["\n".join(pair) for pair in PAIRS]
            blocks = [b for b in result.book.blocks if b.content and b.content.text in expected]
            self.assertEqual(expected, [b.content.text for b in blocks])
            self.assertTrue(all(b.kind == "paragraph" for b in blocks))
            self.assertTrue(all(b.content.normalization is None for b in blocks))
            imported, _ = portable_epub(result.epub)
            self.assertEqual(result.book, imported)
