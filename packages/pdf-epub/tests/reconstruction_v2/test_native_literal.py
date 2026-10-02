"""Authored source oracle separates a poem, wrapped quotation and ordinary indented prose."""

import hashlib
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementResponse
from ava_pdf_epub.reconstruction_v2.refinement_response import accept_refinement
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

LINES = ["The river holds the silver light", "The morning keeps its quiet song", "An invented poet"]
BODY = [
    "Ordinary prose follows the printed quotation and continues across the whole broad line.",
    "The keeper records every original word and keeps this source available for inspection.",
    "Another complete prose line supplies an independent observation of the body measure.",
    "This final ordinary line preserves the language without copying a copyrighted source.",
]


def source_pdf(path, role, lines=LINES):
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
    rows += [
        (line, 84, y)
        for line, y in zip(lines, [690 - 15 * i for i in range(len(lines))], strict=True)
    ]
    rows += [(line, 48, y) for line, y in zip(BODY, [620, 605, 590, 575], strict=True)]
    stream = DecodedStreamObject()
    stream.set_data(
        "\n".join(f"BT /F1 11 Tf {x} {y} Td ({text}) Tj ET" for text, x, y in rows).encode()
    )
    page[NameObject("/Contents")] = writer._add_object(stream)
    # Independent author intent; no classifier result defines this fixture's expected role.
    writer.add_metadata({"/Subject": role})
    writer.write(path)


def responses(tasks, role):
    output = []
    for task in tasks:
        crops = {c.node_id: c.id for c in task.crops if c.part == "head"}
        decisions = []
        for node in task.nodes:
            if node.id not in task.decision_ids:
                continue
            literal = node.candidate_original_kind == "verse"
            decisions.append(
                dict(
                    node_id=node.id,
                    text_sha256=node.text_sha256,
                    evidence_ids=[crops[node.id], crops[node.body_reference_id]],
                    role_kind=role if literal else "heading",
                    style=None,
                    heading_level=None if literal else 1,
                    parent_id=None,
                    chapter_start=None if literal else True,
                    chapter_role=None if literal else "frontmatter",
                )
            )
        output.append(
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
    return output


class NativeLiteral(unittest.TestCase):
    def prepare(self, path, role):
        source_pdf(path, role)
        pages = prepare_source(path, path.parent, hashlib.sha256(path.read_bytes()).hexdigest())
        _, segments, state = source_segments(path, path.parent, pages, [])
        tasks = prepare_refinement(path, path.parent, pages, segments, state)
        return pages, segments, state, tasks

    def test_poem_and_quotation_keep_lines_prose_unwraps_only_layout(self):
        for role in ("verse", "quote", "paragraph"):
            with self.subTest(role=role), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "source.pdf"
                pages, segments, state, tasks = self.prepare(path, role)
                self.assertFalse(any(p.tasks for p in pages))
                literals = [s for s in segments if s.structure_candidate and s.kind == "verse"]
                self.assertEqual(["\n".join(LINES)], [s.text for s in literals])
                original = literals[0]
                receipt = responses(tasks, role)
                refined = apply_refinement(segments, tasks, receipt, state)
                current = next(s for s in refined if s.id == original.id)
                self.assertEqual(role, current.kind)
                self.assertEqual(original.style, current.style)
                self.assertEqual(original.spans, current.spans)
                self.assertEqual(original.native_line_ids, current.native_line_ids)
                self.assertEqual(original.source_text, current.source_text)
                expected = (" " if role == "paragraph" else "\n").join(LINES)
                self.assertEqual(expected, current.text)
                self.assertEqual("\n".join(LINES), original.text)
                result = reconstruct(path, path.parent, pages, [], receipt)
                block = next(b for b in result.book.blocks if b.id == original.id)
                self.assertEqual(role, block.kind)
                self.assertEqual(expected, block.content.text)
                imported, _ = portable_epub(result.epub)
                self.assertEqual(result.book, imported)

    def test_literal_cannot_become_a_chapter_or_numbered_list(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, _, tasks = self.prepare(Path(directory) / "source.pdf", "verse")
            receipts = responses(tasks, "verse")
            for task, receipt in zip(tasks, receipts, strict=True):
                for index, decision in enumerate(receipt.decisions):
                    if decision.role_kind != "verse":
                        continue
                    for role in ("heading", "list_item"):
                        changed = list(receipt.decisions)
                        changed[index] = decision.model_copy(update={"role_kind": role})
                        with self.assertRaises(ValueError):
                            accept_refinement(
                                task, receipt.model_copy(update={"decisions": changed})
                            )

    def test_repeated_comparison_pair_is_not_poetry_and_is_not_deduplicated(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "comparison.pdf"
            repeated = "An original paired comparison"
            source_pdf(path, "comparison", [repeated, repeated])
            pages = prepare_source(path, path.parent, hashlib.sha256(path.read_bytes()).hexdigest())
            _, segments, _ = source_segments(path, path.parent, pages, [])
            self.assertFalse(any(s.structure_candidate and s.kind == "verse" for s in segments))
            self.assertEqual(2, sum(s.text.count(repeated) for s in segments))

    def test_wide_indented_quotation_is_reviewed_without_calling_it_poetry(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "quote.pdf"
            lines = [
                '"An invented quotation follows a broad printed measure '
                "across this indented block.",
                'Its second line is ordinary quoted prose rather than a poem or a song lyric."',
                "The invented author",
            ]
            source_pdf(path, "quote", lines)
            pages = prepare_source(path, path.parent, hashlib.sha256(path.read_bytes()).hexdigest())
            _, segments, state = source_segments(path, path.parent, pages, [])
            literal = next(s for s in segments if s.kind == "verse" and s.structure_candidate)
            self.assertEqual("\n".join(lines), literal.text)
            tasks = prepare_refinement(path, path.parent, pages, segments, state)
            refined = apply_refinement(segments, tasks, responses(tasks, "quote"), state)
            self.assertEqual("quote", next(s for s in refined if s.id == literal.id).kind)
