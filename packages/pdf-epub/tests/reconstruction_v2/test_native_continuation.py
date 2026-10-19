"""Observed native paragraph hints can cross a page before a capitalized proper noun."""

import unittest
from dataclasses import replace

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_boundary import inferred_continuation
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.native_continuation import (
    NativeContinuation,
    native_hint_style,
)
from ava_pdf_epub.reconstruction_v2.refinement_joins import refined_boundaries
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan, Segment
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins


def observed_pair(direction="incoming"):
    style = Style(
        id="observed",
        family="serif",
        bold=False,
        italic=False,
        relative_size=1,
        line_height=1.2,
        align="start",
        indent_em=0,
    )
    left = Segment(
        id="left",
        page=1,
        kind="paragraph",
        method="native",
        text="We invited Captain",
        source_text="We invited\nCaptain",
        style=style.model_copy(update={"indent_em": 1}),
        native_line_ids=["a", "b"],
        box=Box(coordinate_space="page_points_top_left", x0=20, y0=700, x1=500, y1=750),
        continues_to_next=direction == "outgoing",
        spans=[ObservedSpan(start=3, end=10, url="https://example.com/left")],
    )
    right = Segment(
        id="right",
        page=2,
        kind="paragraph",
        method="native",
        text="North to A😀B café.",
        source_text="North to A😀B\ncafé.",
        style=style,
        native_line_ids=["c", "d"],
        box=Box(coordinate_space="page_points_top_left", x0=20, y0=20, x1=500, y1=60),
        continues_from_previous=direction == "incoming",
        spans=[ObservedSpan(start=9, end=12, url="https://example.com/unicode")],
    )
    hinted = right if direction == "incoming" else left
    proof = NativeContinuation(
        hinted.id,
        hinted.page,
        tuple(hinted.native_line_ids),
        hinted.continues_from_previous,
        hinted.continues_to_next,
        "a" * 64,
        "b" * 64,
        "c" * 64,
        first_line_flush=True,
    )
    state = AssemblyState(
        source_continuation_policy=POLICY,
        native_continuations={hinted.id: proof},
        placements={"left": (1, 0, 0), "right": (2, 0, 0)},
        evidence={"left": [{"page": 1}], "right": [{"page": 2}]},
    )
    return left, right, state


