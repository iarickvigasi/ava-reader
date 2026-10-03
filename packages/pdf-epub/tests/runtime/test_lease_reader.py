import json
import unittest
from unittest.mock import patch

from ava_pdf_epub.runtime.lease_reader import read_lease


class LeaseReaderTests(unittest.TestCase):
    def test_transient_missing_control_retains_deadline_then_allows_fresh_renewal(self):
        raw = json.dumps({"sequence": 2, "remaining_ms": 1000}).encode()
        with patch(
            "ava_pdf_epub.runtime.lease_reader.snapshot", side_effect=[FileNotFoundError(), raw]
        ):
            self.assertIsNone(read_lease(1, 5, 1, True, 4))
            self.assertEqual(read_lease(1, 5, 1, True, 4.5), (2, 5.25))

    def test_persistent_missing_control_expires_at_original_deadline(self):
        with patch("ava_pdf_epub.runtime.lease_reader.snapshot", side_effect=FileNotFoundError):
            self.assertIsNone(read_lease(1, 5, 1, True, 4.9))
            with self.assertRaises(ValueError):
                read_lease(1, 5, 1, True, 5)

    def test_missing_first_control_cannot_bypass_startup_deadline(self):
        with patch("ava_pdf_epub.runtime.lease_reader.snapshot", side_effect=FileNotFoundError):
            self.assertIsNone(read_lease(-1, 0, 1, False, 0.5))
            with self.assertRaises(ValueError):
                read_lease(-1, 0, 1, False, 1)

    def test_malformed_or_permission_error_is_never_retried(self):
        for error in [PermissionError(), OSError("unavailable")]:
            with patch("ava_pdf_epub.runtime.lease_reader.snapshot", side_effect=error):
                with self.assertRaises(OSError):
                    read_lease(1, 5, 1, True, 4)
        with patch("ava_pdf_epub.runtime.lease_reader.snapshot", return_value=b"{}"):
            with self.assertRaises(ValueError):
                read_lease(1, 5, 1, True, 4)
