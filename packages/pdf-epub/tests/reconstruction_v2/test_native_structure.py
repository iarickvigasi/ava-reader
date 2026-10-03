"""Real same-font chapter/list PDF; source-authored roles are independent of classifier output."""

import hashlib
import io
import tempfile
import unittest
import zipfile
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.refinement_contract import (
    BookRefinementResponse,
    RefinementStyle,
)
from ava_pdf_epub.reconstruction_v2.refinement_response import accept_refinement
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

ROLES = {
    "Preface": (1, True, "frontmatter", None),
    "1. The quiet river": (1, True, "bodymatter", None),
    "2. The open bank": (1, True, "bodymatter", None),
    "1. Water levels": (2, False, None, "2. The open bank"),
    "2. Bank shapes": (2, False, None, "2. The open bank"),
    "3. The orchard": (1, True, "bodymatter", None),
    "4. The ridge": (1, True, "bodymatter", None),
}
BODY = [
    "The keeper walks beside the river and watches the morning light.",
    "An ordinary book records these words without changing the text.",
    "This original invented passage supplies clear English prose.",
]


def source_pdf(path):
    writer = PdfWriter()
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Times-Roman"),
        }
    )
    resource = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
    entries = [
        [
            ("Preface", 740),
            *zip(BODY, [710, 695, 680], strict=True),
            (" ", 625),
            ("1. The quiet river", 610),
            *zip(BODY, [580, 565, 550], strict=True),
            ("1. Pack the lamp.", 500),
            ("2. Check the wick.", 485),
        ],
        [
            ("2. The open bank", 740),
            *zip(BODY, [710, 695, 680], strict=True),
            (" ", 625),
            ("1. Water levels", 610),
            *zip(BODY, [580, 565, 550], strict=True),
            ("2. Bank shapes", 480),
            *zip(BODY, [450, 435, 420], strict=True),
        ],
    ]
    for lines in entries:
        page = writer.add_blank_page(width=600, height=800)
        page[NameObject("/Resources")] = resource
        stream = DecodedStreamObject()
        stream.set_data(
            "\n".join(f"BT /F1 11 Tf 48 {y} Td ({text}) Tj ET" for text, y in lines).encode()
        )
        page[NameObject("/Contents")] = writer._add_object(stream)
    page = writer.add_blank_page(width=600, height=800)
    page[NameObject("/Resources")] = resource
    commands = []
    for title, x in [("3. The orchard", 48), ("4. The ridge", 330)]:
        lines = [
            (title, 740),
            ("The keeper walks beside the lane.", 710),
            ("The morning light reaches the gate.", 695),
            ("This book keeps every original word.", 680),
        ]
        commands.extend(f"BT /F1 11 Tf {x} {y} Td ({text}) Tj ET" for text, y in lines)
    stream = DecodedStreamObject()
    stream.set_data("\n".join(commands).encode())
    page[NameObject("/Contents")] = writer._add_object(stream)
    writer.write(path)


def decisions(tasks):
    responses = []
    for task in tasks:
        ids = {node.text_excerpt: node.id for node in task.nodes}
        crops = {crop.node_id: crop.id for crop in task.crops if crop.part == "head"}
        output = []
        for node in task.nodes:
            if node.id not in task.decision_ids:
                continue
            level, chapter, role, parent = ROLES[node.text_excerpt]
            output.append(
                dict(
                    node_id=node.id,
                    text_sha256=node.text_sha256,
                    evidence_ids=[crops[node.id], crops[node.body_reference_id]],
                    role_kind="heading",
                    heading_level=level,
                    chapter_start=chapter,
                    chapter_role=role,
                    parent_id=ids[parent] if parent else None,
                    style=None,
                )
            )
        responses.append(
            BookRefinementResponse.model_validate(
                dict(
                    schema_version="ava-book-refinement-response-3",
                    task_id=task.task_id,
                    source_sha256=task.source_sha256,
                    observation_sha256=task.observation_sha256,
                    image_sha256=task.image.sha256,
                    decisions=output,
                    joins=[],
                    unresolved=[],
                )
            )
        )
    return responses


