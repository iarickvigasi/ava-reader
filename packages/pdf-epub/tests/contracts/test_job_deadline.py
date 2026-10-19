"""A whole book has a finite shared deadline; existing shorter jobs stay valid."""

import json
import unittest
from pathlib import Path

from ava_pdf_epub.contracts.job import JobInputV1


class JobDeadline(unittest.TestCase):
    def test_complete_book_bound_and_legacy_shorter_job(self):
        fixture = json.loads((Path(__file__).parent / "fixtures/ava-pdf-job-1.json").read_text())
        for seconds in (1800, 7200):
            self.assertEqual(
                seconds,
                JobInputV1.model_validate(
                    {
                        **fixture,
                        "active_deadline_seconds": seconds,
                    }
                ).active_deadline_seconds,
            )
        for seconds in (0, 7201):
            with self.assertRaises(ValueError):
                JobInputV1.model_validate({**fixture, "active_deadline_seconds": seconds})
