"""Source-corroborated cadence never grants transcription or automatic join authority."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.continuation_metric_rows import cadence, metric_text_match
from ava_pdf_epub.reconstruction_v2.continuation_presentation import uniform_candidate
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan

from .continuation_metric_fixture import Fixture
from .test_continuation_presentation import fixture


class ContinuationMetricsTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

    def test_both_directions_only_metric_changes_and_receipt_preserves_original(self):
        for direction in (False, True):
            root = self.root / str(direction)
            root.mkdir()
            f = Fixture(root, ocr_first=direction)
            before = [document_digest(s) for s in f.segments]
            got = f.run()
            native = next(s for s in f.segments if s.method == "native")
            original = next(s for s in f.segments if s.method == "ocr")
            changed = next(s for s in got if s.method == "ocr")
            self.assertEqual(native.style.line_height, changed.style.line_height)
            self.assertEqual(
                original.model_dump(exclude={"style"}), changed.model_dump(exclude={"style"})
            )
            self.assertEqual(
                original.style.model_dump(exclude={"line_height"}),
                changed.style.model_dump(exclude={"line_height"}),
            )
            self.assertEqual(before, [document_digest(s) for s in f.segments])
            self.assertFalse(f.state.refined_joins)
            self.assertEqual(1, len(f.state.continuation_metric_proofs))
            checksum, proof = next(iter(f.state.continuation_metric_proofs.items()))
            raw = (root / "scratch/continuation-metrics" / (checksum + ".json")).read_bytes()
            self.assertEqual(checksum, hashlib.sha256(raw).hexdigest())
            self.assertEqual(1.25, proof.original_ocr_style.line_height)
            self.assertEqual(document_digest(original), proof.ocr_segment_sha256)
            self.assertEqual(proof.model_dump(mode="json"), json.loads(raw))
            self.assertTrue(proof.skipped_terminal_hyphens)
            self.assertIn(checksum, f.state.structure_findings[0].message)
            self.assertEqual(
                0o600,
                (root / "scratch/continuation-metrics" / (checksum + ".json")).stat().st_mode
                & 0o777,
            )

    def test_foreign_source_and_unknown_risks_decline(self):
        for mode in ("hash", "size", "risk", "rotation"):
            root = self.root / mode
            root.mkdir()
            f = Fixture(root)
            cp = f.prepared[1]
            if mode == "hash":
                cp = cp.model_copy(update={"source_sha256": "a" * 64})
            elif mode == "size":
                cp = cp.model_copy(update={"source_byte_length": 1})
            else:
                cp = cp.model_copy(
                    update={
                        "observation": cp.observation.model_copy(
                            update={"risks": ["unreliable_glyph_mapping"]}
                            if mode == "risk"
                            else {"rotation": 90}
                        )
                    }
                )
            f.prepared[1] = cp
            self.assertEqual(f.segments, f.run(), mode)
            self.assertFalse(f.state.continuation_metric_proofs)

    def test_different_actual_resource_or_transform_decline(self):
        for mode in ("font", "transform"):
            root = self.root / mode
            root.mkdir()
            f = Fixture(root, split_font=mode == "font", transform=mode == "transform")
            self.assertEqual(f.segments, f.run())
            self.assertFalse(f.state.continuation_metric_proofs)

    def test_missing_changed_or_competing_source_ink_declines(self):
        for mode in ("missing", "invisible", "duplicate", "foreign_owner"):
            root = self.root / mode
            root.mkdir()
            f = Fixture(root)
            cp = f.prepared[1]
            page = cp.observation
            row = page.lines[0]
            if mode == "foreign_owner":
                f.segments.append(f.segments[1].model_copy(update={"id": "other"}))
                f.state.placements["other"] = (2, 1, 1)
            else:
                if mode == "missing":
                    # Even a matching edited text/observation cannot conceal a glyph
                    # still present in the independently reopened original PDF.
                    glyphs = row.glyphs[1:]
                    f.segments[1] = f.segments[1].model_copy(
                        update={"text": f.segments[1].text[1:]}
                    )
                    row = row.model_copy(update={"text": row.text[1:], "glyphs": glyphs})
                elif mode == "invisible":
                    row = row.model_copy(
                        update={
                            "glyphs": [g.model_copy(update={"visible": False}) for g in row.glyphs]
                        }
                    )
                lines = [row] + page.lines[1:]
                if mode == "duplicate":
                    lines.append(row.model_copy(update={"id": "duplicate-row"}))
                f.prepared[1] = cp.model_copy(
                    update={"observation": page.model_copy(update={"lines": lines})}
                )
            self.assertEqual(f.segments, f.run(), mode)

    def test_mixed_spans_known_font_conflicts_and_legacy_are_unchanged(self):
        for mode in ("span", "bold", "legacy", "native_metric"):
            root = self.root / mode
            root.mkdir()
            f = Fixture(root)
            if mode == "legacy":
                f.state.source_continuation_policy = None
            elif mode == "span":
                f.segments[1] = f.segments[1].model_copy(
                    update={
                        "spans": [
                            ObservedSpan(start=0, end=1, style=Style(id="emphasis", italic=True))
                        ]
                    }
                )
            else:
                idx = 0 if mode == "native_metric" else 1
                s = f.segments[idx]
                f.segments[idx] = s.model_copy(
                    update={
                        "style": s.style.model_copy(
                            update={"line_height": 1.21}
                            if mode == "native_metric"
                            else {"bold": True}
                        )
                    }
                )
            self.assertEqual(f.segments, f.run(), mode)

    def test_uniform_redundant_spans_and_links_survive(self):
        f = Fixture(self.root)
        s = f.segments[0]
        f.segments[0] = s.model_copy(
            update={
                "spans": [
                    ObservedSpan(
                        start=0,
                        end=3,
                        style=Style(id="word", family="serif", bold=False),
                        url="https://example.com",
                    )
                ]
            }
        )
        self.assertNotEqual(f.segments, f.run())
        self.assertEqual(f.segments[0].spans, f.run()[0].spans)
        self.assertEqual(1, len(f.state.structure_findings))

    def test_no_rounding_no_automatic_task5_authority(self):
        # Existing Task5 cannot delegate an unproved known metric conflict.
        task, _ = fixture()
        left, right = task.nodes
        right = right.model_copy(
            update={"observed_style": right.observed_style.model_copy(update={"line_height": 1.25})}
        )
        self.assertIsNone(
            uniform_candidate(task.edges[0], left, right, left.id, native_alignment_fallback=True)
        )

    def test_every_raw_gap_is_checked_before_median(self):
        f = Fixture(self.root)
        rows = f.prepared[1].observation.lines
        self.assertIsNotNone(cadence(rows, 10.5))
        self.assertIsNone(cadence([rows[0], rows[2], rows[1]], 10.5))
        self.assertIsNone(cadence([rows[0], rows[0], rows[1]], 10.5))
        self.assertIsNone(cadence(rows, 0.01))
        self.assertIsNone(
            cadence(
                [
                    rows[0],
                    rows[1],
                    rows[2].model_copy(
                        update={
                            "glyphs": [
                                g.model_copy(
                                    update={
                                        "box": g.box.model_copy(
                                            update={"y0": g.box.y0 + 10, "y1": g.box.y1 + 10}
                                        )
                                    }
                                )
                                for g in rows[2].glyphs
                            ]
                        }
                    ),
                ],
                10.5,
            )
        )

    def test_only_literal_terminal_hyphen_can_be_absent(self):
        f = Fixture(self.root)
        rows = f.prepared[1].observation.lines
        self.assertIsNotNone(metric_text_match(f.segments[1].text, rows))
        self.assertIsNone(
            metric_text_match(f.segments[1].text.replace("retained", "changed"), rows)
        )
        self.assertIsNone(metric_text_match(f.segments[1].text[:-1], rows))

    def test_source_medians_must_agree_not_just_have_nearby_printed_cadence(self):
        f = Fixture(self.root, different_leading=True)
        self.assertEqual(f.segments, f.run())
        self.assertFalse(f.state.continuation_metric_proofs)

    def test_within_row_baseline_mix_declines_even_when_row_medians_match(self):
        f = Fixture(self.root)
        rows = list(f.prepared[1].observation.lines)
        row = rows[0]
        glyphs = list(row.glyphs)
        glyphs[0] = glyphs[0].model_copy(
            update={
                "box": glyphs[0].box.model_copy(
                    update={"y0": glyphs[0].box.y0 + 0.01, "y1": glyphs[0].box.y1 + 0.01}
                )
            }
        )
        rows[0] = row.model_copy(update={"glyphs": glyphs})
        self.assertIsNone(cadence(rows, 10.5))

    def test_coordinate_error_is_tiny_and_accounts_for_source_size_subtraction(self):
        f = Fixture(self.root)
        measured, gaps, error = cadence(f.prepared[1].observation.lines, 10.5)
        self.assertGreater(error, 0)
        self.assertLess(error, 1e-10)
        self.assertLess(abs(measured - 1.2095), error)
        self.assertGreater(abs(measured - 1.21), error)

    def test_only_explicit_metric_independent_risks_remain_allowed(self):
        for risk in (
            "language_uncertain",
            "native_spacing_unresolved",
            "native_spacing_unavailable",
        ):
            root = self.root / risk
            root.mkdir()
            f = Fixture(root)
            cp = f.prepared[1]
            f.prepared[1] = cp.model_copy(
                update={"observation": cp.observation.model_copy(update={"risks": [risk]})}
            )
            self.assertNotEqual(f.segments, f.run(), risk)
            self.assertEqual([risk], f.prepared[1].observation.risks)

    def test_private_receipt_corruption_cannot_be_accepted_on_reuse(self):
        f = Fixture(self.root)
        f.run()
        target = next((self.root / "scratch/continuation-metrics").glob("*.json"))
        target.write_bytes(b"damaged")
        with self.assertRaisesRegex(ValueError, "collision"):
            f.run()

    def test_unreproved_whitespace_cannot_change_the_source_cadence(self):
        f = Fixture(self.root, different_leading=True)
        self.assertEqual(f.segments, f.run())
        cp = f.prepared[1]
        rows = []
        from ava_pdf_epub.reconstruction_v2.line_spacing import baseline

        for i, row in enumerate(cp.observation.lines):
            level = baseline(cp.observation.lines[0]) + i * 10.5 * f.segments[0].style.line_height
            glyph = row.glyphs[0]
            fake = glyph.model_copy(
                update={
                    "text": " ",
                    "box": glyph.box.model_copy(update={"y0": level - 10.5, "y1": level}),
                }
            )
            rows.append(
                row.model_copy(
                    update={"text": " " * 100 + row.text, "glyphs": [fake] * 100 + row.glyphs}
                )
            )
        f.prepared[1] = cp.model_copy(
            update={"observation": cp.observation.model_copy(update={"lines": rows})}
        )
        self.assertEqual(f.segments, f.run())
        self.assertFalse(f.state.continuation_metric_proofs)

    def test_redundant_old_inline_leading_cannot_survive_as_a_new_base_conflict(self):
        f = Fixture(self.root)
        owner = f.segments[1]
        f.segments[1] = owner.model_copy(
            update={
                "spans": [
                    ObservedSpan(
                        start=0,
                        end=len(owner.text),
                        style=Style(id="old-leading", line_height=1.25),
                    )
                ]
            }
        )
        self.assertEqual(f.segments, f.run())
        self.assertFalse(f.state.continuation_metric_proofs)
