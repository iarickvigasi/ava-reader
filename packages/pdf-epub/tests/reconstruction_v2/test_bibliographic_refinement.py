"""Authored source credits and adversarial receipts test bibliographic authority."""

import copy
import hashlib
import unittest
from types import SimpleNamespace

from ava_pdf_epub.reconstruction_v2.bibliographic_refinement import (
    accept_bibliographic_decisions,
    bibliographic_candidates,
    metadata_crop_groups,
)
from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementResponse

from .metadata_helpers import body, metadata_state, paragraph, title


class BibliographicRefinementTests(unittest.TestCase):
    def setUp(self):
        self.text = "Робін Норвуд"
        self.node = SimpleNamespace(
            id="observed-1",
            text_excerpt=self.text,
            text_sha256=hashlib.sha256(self.text.encode()).hexdigest(),
        )
        self.task = SimpleNamespace(
            metadata_ids=[self.node.id],
            nodes=[self.node],
            crops=[SimpleNamespace(id="credit-crop", node_id=self.node.id, part="head")],
        )
        self.raw = dict(
            schema_version="ava-book-refinement-response-3",
            task_id="task",
            source_sha256="a" * 64,
            observation_sha256="b" * 64,
            image_sha256="c" * 64,
            decisions=[],
            joins=[],
            unresolved=[],
            metadata_decisions=[
                dict(
                    node_id=self.node.id,
                    text_sha256=self.node.text_sha256,
                    evidence_ids=["credit-crop"],
                    role="author",
                    start=0,
                    end=len(self.text),
                )
            ],
        )

    def test_exact_source_author_is_accepted_without_replacement_text(self):
        response = BookRefinementResponse.model_validate(self.raw)
        accept_bibliographic_decisions(self.task, response)
        state = metadata_state([title(), paragraph(self.text), body()])
        state.bibliographic_roles[self.node.id] = ("author", self.text)
        authors = [c for c in printed_metadata(state, None) if c["field"] == "contributor"]
        self.assertEqual([self.text], [c["value"] for c in authors])
        self.assertEqual("author", authors[0]["contributor_role"])
        self.assertEqual(state.blocks[1]["evidence"], authors[0]["evidence"])

    def test_names_in_body_text_are_not_title_page_candidates_or_accepted_authors(self):
        state = metadata_state([title(), paragraph(self.text), body(), paragraph(self.text)])
        self.assertEqual(["observed-1"], bibliographic_candidates(list(state.segments.values())))
        state.bibliographic_roles["observed-3"] = ("author", self.text)
        self.assertFalse(any(c["field"] == "contributor" for c in printed_metadata(state, None)))

    def test_author_and_explicit_unknown_cannot_be_auto_inferred_as_subtitles(self):
        for role in ["author", None]:
            with self.subTest(role=role):
                state = metadata_state(
                    [
                        title(),
                        paragraph(self.text, style=dict(id="center", align="center")),
                        body(),
                    ]
                )
                state.bibliographic_roles[self.node.id] = (role, self.text if role else "")
                claims = printed_metadata(state, None)
                self.assertFalse(any(c["field"] == "subtitle" for c in claims))
                self.assertEqual(role == "author", any(c["field"] == "contributor" for c in claims))

    def test_labeled_fields_already_resolved_locally_do_not_require_model_tokens(self):
        state = metadata_state(
            [
                title(),
                paragraph("Author: AVA Fixture Studio"),
                paragraph("Publication date: 2026-09-28 / Language: en"),
                paragraph("Rights: Original authored fixture"),
                body(),
            ]
        )
        self.assertEqual([], bibliographic_candidates(list(state.segments.values())))
        self.assertTrue(any(c["field"] == "contributor" for c in printed_metadata(state, None)))

    def test_repeated_printed_credit_spacing_preserves_one_author_and_all_source_evidence(self):
        import tempfile
        from pathlib import Path

        from pypdf import PdfWriter

        from ava_pdf_epub.reconstruction_v2.assemble_metadata import assemble_metadata

        state = metadata_state(
            [
                title(),
                paragraph("Робін Норвуд"),
                paragraph("Робін  Норвуд", page=2),
                body() | {"page": 3},
            ]
        )
        state.bibliographic_roles["observed-1"] = ("author", "Робін Норвуд")
        state.bibliographic_roles["observed-2"] = ("author", "Робін  Норвуд")
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "metadata.pdf"
            writer = PdfWriter()
            writer.add_blank_page(width=600, height=800)
            writer.write(source)
            authors = [
                claim
                for claim in assemble_metadata(source, state, "authored")
                if claim["field"] == "contributor" and claim["status"] == "accepted"
            ]
        self.assertEqual(1, len(authors))
        self.assertEqual("Робін Норвуд", authors[0]["value"])
        self.assertEqual([1, 2], [e["page"] for e in authors[0]["evidence"]])
        self.assertEqual("Робін  Норвуд", state.blocks[2]["content"]["text"])

    def test_ocr_cover_can_prepare_credit_comparison_before_final_title_typography(self):
        state = metadata_state(
            [
                title()
                | dict(
                    method="ocr",
                    chapter_start=True,
                    chapter_role="frontmatter",
                    style=dict(id="cover", align="left"),
                ),
                paragraph(self.text, method="ocr"),
                body(),
            ]
        )
        self.assertEqual(["observed-1"], bibliographic_candidates(list(state.segments.values())))
        state.bibliographic_roles["observed-1"] = ("author", self.text)
        # A provider role does not establish final title-page authority on its own.
        self.assertFalse(any(c["field"] == "contributor" for c in printed_metadata(state, None)))
        first = state.segments["observed-0"]
        state.segments[first.id] = first.model_copy(
            update={"style": first.style.model_copy(update={"relative_size": 2})}
        )
        self.assertEqual(
            [self.text],
            [c["value"] for c in printed_metadata(state, None) if c["field"] == "contributor"],
        )

    def test_scanned_cover_candidates_do_not_require_chapters_already_refined(self):
        state = metadata_state(
            [
                title()
                | dict(
                    method="ocr",
                    chapter_start=True,
                    chapter_role="frontmatter",
                    style=dict(id="cover", align="left"),
                ),
                paragraph(self.text, method="ocr"),
                body() | dict(chapter_start=False, chapter_role=None, structure_candidate=True),
            ]
        )
        self.assertIn("observed-1", bibliographic_candidates(list(state.segments.values())))
        state.bibliographic_roles["observed-1"] = ("author", self.text)
        self.assertFalse(any(c["field"] == "contributor" for c in printed_metadata(state, None)))

    def test_preface_body_is_not_sent_as_title_page_metadata_and_readable_groups_coalesce(self):
        state = metadata_state(
            [
                title(),
                paragraph(self.text),
                paragraph("Передмова", structure_candidate=True),
                paragraph("Another name mentioned in ordinary preface prose"),
                body(),
            ]
        )
        self.assertEqual(["observed-1"], bibliographic_candidates(list(state.segments.values())))
        ids = [f"credit-{i}" for i in range(14)]
        self.assertEqual([ids], metadata_crop_groups(ids, lambda group: len(group) <= 24))

    def test_unknown_is_a_complete_decision_without_invented_metadata(self):
        self.raw["metadata_decisions"][0].update(role=None, start=None, end=None)
        accept_bibliographic_decisions(self.task, BookRefinementResponse.model_validate(self.raw))

    def test_invented_text_wrong_crop_identity_coverage_or_ranges_fail(self):
        mutations = [
            lambda r: r["metadata_decisions"].clear(),
            lambda r: r["metadata_decisions"].append(copy.deepcopy(r["metadata_decisions"][0])),
            lambda r: r["metadata_decisions"][0].update(text="Invented author"),
            lambda r: r["metadata_decisions"][0].update(node_id="body-prose"),
            lambda r: r["metadata_decisions"][0].update(text_sha256="d" * 64),
            lambda r: r["metadata_decisions"][0].update(evidence_ids=["invented-crop"]),
            lambda r: r["metadata_decisions"][0].update(start=2, end=1),
            lambda r: r["metadata_decisions"][0].update(end=len(self.text) + 1),
            lambda r: r["metadata_decisions"][0].update(role=None),
        ]
        for mutate in mutations:
            with self.subTest(index=mutations.index(mutate)), self.assertRaises(ValueError):
                raw = copy.deepcopy(self.raw)
                mutate(raw)
                accept_bibliographic_decisions(
                    self.task, BookRefinementResponse.model_validate(raw)
                )

    def test_metadata_catalogue_does_not_change_existing_structure_comparisons(self):
        from ava_pdf_epub.reconstruction_v2.refinement_catalogue import refinement_catalogue

        state = metadata_state([title(), paragraph(self.text), body()])
        segments = list(state.segments.values())
        state.placements = {segment.id: (segment.page, 0, 0) for segment in segments}
        old = refinement_catalogue(segments, state)
        new = refinement_catalogue(segments, state, include_bibliography=True)
        self.assertEqual(old.nodes, new.nodes)
        self.assertEqual(old.decisions, new.decisions)
        self.assertEqual(old.edges, new.edges)
        self.assertEqual(["observed-1"], new.metadata_ids)
        self.assertEqual(
            {"observed-0", "observed-1", "observed-2"}, {n.id for n in new.metadata_nodes}
        )
        self.assertTrue(all(n.body_reference_id is None for n in new.metadata_nodes))

    def test_prominent_author_credit_can_be_a_heading_without_becoming_a_book_title(self):
        from .metadata_helpers import heading

        state = metadata_state([title(), heading(self.text, level=2), body()])
        self.assertEqual(["observed-1"], bibliographic_candidates(list(state.segments.values())))
        state.bibliographic_roles["observed-1"] = ("author", self.text)
        claims = printed_metadata(state, None)
        self.assertEqual(
            ["The Journey Book"], [c["value"] for c in claims if c["field"] == "title"]
        )
        self.assertEqual([self.text], [c["value"] for c in claims if c["field"] == "contributor"])

    def test_native_pdf_builds_source_bound_credit_task_without_changing_structure_tasks(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import patch

        from pypdf import PdfWriter
        from pypdf.generic import DecodedStreamObject, NameObject

        from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
        from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
        from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
        from ava_pdf_epub.reconstruction_v2.refinement_response import accept_refinement
        from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

        fixture = Path(__file__).parent / "fixtures" / "qualification.pdf"
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source = scratch / "unlabeled-credit.pdf"
            writer = PdfWriter(clone_from=fixture)
            original = writer.pages[0].get_contents().get_data()
            self.assertEqual(1, original.count(b"Author: AVA Fixture Studio"))
            stream = DecodedStreamObject()
            stream.set_data(original.replace(b"Author: AVA Fixture Studio", b"AVA Fixture Studio"))
            writer.pages[0][NameObject("/Contents")] = writer._add_object(stream)
            writer.write(source)
            pages = [prepare_page(source, scratch, n, BILINGUAL_PROFILE) for n in (1, 2)]
            self.assertTrue(all(not page.tasks for page in pages))
            _, segments, state = source_segments(source, scratch, pages, [])
            with patch(
                "ava_pdf_epub.reconstruction_v2.bibliographic_refinement.bibliographic_candidates",
                return_value=[],
            ):
                prior = prepare_refinement(source, scratch, pages, segments, state)
            tasks = prepare_refinement(source, scratch, pages, segments, state)
            self.assertEqual(
                [task.model_dump(mode="json") for task in prior],
                [task.model_dump(mode="json") for task in tasks if not task.metadata_ids],
            )
            credit_task = next(task for task in tasks if task.metadata_ids)
            self.assertEqual(
                hashlib.sha256(source.read_bytes()).hexdigest(), credit_task.source_sha256
            )
            self.assertEqual("ava-book-refinement-4", credit_task.prompt_version)
            self.assertEqual([], credit_task.decision_ids)
            nodes = {node.id: node for node in credit_task.nodes}
            decisions = []
            for ident in credit_task.metadata_ids:
                node = nodes[ident]
                author = node.text_excerpt == "AVA Fixture Studio"
                decisions.append(
                    dict(
                        node_id=ident,
                        text_sha256=node.text_sha256,
                        evidence_ids=[
                            crop.id for crop in credit_task.crops if crop.node_id == ident
                        ],
                        role="author" if author else None,
                        start=0 if author else None,
                        end=len(node.text_excerpt) if author else None,
                    )
                )
            self.assertEqual(1, sum(decision["role"] == "author" for decision in decisions))
            response = BookRefinementResponse.model_validate(
                dict(
                    schema_version="ava-book-refinement-response-3",
                    task_id=credit_task.task_id,
                    source_sha256=credit_task.source_sha256,
                    observation_sha256=credit_task.observation_sha256,
                    image_sha256=credit_task.image.sha256,
                    decisions=[],
                    joins=[],
                    unresolved=[],
                    metadata_decisions=decisions,
                )
            )
            accept_refinement(credit_task, response)
            from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
            from ava_pdf_epub.reconstruction_v2.report import reconstruction_report

            self.assertEqual([], prior)
            result = reconstruct(source, scratch, pages, [], [response])
            report = reconstruction_report(result, 0)
            self.assertEqual(credit_task.metadata_ids, report.refinement_evidence[0].node_ids)
            self.assertEqual(
                ["AVA Fixture Studio"],
                [
                    claim.value
                    for claim in result.book.metadata
                    if claim.field == "contributor" and claim.status == "accepted"
                ],
            )
            import io
            import xml.etree.ElementTree as ET
            import zipfile

            with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
                opf_name = next(name for name in archive.namelist() if name.endswith(".opf"))
                package = ET.fromstring(archive.read(opf_name))
                creators = package.findall(".//{http://purl.org/dc/elements/1.1/}creator")
                self.assertEqual(["AVA Fixture Studio"], [node.text for node in creators])
            with self.assertRaisesRegex(ValueError, "stale"):
                accept_refinement(
                    credit_task, response.model_copy(update={"image_sha256": "d" * 64})
                )

    def test_groups_split_to_readable_crop_bounds_without_losing_credit_coverage(self):
        ids = [f"credit-{i}" for i in range(17)]
        groups = metadata_crop_groups(ids, lambda selected: len(selected) <= 3)
        self.assertEqual(ids, [ident for group in groups for ident in group])
        self.assertTrue(all(len(group) <= 3 for group in groups))
