"""Source-corroborated multipart titles preserve topology, runs and exact positions."""

import hashlib
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from ava_pdf_epub.contracts.source import Box
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.annotation_spans import apply_annotation_spans
from ava_pdf_epub.reconstruction_v2.assemble_blocks import assemble_blocks
from ava_pdf_epub.reconstruction_v2.assemble_chapters import assemble_chapters
from ava_pdf_epub.reconstruction_v2.assemble_page_addresses import assemble_page_addresses
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.bind_printed_targets import bind_printed_targets
from ava_pdf_epub.reconstruction_v2.compound_heading_claims import resolve_heading_claims
from ava_pdf_epub.reconstruction_v2.compound_heading_style_update import compound_style_update
from ava_pdf_epub.reconstruction_v2.heading_hierarchy import heading_hierarchy
from ava_pdf_epub.reconstruction_v2.internal_links import internal_links
from ava_pdf_epub.reconstruction_v2.native_line_offsets import NativeLineOffset
from ava_pdf_epub.reconstruction_v2.native_size_presentation import apply_native_sizes
from ava_pdf_epub.reconstruction_v2.observations import (
    Glyph,
    NativeLine,
    PageObservation,
    RequiredRegion,
)
from ava_pdf_epub.reconstruction_v2.refinement_catalogue import refinement_catalogue
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan, Segment
from ava_pdf_epub.reconstruction_v2.source_page_starts import capture_page_starts
from ava_pdf_epub.reconstruction_v2.structure_claims import StructureClaim

from .native_size_fixture import document
from .native_size_fixture import segment as native_segment


def heading(ident, text, y=20, **updates):
    values = dict(
        id=ident,
        text=text,
        source_text=text,
        page=1,
        kind="heading",
        heading_level=1,
        method="native",
        box=Box(coordinate_space="page_points_top_left", x0=20, y0=y, x1=200, y1=y + 12),
        style=Style(id="base", family="serif", bold=True, italic=False, relative_size=2),
    )
    values.update(updates)
    return Segment.model_validate(values)


def workspace(items):
    state = AssemblyState(source_title_policy="ava-frontmatter-title-1")
    for index, s in enumerate(items):
        state.segments[s.id] = s
        state.placements[s.id] = (s.page, index, 0)
        state.evidence[s.id] = [
            dict(page=s.page, region_id="region-" + s.id, box=s.box.model_dump(), method=s.method)
        ]
    return state


def claim(text, **kwargs):
    return StructureClaim(text, None, pdf_page=1, depth=0, **kwargs)


def resolve(items, claims):
    state = workspace(items)
    result, targets = resolve_heading_claims(claims, {}, items, state)
    return result, targets, state