class NativeStructure(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.scratch = Path(self.temp.name)
        self.source = self.scratch / "authored.pdf"
        source_pdf(self.source)
        digest = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.pages = prepare_source(self.source, self.scratch, digest)
        _, self.original, self.state = source_segments(self.source, self.scratch, self.pages, [])
        self.tasks = prepare_refinement(
            self.source, self.scratch, self.pages, self.original, self.state
        )
        self.responses = decisions(self.tasks)

    def test_same_font_chapters_and_sections_are_reviewed_but_compact_lists_are_not(self):
        self.assertEqual([], [task for page in self.pages for task in page.tasks])
        self.assertEqual(set(ROLES), {s.text for s in self.original if s.structure_candidate})
        self.assertTrue(all(s.kind != "heading" for s in self.original if s.structure_candidate))
        self.assertFalse(any(not s.text.strip() for s in self.original))
        self.assertTrue(self.state.structure_findings)
        self.assertTrue(all(task.prompt_version == "ava-book-refinement-5" for task in self.tasks))

    def test_confirmed_roles_preserve_native_text_style_and_original_observations(self):
        before = [s.model_dump() for s in self.original]
        refined = apply_refinement(self.original, self.tasks, self.responses, self.state)
        self.assertEqual(before, [s.model_dump() for s in self.original])
        self.assertEqual(
            [(s.id, s.text, s.source_text, s.style, s.spans) for s in self.original],
            [(s.id, s.text, s.source_text, s.style, s.spans) for s in refined],
        )
        self.assertFalse(any(s.structure_candidate for s in refined))
        self.assertEqual([], self.state.structure_findings)
        self.assertEqual(2, len([s for s in refined if s.kind == "list_item"]))
        result = reconstruct(self.source, self.scratch, self.pages, [], self.responses)
        self.assertEqual(
            ["Preface", "1. The quiet river", "2. The open bank", "3. The orchard", "4. The ridge"],
            [chapter.title for chapter in result.book.chapters],
        )
        self.assertEqual(7, len(result.book.toc))
        with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
            self.assertEqual(
                5, len([name for name in archive.namelist() if name.startswith("EPUB/text/")])
            )

    def test_role_decisions_cannot_mutate_native_typography_or_omit_roles(self):
        task, response = self.tasks[0], self.responses[0]
        decision = response.decisions[0]
        bad_style = RefinementStyle(id="observed", relative_size=1, bold=True)
        for change in ({"role_kind": None}, {"style": bad_style}):
            invalid = response.model_copy(
                update={"decisions": [decision.model_copy(update=change), *response.decisions[1:]]}
            )
            with self.assertRaises(ValueError):
                accept_refinement(task, invalid)

    def test_native_styles_are_null_in_the_wire_grammar_not_only_late_acceptance(self):
        value = self.responses[0].model_dump(mode="json")
        value["decisions"][0]["style"] = dict(id="observed", relative_size=1, bold=False)
        with self.assertRaises(ValueError):
            BookRefinementResponse.model_validate(value)

    def test_non_heading_candidate_cannot_be_an_ancestor(self):
        changed = []
        for response in self.responses:
            output = []
            for d in response.decisions:
                if d.node_id == next(
                    n.id for n in self.tasks[0].nodes if n.text_excerpt == "2. The open bank"
                ):
                    d = d.model_copy(
                        update={
                            "role_kind": "paragraph",
                            "heading_level": None,
                            "chapter_start": None,
                            "chapter_role": None,
                            "parent_id": None,
                        }
                    )
                output.append(d)
            changed.append(response.model_copy(update={"decisions": output}))
        with self.assertRaisesRegex(ValueError, "preceding source ancestor"):
            apply_refinement(self.original, self.tasks, changed, self.state)
