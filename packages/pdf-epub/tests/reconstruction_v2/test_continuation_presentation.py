"""Mixed-source joins retain known values, authority and paragraph edge spacing."""

import base64
import hashlib
import io
import unittest

from PIL import Image

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.continuation_presentation import uniform_candidate
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import (
    PresentationRefinementResponse,
    PresentationRefinementTask,
)
from ava_pdf_epub.reconstruction_v2.continuation_presentation_response import (
    presentation_projection,
)
from ava_pdf_epub.reconstruction_v2.legacy_refinement_contract import (
    BookRefinementTask,
    RefinementCrop,
    RefinementEdge,
    RefinementNode,
)
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionImage
from ava_pdf_epub.reconstruction_v2.refinement_identity import refinement_identifier


def pair(native_first=True, unknown_leading=False):
    native = Style(
        id="measured",
        family="serif",
        align="start",
        bold=False,
        italic=False,
        small_caps=False,
        vertical_align="baseline",
        relative_size=1,
        line_height=None if unknown_leading else 1.2094999999999974,
        indent_em=1.1,
        space_before_em=0.4,
        space_after_em=5.329070518200751e-15,
        color="#231f20",
    )
    ocr = Style(
        id="observed",
        family="serif",
        align="justify",
        indent_em=0,
        underline=False,
        block_indent_em=0,
        space_after_em=0.7,
    )

    def node(ident, page, style):
        return RefinementNode(
            id=ident,
            page=page,
            kind="paragraph",
            text_sha256=hashlib.sha256(ident.encode()).hexdigest(),
            text_excerpt=ident,
            observed_level=None,
            observed_chapter=False,
            observed_role=None,
            observed_style=style,
            ranked_source=True,
            body_reference_id=None,
        )

    return (
        node("left", 1, native if native_first else ocr),
        node("right", 2, ocr if native_first else native),
        "left" if native_first else "right",
        RefinementEdge(id="edge", previous_id="left", next_id="right"),
    )


def fixture(native_first=True, unknown_leading=False):
    left, right, native, edge = pair(native_first, unknown_leading)
    data = io.BytesIO()
    Image.new("RGB", (64, 64), "white").save(data, format="PNG")
    pixels = data.getvalue()
    image = RecognitionImage(
        media_type="image/png",
        sha256=hashlib.sha256(pixels).hexdigest(),
        width=64,
        height=64,
        byte_length=len(pixels),
        base64=base64.b64encode(pixels).decode(),
    )
    crops = [
        RefinementCrop(
            id="crop-" + n.id,
            part="head",
            node_id=n.id,
            page=n.page,
            source_box=Box(coordinate_space="page_points_top_left", x0=0, y0=0, x1=10, y1=10),
            render_sha256=image.sha256,
            image_box=[0, i * 20, 20, i * 20 + 20],
        )
        for i, n in enumerate([left, right])
    ]
    ocr = "right" if native_first else "left"
    base = BookRefinementTask.model_construct(
        schema_version="ava-book-refinement-task-3",
        task_id="temporary",
        source_sha256="a" * 64,
        observation_sha256="b" * 64,
        profile_id="ava-pdf-prose-en-v2",
        prompt_version="ava-book-refinement-6",
        response_schema_version="ava-book-refinement-response-3",
        nodes=[left, right],
        pixels_per_point=2,
        decision_ids=[ocr],
        edges=[edge],
        crops=crops,
        image=image,
    )
    candidate = uniform_candidate(edge, left, right, native, native_alignment_fallback=True)
    raw = base.model_dump(mode="json")
    raw.update(
        schema_version="ava-book-refinement-task-5",
        prompt_version="ava-book-refinement-8",
        response_schema_version="ava-book-refinement-response-5",
        native_endpoints=[native],
        native_alignment_fallbacks=[native],
        join_candidates=[candidate.model_dump(mode="json")],
    )
    raw["task_id"] = refinement_identifier(raw)
    task = PresentationRefinementTask.model_validate(raw)
    node = next(n for n in task.nodes if n.id == ocr)
    response = PresentationRefinementResponse.model_validate(
        dict(
            schema_version="ava-book-refinement-response-5",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            observation_sha256=task.observation_sha256,
            image_sha256=image.sha256,
            decisions=[
                dict(
                    node_id=ocr,
                    text_sha256=node.text_sha256,
                    evidence_ids=["crop-" + ocr],
                    heading_level=None,
                    parent_id=None,
                    chapter_start=None,
                    chapter_role=None,
                    role_kind=None,
                    style=None,
                )
            ],
            joins=[dict(edge_id="edge", join=True, evidence_ids=["crop-left", "crop-right"])],
            unresolved=[],
            presentations=[
                dict(
                    edge_id="edge",
                    candidate_id=candidate.id,
                    evidence_ids=["crop-left", "crop-right"],
                )
            ],
        )
    )
    return task, response


