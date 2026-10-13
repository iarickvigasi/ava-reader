"""The numbered gutter and body first-line displacement are different source measurements."""

import hashlib
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assemble_blocks import assemble_blocks
from ava_pdf_epub.reconstruction_v2.assemble_lists import assemble_lists
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.list_body_geometry import list_body_geometry
from ava_pdf_epub.reconstruction_v2.native_indent_rows import indent_rows
from ava_pdf_epub.reconstruction_v2.normalize_list_bodies import (
    capture_list_bodies,
    normalize_list_bodies,
)
from ava_pdf_epub.reconstruction_v2.observations import Glyph, NativeLine
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.printed_markers import printed_markers
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

from .source_indent_fixture import page, segment
from .test_tagged_native_furniture_and_wraps import tagged_source


def row(ident, top, *, label=None, body=90, marker_size=10):
    prefix = (label + " ") if label else ""
    text = prefix + "Authored words"
    glyphs = []
    for value, x, size in [(prefix, 72, marker_size), ("Authored words", body, 10)]:
        if value:
            glyphs.append(
                Glyph(
                    text=value,
                    font="Helvetica",
                    size=size,
                    visible=True,
                    box=dict(
                        coordinate_space="page_points_top_left",
                        x0=x,
                        y0=top,
                        x1=x + len(value) * 4,
                        y1=top + 10,
                    ),
                )
            )
    return NativeLine(
        id=ident,
        text=text,
        glyphs=glyphs,
        style=Style(id=ident),
        box=dict(
            coordinate_space="page_points_top_left",
            x0=min(g.box.x0 for g in glyphs),
            x1=max(g.box.x1 for g in glyphs),
            y0=top,
            y1=top + 10,
        ),
    )