class NativeContinuationTests(unittest.TestCase):
    def test_hint_joins_capitalized_text_without_changing_source_or_losing_unicode_links(self):
        for direction in ("incoming", "outgoing"):
            left, right, state = observed_pair(direction)
            before = [s.model_dump() for s in (left, right)]
            self.assertTrue(inferred_continuation(left, right, state))
            joined = stream_joins([left, right], state)
            self.assertEqual(1, len(joined))
            result = joined[0]
            self.assertEqual("We invited Captain North to A😀B café.", result.text)
            self.assertEqual("We invited\nCaptain\nNorth to A😀B\ncafé.", result.source_text)
            self.assertEqual(1, result.style.indent_em)
            self.assertFalse(result.continues_from_previous or result.continues_to_next)
            self.assertEqual(("left", len(left.text) + 1), state.aliases["right"])
            self.assertEqual("A😀B", result.text[result.spans[1].start : result.spans[1].end])
            self.assertEqual(right.spans[0].url, result.spans[1].url)
            self.assertEqual([{"page": 1}, {"page": 2}], state.evidence["left"])
            self.assertEqual(before, [s.model_dump() for s in (left, right)])

    def test_joined_presentation_owns_head_indent_and_tail_gap_without_rounding(self):
        left, right, state = observed_pair()
        left = left.model_copy(
            update={
                "style": left.style.model_copy(
                    update={
                        "line_height": None,
                        "space_before_em": 1.7,
                        "space_after_em": 2,
                    }
                )
            }
        )
        right = right.model_copy(
            update={
                "style": right.style.model_copy(
                    update={
                        "space_before_em": 0,
                        "space_after_em": 0,
                        "relative_size": 1 + 1e-11,
                    }
                )
            }
        )
        result = stream_joins([left, right], state)[0]
        self.assertEqual(1, result.style.indent_em)
        self.assertEqual(1.7, result.style.space_before_em)
        self.assertEqual(0, result.style.space_after_em)
        self.assertEqual(1.2, result.style.line_height)
        self.assertEqual(1, result.style.relative_size)
        self.assertEqual(1 + 1e-11, right.style.relative_size)
        self.assertFalse(result.style.bold)
        self.assertIsNone(
            native_hint_style(
                left.style, right.style.model_copy(update={"relative_size": 1 + 1e-6})
            )
        )

    def test_two_declared_flags_cannot_bypass_refused_native_hint(self):
        for mutation in ("style", "indent", "placement"):
            left, right, state = observed_pair()
            left = left.model_copy(update={"continues_to_next": True})
            state.native_continuations["left"] = replace(
                state.native_continuations["right"],
                owner_id="left",
                page=1,
                line_ids=("a", "b"),
                incoming=False,
                outgoing=True,
            )
            if mutation == "style":
                right = right.model_copy(
                    update={"style": right.style.model_copy(update={"bold": True})}
                )
            elif mutation == "indent":
                right = right.model_copy(
                    update={"style": right.style.model_copy(update={"indent_em": None})}
                )
            else:
                state.placements.clear()
            with self.subTest(mutation=mutation):
                with self.assertRaisesRegex(ValueError, "Unresolved prose continuation"):
                    stream_joins([left, right], state)
        state.source_continuation_policy = None
        self.assertEqual(1, len(stream_joins([left, right], state)))

    def test_join_cannot_paint_ancestor_decoration_over_an_undecorated_head(self):
        for decoration in ("underline", "strike_through"):
            left, right, state = observed_pair()
            right = right.model_copy(
                update={"style": right.style.model_copy(update={decoration: True})}
            )
            with self.subTest(decoration=decoration):
                self.assertIsNone(native_hint_style(left.style, right.style))
                with self.assertRaisesRegex(ValueError, "Unresolved prose continuation"):
                    stream_joins([left, right], state)

    def test_provenance_policy_and_explicit_negative_are_not_invented(self):
        for mutation in (
            "missing",
            "foreign_owner",
            "foreign_lines",
            "foreign_page",
            "negative",
            "peer_negative",
            "legacy",
        ):
            left, right, state = observed_pair()
            proof = state.native_continuations["right"]
            if mutation == "missing":
                state.native_continuations.clear()
            elif mutation == "foreign_owner":
                state.native_continuations["right"] = replace(proof, owner_id="other")
            elif mutation == "foreign_lines":
                state.native_continuations["right"] = replace(proof, line_ids=("foreign",))
            elif mutation == "foreign_page":
                state.native_continuations["right"] = replace(proof, page=9)
            elif mutation == "negative":
                state.native_continuations["right"] = replace(proof, incoming=False)
            elif mutation == "peer_negative":
                state.native_continuations["left"] = replace(
                    proof,
                    owner_id="left",
                    page=1,
                    line_ids=("a", "b"),
                    incoming=False,
                    outgoing=False,
                )
            else:
                state.source_continuation_policy = None
            with self.subTest(mutation=mutation):
                self.assertFalse(inferred_continuation(left, right, state))
                with self.assertRaisesRegex(ValueError, "Unresolved prose continuation"):
                    stream_joins([left, right], state)

    def test_lowercase_cannot_bypass_a_refused_opted_in_hint(self):
        for mutation in ("peer_negative", "missing", "foreign", "indent", "style", "placement"):
            left, right, state = observed_pair()
            right = right.model_copy(update={"text": right.text.lower()})
            proof = state.native_continuations["right"]
            if mutation == "peer_negative":
                state.native_continuations["left"] = replace(
                    proof,
                    owner_id="left",
                    page=1,
                    line_ids=("a", "b"),
                    incoming=False,
                    outgoing=False,
                )
            elif mutation == "missing":
                state.native_continuations.clear()
            elif mutation == "foreign":
                state.native_continuations["right"] = replace(proof, line_ids=("foreign",))
            elif mutation == "indent":
                right = right.model_copy(
                    update={"style": right.style.model_copy(update={"indent_em": None})}
                )
            elif mutation == "style":
                right = right.model_copy(
                    update={"style": right.style.model_copy(update={"bold": True})}
                )
            else:
                state.placements.clear()
            with self.subTest(mutation=mutation):
                self.assertFalse(inferred_continuation(left, right, state))
                with self.assertRaisesRegex(ValueError, "Unresolved prose continuation"):
                    stream_joins([left, right], state)
        left, right, state = observed_pair()
        right = right.model_copy(update={"text": right.text.lower()})
        state.source_continuation_policy = None
        self.assertTrue(inferred_continuation(left, right, state))

    def test_only_real_page_or_column_boundary_is_supported(self):
        left, right, state = observed_pair()
        state.placements = {"left": (1, 0, 1), "right": (1, 0, 2)}
        right = right.model_copy(update={"page": 1})
        state.native_continuations["right"] = replace(state.native_continuations["right"], page=1)
        self.assertTrue(inferred_continuation(left, right, state))
        for positions in (
            {},
            {"left": (1, 0, 1), "right": (1, 0, 1)},
            {"left": (1, 0, 1), "right": (1, 1, 2)},
            {"left": (1, 0, 0), "right": (3, 0, 0)},
        ):
            state.placements = positions
            self.assertFalse(inferred_continuation(left, right, state))

    def test_unknown_indent_or_conflicting_presentation_cannot_be_guessed(self):
        for patch in (
            {"indent_em": None},
            {"indent_em": 0.2},
            {"align": "center"},
            {"block_indent_em": 1},
            {"bold": True},
            {"italic": True},
            {"family": "sans-serif"},
            {"relative_size": 1.01},
            {"line_height": 1.3},
        ):
            left, right, state = observed_pair()
            changed = right.model_copy(update={"style": right.style.model_copy(update=patch)})
            with self.subTest(patch=patch):
                self.assertFalse(inferred_continuation(left, changed, state))
        for patch in (
            {"method": "ocr"},
            {"kind": "quote"},
            {"structure_candidate": True},
            {"preserve_line_breaks": True},
            {"native_line_ids": []},
        ):
            left, right, state = observed_pair()
            self.assertFalse(inferred_continuation(left, right.model_copy(update=patch), state))

    def test_terminal_punctuation_false_edge_and_unmatched_outer_flag_still_refuse(self):
        for punctuation in (".", "!", "?", ":", ";", ".”"):
            left, right, state = observed_pair()
            self.assertFalse(
                inferred_continuation(
                    left.model_copy(update={"text": left.text + punctuation}), right, state
                )
            )
        left, right, state = observed_pair()
        state.refined_joins[(left.id, right.id)] = False
        separated = refined_boundaries([left, right], state.refined_joins)
        self.assertEqual(2, len(stream_joins(separated, state)))
        left, right, state = observed_pair()
        with self.assertRaisesRegex(ValueError, "Unresolved prose continuation"):
            stream_joins([left.model_copy(update={"continues_from_previous": True}), right], state)