class ContinuationPresentationTest(unittest.TestCase):
    def test_both_directions_preserve_values_and_head_tail_layout(self):
        for direction in (True, False):
            task, response = fixture(direction)
            before = document_digest(task)
            projection = presentation_projection(task, response)
            a, b = projection.styles.values()
            self.assertEqual("justify", a.align)
            self.assertEqual(a.align, b.align)
            self.assertFalse(a.underline)
            self.assertFalse(b.underline)
            self.assertFalse(a.bold)
            self.assertEqual(0, a.block_indent_em)
            self.assertEqual(1.2094999999999974, a.line_height)
            self.assertEqual("#231f20", a.color)
            self.assertEqual(task.nodes[0].observed_style.indent_em, a.indent_em)
            self.assertEqual(task.nodes[0].observed_style.space_before_em, a.space_before_em)
            self.assertEqual(task.nodes[1].observed_style.space_after_em, a.space_after_em)
            self.assertEqual(a.space_after_em, b.space_after_em)
            self.assertEqual(before, document_digest(task))
            self.assertNotEqual(task.task_id, projection.task.task_id)
            self.assertEqual(task.task_id, projection.proof["task_id"])

    def test_unknown_source_leading_keeps_finite_candidate_without_measurement(self):
        for direction in (True, False):
            left, right, native, edge = pair(direction, unknown_leading=True)
            before = [document_digest(value) for value in (left, right)]
            candidate = uniform_candidate(
                edge, left, right, native, native_alignment_fallback=True
            )
            self.assertIsNotNone(candidate)
            self.assertIsNone(candidate.previous_style.line_height)
            self.assertIsNone(candidate.next_style.line_height)
            self.assertEqual(before, [document_digest(value) for value in (left, right)])
            self.assertEqual("#231f20", candidate.previous_style.color)
            self.assertFalse(candidate.next_style.italic)
            for field in ("family", "bold", "relative_size"):
                changed = [
                    node.model_copy(
                        update={
                            "observed_style": node.observed_style.model_copy(
                                update={field: None}
                            )
                        }
                    )
                    for node in (left, right)
                ]
                self.assertIsNone(
                    uniform_candidate(
                        edge, *changed, native, native_alignment_fallback=True
                    ),
                    field,
                )

    def test_unknown_leading_projection_stays_unknown_and_rejects_numeric_guess(self):
        for direction in (True, False):
            task, response = fixture(direction, unknown_leading=True)
            before = document_digest(task)
            projection = presentation_projection(task, response)
            self.assertTrue(all(style.line_height is None for style in projection.styles.values()))
            self.assertEqual(before, document_digest(task))
            old_task, old_response = fixture(direction)
            self.assertNotEqual(old_task.task_id, task.task_id)
            with self.assertRaisesRegex(ValueError, "stale"):
                presentation_projection(task, old_response)
            raw = response.model_dump(mode="json")
            raw["decisions"][0]["style"] = {
                "id": "observed",
                "bold": False,
                "relative_size": 1,
                "line_height": 1.21,
            }
            with self.assertRaisesRegex(ValueError, "unmeasured"):
                presentation_projection(
                    task, PresentationRefinementResponse.model_validate(raw)
                )

    def test_explicit_origin_and_known_conflicts(self):
        left, right, native, edge = pair()
        self.assertIsNone(uniform_candidate(edge, left, right, native))
        for field, value in [
            ("bold", True),
            ("family", "sans-serif"),
            ("color", "#ff0000"),
            ("line_height", 1.5),
        ]:
            changed = right.model_copy(
                update={"observed_style": right.observed_style.model_copy(update={field: value})}
            )
            self.assertIsNone(
                uniform_candidate(edge, left, changed, native, native_alignment_fallback=True),
                field,
            )
        centered = left.model_copy(
            update={"observed_style": left.observed_style.model_copy(update={"align": "center"})}
        )
        with self.assertRaisesRegex(ValueError, "provenance"):
            uniform_candidate(edge, centered, right, native, native_alignment_fallback=True)

    def test_foreign_stale_unwitnessed_and_missing_scope_refuse(self):
        task, response = fixture()
        for patch in [
            dict(candidate_id="foreign"),
            dict(evidence_ids=["crop-right"]),
            dict(evidence_ids=["crop-left", "crop-left", "crop-right"]),
            dict(edge_id="foreign"),
        ]:
            with self.assertRaises(ValueError):
                presentation_projection(
                    task,
                    response.model_copy(
                        update={
                            "presentations": [response.presentations[0].model_copy(update=patch)]
                        }
                    ),
                )
        for patch in [
            dict(task_id="foreign"),
            dict(source_sha256="d" * 64),
            dict(image_sha256="d" * 64),
            dict(presentations=[]),
            dict(joins=[]),
            dict(decisions=[]),
            dict(joins=[response.joins[0].model_copy(update={"join": False})]),
        ]:
            with self.assertRaises(ValueError):
                presentation_projection(task, response.model_copy(update=patch))

    def test_null_choice_does_not_authorize_missing_ocr_style(self):
        task, response = fixture()
        choice = response.presentations[0].model_copy(
            update={"candidate_id": None, "evidence_ids": []}
        )
        with self.assertRaises(ValueError):
            presentation_projection(task, response.model_copy(update={"presentations": [choice]}))

    def test_candidate_identity_and_native_membership_are_not_advisory(self):
        task, _ = fixture()
        for patch in [
            dict(native_endpoints=["right"]),
            dict(native_alignment_fallbacks=[]),
            dict(native_alignment_fallbacks=["foreign"]),
            dict(native_endpoints=["left", "left"]),
        ]:
            raw = task.model_dump(mode="json")
            raw.update(patch)
            raw["task_id"] = refinement_identifier(raw)
            with self.assertRaises(ValueError):
                PresentationRefinementTask.model_validate(raw)
        raw = task.model_dump(mode="json")
        raw["join_candidates"][0]["previous_style_sha256"] = "c" * 64
        raw["task_id"] = refinement_identifier(raw)
        with self.assertRaises(ValueError):
            PresentationRefinementTask.model_validate(raw)


