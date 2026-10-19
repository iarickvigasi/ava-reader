"""Current source-policy admission never enlarges the public request contract."""

import unittest

from pydantic import ValidationError

from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.refinement_catalogue import RefinementCatalogue
from ava_pdf_epub.reconstruction_v2.refinement_catalogue_limits import catalogue_limit
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementTask, RefinementEdge
from ava_pdf_epub.reconstruction_v2.refinement_task_nodes import task_nodes

from .catalogue_batching_fixture import node
from .test_catalogue_dependencies import padded


class CatalogueGuardTests(unittest.TestCase):
    def test_internal_bound_requires_both_captured_current_policies(self):
        title, continuation = "ava-frontmatter-title-1", "ava-source-continuation-presentation-1"
        for captured_title, captured_continuation, argument in (
            (None, None, None),
            (title, None, title),
            (None, continuation, title),
            (title, continuation, None),
            (title, continuation, "future"),
        ):
            with self.subTest(policies=(captured_title, captured_continuation, argument)):
                state = AssemblyState(
                    source_title_policy=captured_title,
                    source_continuation_policy=captured_continuation,
                )
                self.assertEqual(256, catalogue_limit(state, argument))
        state = AssemblyState(source_title_policy=title, source_continuation_policy=continuation)
        self.assertEqual(20_000, catalogue_limit(state, title))

    def test_candidate_and_boundary_endpoints_remain_in_source_order(self):
        candidate = node("candidate", candidate=True).model_copy(
            update={"observed_style": Style(id="source", relative_size=1)}
        )
        original = padded([node("left"), candidate, node("right")])
        edge = RefinementEdge(id="edge", previous_id="left", next_id="right")
        nodes = task_nodes(original, ["right"], ["right"], [edge], projected=True)
        self.assertEqual(["left", "candidate", "right"], [n.id for n in nodes])
        self.assertEqual(candidate.model_dump(), nodes[1].model_dump())
        with self.assertRaisesRegex(ValueError, "missing source node"):
            task_nodes(original, ["missing"], [], [], projected=True)
        repeated = RefinementCatalogue([*original.nodes, node("left")], [], [])
        with self.assertRaisesRegex(ValueError, "Repeated"):
            task_nodes(repeated, [], [], [], projected=True)

    def test_public_request_still_rejects_more_than_256_nodes(self):
        # Field-level refusal precedes identity/image validation of this deliberately partial task.
        with self.assertRaises(ValidationError) as caught:
            BookRefinementTask.model_validate({"nodes": [node(f"p{i}") for i in range(257)]})
        failures = [e for e in caught.exception.errors() if e["loc"] == ("nodes",)]
        self.assertEqual(["too_long"], [e["type"] for e in failures])
