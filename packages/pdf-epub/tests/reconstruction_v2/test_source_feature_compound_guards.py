"""A compound envelope cannot authorize missing, foreign, reordered or rewritten components."""

import unittest
from dataclasses import replace

from ava_pdf_epub.reconstruction_v2.source_feature_report import source_feature_coverage

from .source_feature_compound_fixture import compound_case


class CompoundFeatureGuards(unittest.TestCase):
    def test_changed_geometry_components_or_ranges_refuse(self):
        for change in [
            "missing",
            "reversed",
            "method",
            "box",
            "page",
            "envelope",
            "offset",
            "length",
            "range",
            "unbound",
        ]:
            with self.subTest(change=change):
                book, state = compound_case()
                claim = state.source_feature_evidence[0]
                ident = claim["node_id"]
                block = next(b for b in book.blocks if b.id == ident)
                binding = state.compound_feature_sources[ident]
                if change == "missing":
                    block = block.model_copy(update={"evidence": block.evidence[:1]})
                elif change == "reversed":
                    block = block.model_copy(update={"evidence": list(reversed(block.evidence))})
                elif change in {"method", "box"}:
                    first = block.evidence[0]
                    updates = (
                        {"method": "native"}
                        if change == "method"
                        else {"box": first.box.model_copy(update={"x1": first.box.x1 - 0.1})}
                    )
                    block = block.model_copy(
                        update={"evidence": [first.model_copy(update=updates), *block.evidence[1:]]}
                    )
                elif change == "page":
                    claim["page"] += 1
                elif change == "envelope":
                    claim["box"] = {**claim["box"], "x1": claim["box"]["x1"] - 0.1}
                elif change == "offset":
                    claim["canonical_start"] = 1
                elif change == "length":
                    claim["text_length"] -= 1
                elif change == "range":
                    ranges = ((0, 1, binding.ranges[0][2]), *binding.ranges[1:])
                    state.compound_feature_sources[ident] = replace(binding, ranges=ranges)
                elif change == "unbound":
                    state.compound_feature_sources.clear()
                book = book.model_copy(
                    update={"blocks": [block if b.id == ident else b for b in book.blocks]}
                )
                with self.assertRaises(ValueError):
                    source_feature_coverage(state, book)

    def test_original_component_or_feature_identity_cannot_change_during_binding(self):
        def tamper(state, change):
            ident = state.source_feature_evidence[0]["node_id"]
            if change == "order":
                state.evidence[ident].reverse()
            elif change == "text":
                parts = state.compound_heading_sources[ident]
                state.compound_heading_sources[ident] = (
                    parts[0],
                    parts[1].model_copy(update={"text": "Different"}),
                )
            else:
                state.source_feature_evidence[0]["box"]["x1"] -= 0.1

        for change in ["order", "text", "envelope"]:
            with (
                self.subTest(change=change),
                self.assertRaisesRegex(ValueError, "Compound feature"),
            ):
                compound_case(before_binding=lambda state, change=change: tamper(state, change))

    def test_small_binding_survives_observation_release_then_is_released_after_coverage(self):
        book, state = compound_case()
        self.assertEqual(1, len(state.compound_feature_sources))
        self.assertFalse(state.evidence)
        self.assertFalse(state.compound_heading_sources)
        source_feature_coverage(state, book)
        state.release_source_workspace()
        self.assertFalse(state.compound_feature_sources)
        self.assertEqual(
            "Appendix 3\nParadoxes 😀 purveyed",
            next(b for b in book.blocks if b.id == "heading-two").content.text,
        )