class AlignmentOriginTest(unittest.TestCase):
    def test_source_hook_retains_original_serialized_output(self):
        import tempfile
        from pathlib import Path

        from pypdf import PdfWriter
        from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

        from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
        from ava_pdf_epub.reconstruction_v2.furniture import furniture_ids
        from ava_pdf_epub.reconstruction_v2.native_page import native_page
        from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.pdf"
            writer = PdfWriter()
            page = writer.add_blank_page(width=346, height=582)
            page[NameObject("/Resources")] = DictionaryObject(
                {
                    NameObject("/Font"): DictionaryObject(
                        {
                            NameObject("/F1"): DictionaryObject(
                                {
                                    NameObject("/Type"): NameObject("/Font"),
                                    NameObject("/Subtype"): NameObject("/Type1"),
                                    NameObject("/BaseFont"): NameObject("/Times-Roman"),
                                }
                            )
                        }
                    )
                }
            )
            stream = DecodedStreamObject()
            stream.set_data(
                b"BT /F1 10.5 Tf 36 470 Td "
                b"(The first source line begins this paragraph and) Tj 0 -14 Td "
                b"(the next source line continues the same paragraph.) Tj 0 -14 Td "
                b"(Every printed word remains in its original order.) Tj ET"
            )
            page[NameObject("/Contents")] = writer._add_object(stream)
            writer.write(source)
            pages = prepare_source(
                source,
                root / "scratch",
                hashlib.sha256(source.read_bytes()).hexdigest(),
                BILINGUAL_PROFILE,
            )
            page = pages[0]
            furniture = furniture_ids((p.observation for p in pages), BILINGUAL_PROFILE)
            origins = {}
            before = native_page(
                page.observation,
                page.tables,
                furniture,
                [],
                BILINGUAL_PROFILE,
                source_layout_policy="ava-native-layout-1",
                source_line_maps=[],
            )
            after = native_page(
                page.observation,
                page.tables,
                furniture,
                [],
                BILINGUAL_PROFILE,
                alignment_origins=origins,
                source_layout_policy="ava-native-layout-1",
                source_line_maps=[],
            )
            self.assertEqual(
                [value.model_dump(mode="json") for value in before],
                [value.model_dump(mode="json") for value in after],
            )
            self.assertIn("fallback_start", origins.values())
            for value in after:
                if origins.get(value.id) == "fallback_start":
                    self.assertEqual("start", value.style.align)


