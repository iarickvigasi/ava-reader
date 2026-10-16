"""Measure accepted Native2 groups before refinement; preserve source roles and receipts."""

import unittest

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.reconstruction_v2.native_spacing import native_spacing
from ava_pdf_epub.reconstruction_v2.native_structure_assembly import (
    assemble_native_structure_source,
)
from ava_pdf_epub.reconstruction_v2.native_structure_source import prepare_native_structure

from .native_structure_decision_fixture import SOURCE, line, page, region
from .native_structure_v2_fixture import response2


def source_case(centered=False, equal_width=False, italic=False, first_indent=0):
    texts = ["A full first source line", "A shorter second", "A last source line"]
    if equal_width:
        texts = [texts[0]] * 3
    rows = [
        line(
            "line" + str(i),
            text,
            x=(300 - len(text) * 2.5 if centered else 40) + (first_indent if i == 0 else 0),
            y=40 + i * 15,
            faces=[(text, "Times-Italic")] if italic else None,
        )
        for i, text in enumerate(texts)
    ]
    observed, image = page(rows)
    task = prepare_native_structure(
        observed,
        SOURCE,
        image,
        [region("body", rows)],
        structure_policy="ava-native-structure-2",
    )
    answer = response2(
        task,
        [
            dict(
                id="body",
                region_id="body",
                line_ids=[r.id for r in rows],
                kind="paragraph",
                continues_from_previous=True,
                continues_to_next=False,
            )
        ],
    )
    return observed, task, answer


class NativeGroupLayoutTests(unittest.TestCase):
    def test_measured_layout_precedes_identity_without_mutating_source_or_model_roles(self):
        observed, task, answer = source_case()
        hashes = document_digest(task), document_digest(answer)
        old = assemble_native_structure_source(task, answer, observed)
        current = assemble_native_structure_source(task, answer, observed, paragraph_layout=True)
        self.assertIsNone(old.segments[0].style.align)
        self.assertIsNone(old.segments[0].style.line_height)
        self.assertEqual("start", current.segments[0].style.align)
        self.assertEqual(1.5, current.segments[0].style.line_height)
        self.assertEqual(0, current.segments[0].style.indent_em)
        self.assertEqual(old.segments[0].text, current.segments[0].text)
        self.assertEqual(old.segments[0].source_text, current.segments[0].source_text)
        self.assertEqual(old.segments[0].spans, current.segments[0].spans)
        self.assertEqual("paragraph", current.segments[0].kind)
        self.assertEqual(old.line_maps, current.line_maps)
        self.assertEqual(hashes, (document_digest(task), document_digest(answer)))
        proof = current.continuations[0]
        self.assertTrue(proof.incoming and proof.first_line_flush)
        self.assertEqual("fallback_start", proof.alignment_origin)
        self.assertTrue(proof.owns(current.segments[0]))
        self.assertNotEqual(document_digest(old.segments[0]), document_digest(current.segments[0]))

    def test_justified_equal_width_rows_cannot_claim_centering(self):
        observed, task, answer = source_case(centered=True, equal_width=True)
        current = assemble_native_structure_source(task, answer, observed, paragraph_layout=True)
        self.assertEqual("start", current.segments[0].style.align)
        self.assertEqual("fallback_start", current.continuations[0].alignment_origin)
        # The historical path retains its previous derivation when not opted in.
        old = assemble_native_structure_source(task, answer, observed)
        self.assertEqual("center", native_spacing(observed, list(old.segments))[0].style.align)

    def test_shorter_centered_rows_supply_distinct_source_evidence(self):
        observed, task, answer = source_case(centered=True)
        current = assemble_native_structure_source(task, answer, observed, paragraph_layout=True)
        self.assertEqual("center", current.segments[0].style.align)
        self.assertEqual("centered_source", current.continuations[0].alignment_origin)
        self.assertFalse(current.continuations[0].first_line_flush)

    def test_measuring_spacing_preserves_known_zero_and_explicit_values(self):
        observed, task, answer = source_case()
        raw = assemble_native_structure_source(task, answer, observed).segments[0]
        styled = raw.model_copy(
            update={
                "style": raw.style.model_copy(
                    update={
                        "align": "left",
                        "indent_em": 0,
                        "line_height": 1.7,
                        "space_after_em": 0,
                    }
                )
            }
        )
        measured = native_spacing(observed, [styled], strict_center_evidence=True)[0]
        self.assertEqual(1.7, measured.style.line_height)
        self.assertEqual(0, measured.style.indent_em)
        self.assertEqual(0, measured.style.space_after_em)
        self.assertEqual("left", measured.style.align)

    def test_source_role_is_not_reclassified_by_geometric_quote_cue(self):
        observed, task, answer = source_case(italic=True, first_indent=20)
        old = assemble_native_structure_source(task, answer, observed)
        measured = native_spacing(observed, list(old.segments), strict_center_evidence=True)
        self.assertEqual("quote", measured[0].kind)
        current = assemble_native_structure_source(task, answer, observed, paragraph_layout=True)
        self.assertEqual("paragraph", current.segments[0].kind)
        self.assertTrue(current.segments[0].style.italic)
        self.assertEqual(2, current.segments[0].style.indent_em)
        self.assertFalse(current.continuations[0].first_line_flush)
