"""Complete-title selection is one exact source heading with independently bound context."""

import copy
import tempfile
import unittest
from pathlib import Path

from pydantic import ValidationError

from ava_pdf_epub.contracts.common import text_digest
from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.bibliographic_refinement import bibliographic_candidates
from ava_pdf_epub.reconstruction_v2.frontmatter_title_apply import corroborated_cover_evidence
from ava_pdf_epub.reconstruction_v2.metadata_scope import metadata_scope
from ava_pdf_epub.reconstruction_v2.printed_metadata import printed_metadata
from ava_pdf_epub.reconstruction_v2.printed_title_v2_contract import (
    FrontmatterTitleResponse,
    FrontmatterTitleTask,
)
from ava_pdf_epub.reconstruction_v2.printed_title_v2_response import accept_frontmatter_title
from ava_pdf_epub.reconstruction_v2.refinement_identity import refinement_identifier

from .frontmatter_title_fixture import TITLE, frontmatter_fixture, frontmatter_response


class FrontmatterTitleTests(unittest.TestCase):
    def test_later_complete_title_with_author_context_is_exact_and_does_not_rewrite_blocks(self):
        with tempfile.TemporaryDirectory() as directory:
            task, _, segments, state = frontmatter_fixture(Path(directory))
            self.assertEqual([2, 4], [n.page for n in task.nodes if n.text == TITLE])
            context = next(c for c in task.crops if c.part == "context" and c.page == 4)
            author = segments[7]
            self.assertLessEqual(context.source_box.y0, author.box.y0)
            self.assertGreaterEqual(context.source_box.y1, author.box.y1)
            original = copy.deepcopy(state.blocks)
            result = apply_refinement(segments, [task], [frontmatter_response(task)], state)
            self.assertEqual(segments, result)
            self.assertEqual(original, state.blocks)
            claims = printed_metadata(state, None)
            title = next(c for c in claims if c["field"] == "title")
            self.assertEqual(TITLE, title["value"])
            self.assertEqual([4], [e["page"] for e in title["evidence"]])
            _, eligible = metadata_scope(state)
            self.assertIn("observed-7", eligible)
            self.assertNotIn("observed-4", eligible)
            self.assertNotIn("observed-12", eligible)

    def test_complete_ocr_cover_with_separate_author_remains_selectable(self):
        with tempfile.TemporaryDirectory() as directory:
            task, _, _, state = frontmatter_fixture(Path(directory), complete_ocr_cover=True)
            node = next(n for n in task.nodes if n.id == "observed-0")
            self.assertTrue(node.primary_eligible)
            response = frontmatter_response(task, node.id)
            accept_frontmatter_title(task, response)
            self.assertEqual(TITLE, node.text)
            self.assertIsNone(state.frontmatter_title)

    def test_decline_cannot_promote_partial_fragments_or_filename(self):
        with tempfile.TemporaryDirectory() as directory:
            task, _, segments, state = frontmatter_fixture(Path(directory))
            state.printed_title = (segments[0].id, text_digest(segments[0].text), "title")
            apply_refinement(segments, [task], [frontmatter_response(task, None)], state)
            self.assertFalse(any(c["field"] == "title" for c in printed_metadata(state, None)))
            self.assertEqual("FRONTMATTER_TITLE_UNRESOLVED", state.structure_findings[-1].code)

    def test_full_title_is_not_a_credit_and_cover_requires_distinct_firstpage_proof(self):
        with tempfile.TemporaryDirectory() as directory:
            task, _, segments, state = frontmatter_fixture(Path(directory))
            apply_refinement(segments, [task], [frontmatter_response(task)], state)
            self.assertEqual([], corroborated_cover_evidence(state))
        with tempfile.TemporaryDirectory() as directory:
            task, _, segments, state = frontmatter_fixture(Path(directory))
            apply_refinement(segments, [task], [frontmatter_response(task, cover=True)], state)
            self.assertTrue(corroborated_cover_evidence(state))
            self.assertEqual({1}, {e["page"] for e in corroborated_cover_evidence(state)})
        with tempfile.TemporaryDirectory() as directory:
            task, _, segments, state = frontmatter_fixture(Path(directory))
            state.bibliographic_roles["observed-5"] = ("author", TITLE)
            with self.assertRaisesRegex(ValueError, "conflicts"):
                apply_refinement(segments, [task], [frontmatter_response(task)], state)

    def test_stale_hash_wrong_context_and_replacement_text_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            task, _, _, _ = frontmatter_fixture(Path(directory))
            valid = frontmatter_response(task).model_dump()
            for field in ["source_sha256", "image_sha256", "selected_text_sha256"]:
                raw = copy.deepcopy(valid)
                raw[field] = "f" * 64
                with self.assertRaises(ValueError):
                    accept_frontmatter_title(task, FrontmatterTitleResponse.model_validate(raw))
            raw = copy.deepcopy(valid)
            raw["evidence_ids"][1] = "context-page2"
            with self.assertRaisesRegex(ValueError, "evidence"):
                accept_frontmatter_title(task, FrontmatterTitleResponse.model_validate(raw))
            raw = copy.deepcopy(valid)
            raw["text"] = "Invented replacement"
            with self.assertRaises(ValidationError):
                FrontmatterTitleResponse.model_validate(raw)
            raw_task = task.model_dump()
            raw_task["nodes"][0]["text"] = "Changed"
            raw_task["task_id"] = refinement_identifier(raw_task)
            with self.assertRaisesRegex(ValueError, "text/box"):
                FrontmatterTitleTask.model_validate(raw_task)

    def test_new_bibliography_scope_admits_native_titlepage_and_stops_before_contents(self):
        with tempfile.TemporaryDirectory() as directory:
            _, _, segments, _ = frontmatter_fixture(Path(directory))
            ids = bibliographic_candidates(segments, source_title_policy="ava-frontmatter-title-1")
            self.assertIn("observed-7", ids)
            self.assertNotIn("observed-10", ids)
            self.assertNotIn("observed-12", ids)

    def test_mixed_cover_fragments_and_author_are_not_chapter_navigation_labels(self):
        from ava_pdf_epub.reconstruction_v2.assemble_chapters import assemble_chapters
        from ava_pdf_epub.reconstruction_v2.frontmatter_navigation import frontmatter_navigation

        with tempfile.TemporaryDirectory() as directory:
            task, _, segments, state = frontmatter_fixture(Path(directory))
            apply_refinement(segments, [task], [frontmatter_response(task)], state)
            for block in state.blocks:
                if block["kind"] == "heading":
                    block["level"] = state.segments[block["id"]].heading_level
            original = copy.deepcopy(state.blocks)
            chapters, toc = assemble_chapters(state)
            body_id = next(c["id"] for c in chapters if c["role"] == "bodymatter")
            body_toc = [entry for entry in toc if entry["target"]["chapter_id"] == body_id]
            frontmatter_navigation(state, chapters, toc, [])
            self.assertEqual(TITLE, chapters[0]["title"])
            self.assertEqual(
                [TITLE],
                [entry["label"] for entry in toc if entry["target"]["chapter_id"] != body_id],
            )
            self.assertEqual(
                body_toc, [entry for entry in toc if entry["target"]["chapter_id"] == body_id]
            )
            self.assertEqual([b["content"] for b in original], [b["content"] for b in state.blocks])
            self.assertEqual(
                "observed-5",
                next(entry for entry in toc if entry["label"] == TITLE)["target"]["block_id"],
            )

    def test_narrow_source_panels_reserve_nonoverlapping_label_slots_without_stretch(self):
        import math
        from itertools import pairwise

        from PIL import ImageFont

        from ava_pdf_epub.contracts.source import Box
        from ava_pdf_epub.reconstruction_v2.printed_title_v2_contract import (
            FrontmatterTitleNode,
            FrontmatterTitlePage,
        )
        from ava_pdf_epub.reconstruction_v2.printed_title_v2_geometry import (
            LABEL_WIDTH,
            frontmatter_title_geometry,
        )

        nodes = [
            FrontmatterTitleNode(
                id=ident,
                page=1,
                text="A",
                text_sha256=text_digest("A"),
                method="native",
                box=Box(coordinate_space="page_points_top_left", x0=20, y0=20, x1=30, y1=40),
                page_width_pt=450,
                page_height_pt=700,
                render_sha256="a" * 64,
                primary_eligible=True,
            )
            for ident in ["one", "two"]
        ]
        pages = [
            FrontmatterTitlePage(
                page=1, page_width_pt=450, page_height_pt=700, render_sha256="a" * 64
            )
        ]
        pieces, _, _ = frontmatter_title_geometry(nodes, pages)
        font = ImageFont.load_default(size=18)
        for piece, next_piece in pairwise(pieces):
            ident, _, _, _, box, _, pixels = piece
            self.assertEqual(math.ceil((box.x1 - box.x0) * 2), pixels[2] - pixels[0])
            self.assertEqual(math.ceil((box.y1 - box.y0) * 2), pixels[3] - pixels[1])
            self.assertLessEqual(font.getlength(ident) + 8, LABEL_WIDTH)
            self.assertLess(pixels[0] + 4 + font.getlength(ident), next_piece[6][0])
