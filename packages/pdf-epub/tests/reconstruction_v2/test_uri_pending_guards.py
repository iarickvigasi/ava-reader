"""Pending source authority is one-use and cannot repair unrelated or conflicting marks."""

import tempfile
import unittest
from pathlib import Path

from ava_pdf_epub.pdf_navigation import NavigationTarget, pdf_navigation
from ava_pdf_epub.reconstruction_v2.pdf_link_marks import apply_link_marks
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan
from ava_pdf_epub.reconstruction_v2.source_uri_caller import source_uri_caller

from .uri_caller_fixture import fixture


class UriPendingGuardTests(unittest.TestCase):
    def test_changed_range_target_owner_peer_or_checkpoint_consumes_and_refuses(self):
        for change in ["range", "target", "owner", "peer", "checkpoint"]:
            with self.subTest(change=change), tempfile.TemporaryDirectory() as d:
                f = fixture(Path(d))
                self.addCleanup(f.reader.close)
                a, b = f.annotation(0)
                target = pdf_navigation(f.reader, a)
                ranges = source_uri_caller(f.reader, target, a, b, f.context, f.state)
                self.assertIsNotNone(ranges)
                result = list(f.owners)
                prepared = [f.checkpoint]
                if change == "range":
                    ranges = [("visual", ranges[0][1] + 1, ranges[0][2])]
                if change == "target":
                    target = NavigationTarget(url="https://other.test")
                if change == "owner":
                    result = [result[0].model_copy(update={"text": result[0].text + "x"})]
                if change == "peer":
                    result.append(result[0].model_copy(update={"id": "foreign"}))
                if change == "checkpoint":
                    prepared = [f.checkpoint.model_copy(update={"source_sha256": "b" * 64})]
                before = [s.model_dump_json() for s in result]
                with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                    apply_link_marks(
                        ranges,
                        target,
                        result,
                        {s.id: i for i, s in enumerate(result)},
                        f.reader,
                        prepared,
                        f.state,
                    )
                self.assertIsNone(f.state.pending_uri_link)
                self.assertEqual(before, [s.model_dump_json() for s in result])

    def test_partial_extended_multiple_conflicting_or_note_overlap_is_not_silently_repaired(self):
        for change in ["partial", "extended", "multiple", "conflict", "note"]:
            with self.subTest(change=change), tempfile.TemporaryDirectory() as d:
                f = fixture(Path(d))
                self.addCleanup(f.reader.close)
                old = f.owners[0].spans[0]
                spans = [old]
                if change == "partial":
                    spans = [old.model_copy(update={"start": old.start + 1})]
                if change == "extended":
                    spans = [old.model_copy(update={"end": old.end + 1})]
                if change == "multiple":
                    spans = [old, old.model_copy()]
                if change == "conflict":
                    spans = [old.model_copy(update={"url": "https://other.test"})]
                if change == "note":
                    spans = [old, ObservedSpan(start=old.start, end=old.end, note_label="1")]
                result = [f.owners[0].model_copy(update={"spans": spans})]
                a, b = f.annotation(0)
                target = pdf_navigation(f.reader, a)
                ranges = source_uri_caller(f.reader, target, a, b, f.context, f.state)
                with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                    apply_link_marks(
                        ranges, target, result, {"visual": 0}, f.reader, [f.checkpoint], f.state
                    )
                self.assertIsNone(f.state.pending_uri_link)

    def test_observation_release_discards_pending_authority(self):
        with tempfile.TemporaryDirectory() as d:
            f = fixture(Path(d))
            self.addCleanup(f.reader.close)
            a, b = f.annotation(0)
            self.assertIsNotNone(
                source_uri_caller(f.reader, pdf_navigation(f.reader, a), a, b, f.context, f.state)
            )
            f.state.release_observations()
            self.assertIsNone(f.state.pending_uri_link)