class ListBodyGeometry(unittest.TestCase):
    def test_body_measurement_uses_body_font_and_preserves_real_first_line_indent(self):
        first, following = row("a", 20, label="12.", body=110, marker_size=20), row("b", 35)
        item = segment("item", [first, following]).model_copy(
            update={"kind": "list_item", "text": first.text + " " + following.text}
        )
        self.assertEqual(
            (110, 90, 10), list_body_geometry(item, indent_rows(page([first, following]), [item]))
        )
        for change in (
            "missing",
            "foreign",
            "invisible",
            "invisible-marker",
            "foreign-body",
            "duplicate",
            "ocr",
            "inconsistent",
            "shared-line",
            "shared-glyph",
            "foreign-row",
            "centered",
            "right-aligned",
        ):
            values = {r.id: r for r in [first, following]}
            value = item
            extra_rows, extra_segments = [], []
            if change == "missing":
                values.pop("b")
            if change == "foreign":
                values["a"] = first.model_copy(update={"text": "99. Authored words"})
            if change == "invisible":
                values["b"] = following.model_copy(
                    update={
                        "glyphs": [
                            g.model_copy(update={"visible": False}) for g in following.glyphs
                        ]
                    }
                )
            if change == "invisible-marker":
                values["a"] = first.model_copy(
                    update={
                        "glyphs": [
                            first.glyphs[0].model_copy(update={"visible": False}),
                            first.glyphs[1],
                        ]
                    }
                )
            if change == "foreign-body":
                value = item.model_copy(update={"text": "12. A different source paragraph"})
            if change == "duplicate":
                value = item.model_copy(update={"native_line_ids": ["a", "a"]})
            if change == "ocr":
                value = item.model_copy(update={"method": "ocr"})
            if change == "inconsistent":
                values["c"] = row("c", 50, body=130)
                value = item.model_copy(update={"native_line_ids": ["a", "b", "c"]})
            if change == "shared-line":
                extra_segments.append(item.model_copy(update={"id": "other"}))
            if change == "shared-glyph":
                extra_rows.append(first.model_copy(update={"id": "same-ink"}))
            if change == "foreign-row":
                value = item.model_copy(update={"box": first.box})
            if change in {"centered", "right-aligned"}:
                value = item.model_copy(
                    update={
                        "style": Style(
                            id="aligned", align="center" if change == "centered" else "right"
                        )
                    }
                )
            with self.subTest(change=change):
                proof = indent_rows(page([*values.values(), *extra_rows]), [value, *extra_segments])
                self.assertIsNone(list_body_geometry(value, proof))

    def test_semantic_cohorts_align_short_long_and_keep_body_hang_and_nested_membership(self):
        specs = [
            ("short", 90, [], 1, 1),
            ("long", 90, [90], 1, 2),
            ("first-indent", 110, [90], 1, 3),
            ("body-hang", 90, [110], 1, 4),
            ("nested", 150, [150], 2, 1),
            ("other-column", 310, [], 1, 5),
        ]
        rows, items = [], []
        for index, (ident, first, tails, depth, number) in enumerate(specs):
            local = [row(ident + "-0", 20 + index * 45, label=f"{number}.", body=first)]
            local += [
                row(ident + f"-{i + 1}", 35 + index * 45, body=x) for i, x in enumerate(tails)
            ]
            items.append(
                segment(
                    ident,
                    local,
                    Style(id=ident, indent_em=-1.8, block_indent_em=3.6, color="#1f3763"),
                ).model_copy(
                    update={
                        "kind": "list_item",
                        "text": " ".join(r.text for r in local),
                        "list_depth": depth,
                        "list_ordered": True,
                        "list_start": number,
                    }
                )
            )
            rows.extend(local)
        observed = page(rows, height=300)
        prepared = [
            PreparedPage(
                schema_version="ava-prepared-page-1",
                source_sha256="a" * 64,
                source_byte_length=1,
                source_page_count=1,
                observation=observed,
                tables=[],
                native_segments=items,
                tasks=[],
            )
        ]
        state = AssemblyState(
            evidence={
                s.id: [dict(page=1, region_id="region", method="native", box=s.box.model_dump())]
                for s in items
            },
            placements={s.id: (1, 0, 0) for s in items},
        )
        state.placements["other-column"] = (1, 0, 2)
        capture_list_bodies(items, prepared, state)
        stripped = printed_markers(items, state)
        state.segments = {s.id: s for s in stripped}
        assemble_blocks(stripped, prepared, Path("."), state)
        assemble_lists(state, [dict(block_ids=[s.id for s in stripped])])
        before = [b["content"] for b in state.blocks]
        normalize_list_bodies(state)
        result = {b["id"]: state.styles[b["style_id"]] for b in state.blocks}
        self.assertTrue(all(s["indent_em"] + s["block_indent_em"] >= 0 for s in result.values()))
        for ident in ["short", "long", "nested", "other-column"]:
            self.assertEqual((0, 0), (result[ident]["indent_em"], result[ident]["block_indent_em"]))
        self.assertEqual(
            (2, 0), (result["first-indent"]["indent_em"], result["first-indent"]["block_indent_em"])
        )
        self.assertEqual(
            (-2, 2), (result["body-hang"]["indent_em"], result["body-hang"]["block_indent_em"])
        )
        self.assertEqual("body-hang", state.lists[1]["parent_item_id"])
        self.assertEqual(before, [b["content"] for b in state.blocks])
        self.assertTrue(all(s["color"] == "#1f3763" for s in result.values()))

    def test_real_tagged_pdf_body_normalization_and_no_policy_compatibility(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "book.pdf"
            tagged_source(source, separate_label=True, indent=36.68)
            prepared = prepare_source(
                source,
                root / "scratch",
                hashlib.sha256(source.read_bytes()).hexdigest(),
                profile_id=BILINGUAL_PROFILE,
                source_feature_policy=FEATURE_POLICY,
            )
            result = reconstruct(source, root / "scratch", prepared, [])
            self.assertEqual(
                "a1e9369a2816c5470bf782f7bf1a0091a258ca69ecc3ee62d4985fd6d9bf4873",
                document_digest(result.book),
            )
            self.assertEqual(
                "75e8fc09786506e6f6f01adaf1386cf3282641f5fb9937accd3b33828b52358c",
                hashlib.sha256(result.epub).hexdigest(),
            )
            _, segments, state = source_segments(source, root / "scratch", prepared, [])
            capture_list_bodies(segments, prepared, state)
            raw = result.book.model_dump()
            state.blocks = raw["blocks"]
            state.lists = raw["lists"]
            state.styles = {s["id"]: s for s in raw["styles"]}
            text_before = [b["content"] for b in state.blocks if b["kind"] == "list_item"]
            normalize_list_bodies(state)
            items = [b for b in state.blocks if b["kind"] == "list_item"]
            self.assertEqual(6, len(items))
            self.assertEqual(text_before, [b["content"] for b in items])
            for item in items:
                self.assertAlmostEqual(0, state.styles[item["style_id"]]["indent_em"], places=5)
                self.assertAlmostEqual(
                    0, state.styles[item["style_id"]]["block_indent_em"], places=5
                )
