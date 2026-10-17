"""Real refinement paths update generated title runs and keep the spatial-reflow receipt."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.apply_refinement import apply_refinement
from ava_pdf_epub.reconstruction_v2.compound_heading_claims import resolve_heading_claims
from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementResponse
from ava_pdf_epub.reconstruction_v2.source_feature_tasks import source_feature_tasks

from .source_feature_answers import decisions
from .source_feature_fixtures import case
from .test_compound_headings import claim, workspace


class CompoundRefinementPaths(unittest.TestCase):
    def test_book_then_feature_refinement_correct_inherited_runs_and_keep_mixed_italic(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            source, page, original, _, _ = case(scratch, include_quote=False)
            first = original[0].model_copy(
                update={
                    "text": "2",
                    "source_text": "2",
                    "chapter_start": False,
                    "chapter_role": None,
                    "style": Style(id="observed", relative_size=1.7, italic=False),
                }
            )
            second = first.model_copy(
                update={
                    "id": "subtitle",
                    "text": "Workshop guide",
                    "source_text": "Workshop guide",
                    "style": Style(
                        id="observed", relative_size=1.3, italic=True, space_before_em=0.2
                    ),
                }
            )
            components = [first, second, *original[1:]]
            state = workspace(components)
            segments, _ = resolve_heading_claims([claim("2 Workshop guide")], {}, components, state)
            segments[0] = segments[0].model_copy(
                update={
                    "chapter_start": True,
                    "chapter_role": "bodymatter",
                }
            )
            tasks = prepare_refinement(source, scratch, [page], segments, state)
            responses = []
            for task in tasks:
                nodes = {n.id: n for n in task.nodes}
                crops = {c.node_id: c.id for c in task.crops if c.part == "head"}
                patches = []
                for ident in task.decision_ids:
                    node = nodes[ident]
                    is_heading = node.kind == "heading"
                    evidence = [crops[ident]]
                    if node.body_reference_id:
                        evidence.append(crops[node.body_reference_id])
                    patches.append(
                        dict(
                            node_id=ident,
                            text_sha256=node.text_sha256,
                            evidence_ids=evidence,
                            heading_level=1 if is_heading else None,
                            parent_id=None,
                            chapter_start=True if is_heading else None,
                            chapter_role="bodymatter" if is_heading else None,
                            style=dict(
                                id="observed", bold=is_heading, relative_size=2 if is_heading else 1
                            ),
                        )
                    )
                responses.append(
                    BookRefinementResponse.model_validate(
                        dict(
                            schema_version=task.response_schema_version,
                            task_id=task.task_id,
                            source_sha256=task.source_sha256,
                            observation_sha256=task.observation_sha256,
                            image_sha256=task.image.sha256,
                            decisions=patches,
                            joins=[],
                            unresolved=[],
                        )
                    )
                )
            refined = apply_refinement(segments, tasks, responses, state)
            title = refined[0]
            self.assertTrue(title.spans[0].style.bold)
            self.assertTrue(title.spans[-1].style.italic)
            self.assertAlmostEqual(1.3 / 1.7, title.spans[-1].style.relative_size)
            self.assertIn(
                "COMPOUND_HEADING_LAYOUT_REFLOWED", [f.code for f in state.structure_findings]
            )
            features = source_feature_tasks(source, scratch, [page], refined, state, 0)
            self.assertTrue(any(q.node_id == title.id for t in features for q in t.source_features))
            answers = [decisions(t) for t in features]
            finished = apply_refinement(refined, features, answers, state)
            title = finished[0]
            self.assertEqual("sans-serif", title.spans[0].style.family)
            self.assertTrue(title.spans[-1].style.italic)
            self.assertEqual("2\nWorkshop guide", title.text)
            self.assertIn(
                "COMPOUND_HEADING_LAYOUT_REFLOWED", [f.code for f in state.structure_findings]
            )