class PresentationReviewControls(unittest.TestCase):
    def test_positive_base_decorations_are_not_unchecked_ancestor_styles(self):
        left, right, native, edge = pair()
        for field in ("underline", "strike_through"):
            changed = left.model_copy(
                update={"observed_style": left.observed_style.model_copy(update={field: True})}
            )
            self.assertIsNone(
                uniform_candidate(edge, changed, right, native, native_alignment_fallback=True)
            )
        task, response = fixture()
        patch = response.decisions[0].model_copy(
            update={
                "style": {
                    "id": "observed",
                    "relative_size": 1,
                    "bold": False,
                    "strike_through": True,
                }
            }
        )
        # Validate the typed authored packet before invoking semantic compilation.
        raw = response.model_dump(mode="json")
        raw["decisions"][0] = patch.model_dump(mode="json")
        with self.assertRaisesRegex(ValueError, "decoration"):
            presentation_projection(task, PresentationRefinementResponse.model_validate(raw))

    def test_new_heading_authority_remains_explicitly_versioned(self):
        task, response = fixture()
        heading = task.nodes[0].model_copy(
            update={
                "id": "heading",
                "kind": "heading",
                "structure_candidate": True,
                "candidate_original_kind": "heading",
                "ranked_source": False,
                "observed_level": 1,
            }
        )
        crop = task.crops[0].model_copy(update={"id": "crop-heading", "node_id": "heading"})
        raw = task.model_dump(mode="json")
        raw["nodes"].append(heading.model_dump(mode="json"))
        raw["crops"].append(crop.model_dump(mode="json"))
        raw["decision_ids"].append("heading")
        raw["task_id"] = refinement_identifier(raw)
        current = PresentationRefinementTask.model_validate(raw)
        raw = response.model_dump(mode="json")
        raw["task_id"] = current.task_id
        raw["decisions"].append(
            dict(
                node_id="heading",
                text_sha256=heading.text_sha256,
                evidence_ids=["crop-heading"],
                heading_level=1,
                parent_id=None,
                chapter_start=False,
                chapter_role=None,
                role_kind="heading",
                style=None,
            )
        )
        projection = presentation_projection(
            current, PresentationRefinementResponse.model_validate(raw)
        )
        self.assertEqual("ava-book-refinement-6", projection.task.prompt_version)
        self.assertEqual(3, len(projection.task.nodes))
