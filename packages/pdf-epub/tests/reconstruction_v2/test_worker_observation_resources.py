"""Resource units and bounded scratch scans use actual files and explicit incomplete results."""

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from ava_pdf_epub.worker_observation_resources import resources, scratch_bytes

MODULE = "ava_pdf_epub.worker_observation_resources"


def usage(user, system, rss=17):
    return SimpleNamespace(ru_utime=user, ru_stime=system, ru_maxrss=rss)


class WorkerResourceTests(unittest.TestCase):
    def test_current_logical_size_and_child_cpu_are_distinct_from_process_rss(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "nested").mkdir()
            (root / "one").write_bytes(b"a" * 7)
            (root / "nested" / "two").write_bytes(b"b" * 11)
            before, after = (usage(1, 2), usage(4, 5)), (usage(1.1, 2.2), usage(4.4, 5.6))
            for platform, multiplier in (("linux", 1024), ("darwin", 1)):
                with patch(f"{MODULE}.usage", return_value=after), patch(f"{MODULE}.sys.platform", platform):
                    result = resources(before, root)
                self.assertEqual((300, 1000, 17 * multiplier, 18),
                                 (result["cpu_self_ms"], result["cpu_finished_children_ms"],
                                  result["peak_rss_bytes"], result["scratch_current_bytes"]))
                self.assertEqual("worker_process", result["peak_rss_scope"])
                self.assertEqual("rusage_delta_self_and_reaped_children", result["cpu_method"])
                self.assertEqual("rusage_lifetime_max_not_delta", result["peak_rss_method"])
                self.assertEqual("logical_regular_file_sizes_at_command_end",
                                 result["scratch_bytes_method"])

    def test_symlink_cannot_count_or_traverse_external_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scratch = root / "scratch"
            scratch.mkdir()
            external = root / "private"
            external.write_bytes(b"private document")
            (scratch / "linked").symlink_to(external)
            self.assertEqual((None, "unsafe_entry"), scratch_bytes(scratch))
            self.assertEqual((None, "unavailable"), scratch_bytes(scratch / "linked"))

    def test_scan_limits_discard_partial_byte_totals(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ("one", "two"):
                (root / name).write_bytes(b"bytes")
            with patch(f"{MODULE}.SCAN_ENTRIES", 1):
                self.assertEqual((None, "entry_limit"), scratch_bytes(root))
            with patch(f"{MODULE}.time.monotonic", side_effect=[0, 1]):
                self.assertEqual((None, "time_limit"), scratch_bytes(root))

    def test_missing_usage_and_unknown_platform_never_claim_resource_zero(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch(f"{MODULE}.usage", return_value=None), patch(f"{MODULE}.sys.platform", "other"):
                result = resources(None, Path(directory))
            self.assertIsNone(result["cpu_self_ms"])
            self.assertIsNone(result["cpu_finished_children_ms"])
            self.assertIsNone(result["peak_rss_bytes"])
            self.assertEqual("unknown", result["peak_rss_platform"])