class CompoundHeadingTests(unittest.TestCase):
    def test_complete_title_is_one_chapter_and_page_start_with_exact_later_links(self):
        items = [
            heading("n", "1"),
            heading("t", "A😀B café", 40),
            heading(
                "s",
                "Office and light",
                60,
                style=Style(
                    id="sub", family="sans-serif", bold=False, italic=True, relative_size=1.5
                ),
            ),
            heading(
                "ref",
                "Return",
                100,
                kind="paragraph",
                heading_level=None,
                spans=[ObservedSpan(start=0, end=6, target_text="A😀B café")],
            ),
        ]
        state = workspace(items)
        state.internal_targets.append(("t", 0, 3, "s", 7))
        items = bind_printed_targets(items, state)
        actual, targets = resolve_heading_claims(
            [claim("1 A😀B café Office and light")], {}, items, state
        )
        self.assertEqual(["n"], targets)
        self.assertEqual("1\nA😀B café\nOffice and light", actual[0].text)
        actual[0] = actual[0].model_copy(
            update={"chapter_start": True, "chapter_role": "bodymatter"}
        )
        state.segments.update({s.id: s for s in actual})
        starts = capture_page_starts(actual, state)
        self.assertEqual("1", starts[1].text)
        assemble_blocks(actual, [], Path("."), state)
        chapters, toc = assemble_chapters(state)
        self.assertEqual(1, len(chapters))
        self.assertEqual(1, len(toc))
        self.assertEqual(actual[0].text, toc[0]["label"])
        internal_links(state, {"n": "chapter-1", "ref": "chapter-1"})
        addresses = []
        assemble_page_addresses(starts, state, chapters, addresses)
        self.assertEqual(0, addresses[0]["target"]["offset"])
        origin = state.blocks[0]["content"]
        self.assertEqual(len(actual[0].text) + 1, len(origin["codepoint_utf16"]))
        self.assertEqual(len(actual[0].text) + 1, origin["codepoint_utf16"][-1])
        source_link = next(s for s in origin["spans"] if s.get("link"))
        self.assertEqual((2, 5), (source_link["start"], source_link["end"]))
        self.assertEqual(len("1\nA😀B café\n") + 7, source_link["link"]["offset"])
        reference = state.blocks[1]["content"]["spans"][-1]["link"]
        self.assertEqual(("n", 2), (reference["block_id"], reference["offset"]))
        self.assertEqual(3, len(state.blocks[0]["evidence"]))
        last = actual[0].spans[-1].style
        self.assertEqual(
            ("sans-serif", False, True, 0.75),
            (last.family, last.bold, last.italic, last.relative_size),
        )

    def test_complete_compound_target_waits_for_assembly_and_missing_target_still_fails(self):
        items = [
            heading("a", "1"),
            heading("b", "Opening", 40),
            heading(
                "r",
                "See opening",
                80,
                kind="paragraph",
                heading_level=None,
                spans=[ObservedSpan(start=0, end=11, target_text="1\nOpening")],
            ),
        ]
        state = workspace(items)
        bound = bind_printed_targets(items, state, defer_missing=True)
        joined, _ = resolve_heading_claims([claim("1 Opening")], {}, bound, state)
        final = bind_printed_targets(joined, state)
        self.assertIsNone(final[-1].spans[0].target_text)
        self.assertEqual(("r", 0, 11, "a", 0), state.internal_targets[-1])
        bad = items[-1].model_copy(
            update={"spans": [ObservedSpan(start=0, end=11, target_text="Missing")]}
        )
        deferred = bind_printed_targets([*items[:-1], bad], workspace(items), defer_missing=True)
        with self.assertRaisesRegex(ValueError, "missing or ambiguous"):
            bind_printed_targets(deferred, workspace(deferred))

    def test_navigation_aliases_do_not_rewrite_printed_words_or_insert_colons(self):
        for title, texts in [
            ("Appendix 2: Further reading", ["Appendix 2", "Further reading"]),
            ("4 Light - reflections", ["4", "Light – reﬂections"]),
        ]:
            items = [heading(str(i), text, i * 20) for i, text in enumerate(texts)]
            result, targets, state = resolve(items, [claim(title), claim(title)])
            self.assertEqual("\n".join(texts), result[0].text)
            self.assertEqual(["0", "0"], targets)
            self.assertEqual(1, len(state.compound_heading_sources))

    def test_ambiguous_interrupted_cross_column_and_inconsistent_groups_refuse(self):
        samples = [
            (
                [heading("a", "1"), heading("b", "Opening"), heading("c", "1 Opening")],
                [claim("1 Opening")],
            ),
            (
                [
                    heading("a", "1"),
                    heading("x", "Body", kind="paragraph", heading_level=None),
                    heading("b", "Opening"),
                ],
                [claim("1 Opening")],
            ),
            ([heading("a", "1"), heading("b", "Opening")], [claim("1 Opening"), claim("Opening")]),
            ([heading("a", "1"), heading("b", "Opening", page=2)], [claim("1 Opening")]),
            ([heading("a", "1"), heading("b", "Opening", method="ocr")], [claim("1 Opening")]),
            ([heading("a", "2"), heading("b", "Opening")], [claim("1 Opening")]),
            ([heading("a", "Appendix 2"), heading("b", "Opening")], [claim("Appendix 2; Opening")]),
            ([heading("a", "Light"), heading("b", "— Opening")], [claim("Light - Opening")]),
            (
                [heading("a", "1"), heading("b", "Opening", chapter_start=True)],
                [claim("1 Opening")],
            ),
        ]
        for items, claims in samples:
            with self.subTest(ids=[i.id for i in items], text=claims[0].title):
                with self.assertRaises(ValueError):
                    resolve(items, claims)
        items = [heading("a", "1"), heading("b", "Opening")]
        state = workspace(items)
        state.placements.update(a=(1, 0, 1), b=(1, 0, 2))
        with self.assertRaisesRegex(ValueError, "disagrees"):
            resolve_heading_claims([claim("1 Opening")], {}, items, state)

    def test_single_heading_unchanged_and_repeated_native_lines_map_exactly(self):
        one = heading("a", "Opening")
        result, _, state = resolve([one], [claim("Opening")])
        self.assertEqual([one], result)
        self.assertFalse(state.compound_heading_sources)
        items = [
            heading("a", "Echo", native_line_ids=["line-a"]),
            heading("b", "Echo", 40, native_line_ids=["line-b"]),
        ]
        state = workspace(items)
        for item in items:
            line = item.native_line_ids[0]
            state.native_line_maps[line] = NativeLineOffset(
                line_id=line,
                segment_id=item.id,
                start=0,
                end=4,
                text_sha256=hashlib.sha256(b"Echo").hexdigest(),
            )
        result, _ = resolve_heading_claims([claim("Echo Echo")], {}, items, state)
        self.assertEqual("Echo\nEcho", result[0].text)
        right = state.native_line_maps["line-b"]
        self.assertEqual(("a", 5, 9), (right.segment_id, right.start, right.end))
        self.assertEqual(hashlib.sha256(b"Echo").hexdigest(), right.text_sha256)

    def test_annotation_on_second_repeated_line_is_localized_before_join(self):
        items = [heading("a", "Echo"), heading("b", "Echo", 50)]
        lines = [
            NativeLine(
                id=s.id + "-line",
                box=s.box,
                text=s.text,
                style=s.style,
                glyphs=[Glyph(text=s.text, box=s.box, size=20, font="Times-Bold", visible=True)],
            )
            for s in items
        ]
        page = PageObservation(
            number=1,
            width_pt=600,
            height_pt=800,
            rotation=0,
            render_path="page.png",
            render_sha256="a" * 64,
            render_width=600,
            render_height=800,
            lines=lines,
            graphics=[],
            risks=[],
            required_regions=[
                RequiredRegion(
                    kind="inline_style",
                    box=items[1].box,
                    style=Style(id="annotation", underline=True),
                )
            ],
        )
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            Image.new("RGB", (600, 800), "white").save(scratch / "page.png")
            annotated = apply_annotation_spans(page, items, scratch)
        result, _, state = resolve(annotated, [claim("Echo Echo")])
        marks = [s for s in result[0].spans if s.style and s.style.underline]
        self.assertEqual([(5, 9)], [(s.start, s.end) for s in marks])
        self.assertEqual("Echo\nEcho", result[0].text)
        damaged = result[0].model_copy(update={"text": "Changed\nEcho"})
        with self.assertRaisesRegex(ValueError, "lost its first component"):
            capture_page_starts([damaged], state)

    def test_effective_sizes_flatten_overlaps_and_keep_link_color_false_and_unknown(self):
        items = [
            heading("a", "1"),
            heading(
                "b",
                "A😀 café",
                40,
                style=Style(
                    id="other", family="sans-serif", bold=False, italic=True, relative_size=1.5
                ),
                spans=[
                    ObservedSpan(
                        start=0, end=2, style=Style(id="color", color="#ff0000", relative_size=1.2)
                    ),
                    ObservedSpan(start=0, end=2, url="https://example.org"),
                ],
            ),
        ]
        result, _, _ = resolve(items, [claim("1 A😀 café")])
        first = next(s for s in result[0].spans if s.start == 2)
        self.assertAlmostEqual(0.9, first.style.relative_size)
        self.assertEqual(
            ("#ff0000", False, "https://example.org"),
            (first.style.color, first.style.bold, first.url),
        )
        items[1] = items[1].model_copy(update={"style": Style(id="unknown", relative_size=1.5)})
        with self.assertRaisesRegex(ValueError, "unknown component style"):
            resolve(items, [claim("1 A😀 café")])

    def test_later_ocr_base_correction_updates_generated_runs_not_explicit_mixed_runs(self):
        items = [
            heading("a", "Appendix 1", method="ocr"),
            heading(
                "b",
                "Further reading",
                40,
                method="ocr",
                style=Style(id="sub", family="serif", bold=True, italic=True, relative_size=1.5),
                spans=[ObservedSpan(start=0, end=7, style=Style(id="em", family="monospace"))],
            ),
        ]
        result, _, state = resolve(items, [claim("Appendix 1: Further reading")])
        changed = result[0].model_copy(
            update={
                "style": result[0].style.model_copy(
                    update={"family": "sans-serif", "bold": False, "relative_size": 2.5}
                )
            }
        )
        updated = compound_style_update(changed, state)
        self.assertEqual(
            ("sans-serif", False), (updated.spans[0].style.family, updated.spans[0].style.bold)
        )
        subtitle = [s for s in updated.spans if s.start > len("Appendix 1")]
        self.assertEqual("monospace", subtitle[0].style.family)
        self.assertTrue(subtitle[-1].style.italic)
        self.assertEqual("sans-serif", subtitle[-1].style.family)
        self.assertAlmostEqual(0.75, subtitle[-1].style.relative_size)
        self.assertEqual(result[0].text, updated.text)

    def test_base_size_correction_retains_legal_boundary_proportions(self):
        for before, component, after, expected in [(1, 3, 2, 3), (2, 1, 0.5, 0.5)]:
            items = [
                heading("a", "1", style=Style(id="a", relative_size=before)),
                heading("b", "Opening", 40, style=Style(id="b", relative_size=component)),
            ]
            result, _, state = resolve(items, [claim("1 Opening")])
            changed = result[0].model_copy(update={"style": Style(id="new", relative_size=after)})
            corrected = compound_style_update(changed, state)
            self.assertEqual(expected, corrected.spans[-1].style.relative_size)
            self.assertEqual(after, corrected.style.relative_size)

    def test_spatial_reflow_is_reported_without_unranking_corroborated_ocr(self):
        items = [
            heading("a", "Appendix 1", method="ocr"),
            heading(
                "b",
                "Reading",
                40,
                method="ocr",
                spans=[ObservedSpan(start=0, end=7, style=Style(id="layout", block_indent_em=2))],
            ),
        ]
        result, _, state = resolve(items, [claim("Appendix 1: Reading")])
        self.assertEqual(
            ["COMPOUND_HEADING_LAYOUT_REFLOWED"], [f.code for f in state.structure_findings]
        )
        self.assertEqual([], refinement_catalogue(result, state).decisions)

    def test_candidate_leader_uses_retained_size_with_promoted_heading_role(self):
        first, rows = native_segment("a", 1, 20, "paragraph", 1)
        first = first.model_copy(update={"structure_candidate": True})
        second, rows2 = native_segment("b", 1, 15, "heading", 1, y=80)
        child, rows3 = native_segment(
            "c",
            1,
            12,
            "heading",
            1,
            y=120,
            text="A subsection",
            source_text="A subsection",
            spans=[],
        )
        rows3 = [
            row.model_copy(
                update={
                    "text": "A subsection",
                    "glyphs": [row.glyphs[0].model_copy(update={"text": "A subsection"})],
                }
            )
            for row in rows3
        ]
        items, pages = document([(first, rows), (second, rows2), (child, rows3)])
        state = workspace(items)
        result, _ = resolve_heading_claims(
            [claim(first.text + " " + second.text)], {}, items, state
        )
        result[0] = result[0].model_copy(
            update={
                "kind": "heading",
                "heading_level": 1,
                "chapter_start": True,
                "structure_candidate": False,
            }
        )
        ranked = heading_hierarchy(
            result, pages, set(), compound_sources=state.compound_heading_sources
        )
        self.assertEqual(2, ranked[1].heading_level)

    def test_document_size_rebase_uses_first_source_line_and_preserves_inline_proportions(self):
        first, rows = native_segment("a", 3, 20, "heading", 1)
        second, rows2 = native_segment("b", 3, 15, "heading", 1, y=80)
        first = first.model_copy(
            update={"style": first.style.model_copy(update={"relative_size": 2})}
        )
        second = second.model_copy(
            update={"style": second.style.model_copy(update={"relative_size": 1.5})}
        )
        items, pages = document(
            [native_segment("body1", 1), native_segment("body2", 2), (first, rows), (second, rows2)]
        )
        state = workspace(items)
        result, _ = resolve_heading_claims(
            [StructureClaim(first.text + " " + second.text, None, pdf_page=3, depth=0)],
            {},
            items,
            state,
        )
        state.segments.update({s.id: s for s in result})
        assemble_blocks(result, pages, Path("."), state)
        spans = state.blocks[-1]["content"]["spans"].copy()
        apply_native_sizes(result, pages, state)
        style = state.styles[state.blocks[-1]["style_id"]]
        self.assertAlmostEqual(20 / 12, style["relative_size"])
        self.assertEqual(spans, state.blocks[-1]["content"]["spans"])


if __name__ == "__main__":
    unittest.main()
