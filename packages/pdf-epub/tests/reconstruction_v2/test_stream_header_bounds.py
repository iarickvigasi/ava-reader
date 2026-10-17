"""Large valid reports use the host header bound without expanding body records."""

import base64
import hashlib
import json
import unittest

from ava_pdf_epub.epub_v2.export import export_epub
from ava_pdf_epub.reconstruction_v2.findings import Finding
from ava_pdf_epub.reconstruction_v2.reconstruct import ReconstructedBook
from ava_pdf_epub.reconstruction_v2.report import reconstruction_report
from ava_pdf_epub.reconstruction_v2.stream_output import _line, stream_artifacts
from tests.epub_v2.helpers import fixture


def candidate(count):
    book, assets, _ = fixture()
    findings = [Finding(code="source_observation", message="é" * 1000, severity="information")]
    result = ReconstructedBook(book, export_epub(book, assets), assets, findings * count, [])
    return result, reconstruction_report(result, 0)


class StreamHeaderBounds(unittest.TestCase):
    def test_valid_large_unicode_report_keeps_exact_header_and_artifact_bytes(self):
        result, report = candidate(300)
        lines = list(stream_artifacts(result, report))
        self.assertGreater(len(lines[0]), 400 * 1024)
        self.assertLessEqual(len(lines[0]), 4 * 1024**2)
        self.assertTrue(all(len(line) <= 400 * 1024 for line in lines[1:]))
        records = [json.loads(line) for line in lines]
        header = records[0]
        self.assertEqual(report.model_dump(mode="json"), header["report"])
        output = {item["path"]: bytearray() for item in header["artifacts"]}
        for chunk in records[1:-1]:
            self.assertEqual(len(output[chunk["path"]]), chunk["offset"])
            output[chunk["path"]].extend(base64.b64decode(chunk["base64"], validate=True))
        for item in header["artifacts"]:
            data = output[item["path"]]
            self.assertEqual(item["byte_length"], len(data))
            self.assertEqual(item["sha256"], hashlib.sha256(data).hexdigest())
        self.assertEqual(result.book.model_dump_json().encode(), output["canonical.json"])
        self.assertEqual(result.epub, output["book.epub"])
        self.assertEqual(report.model_dump_json().encode(), output["reconstruction-report.json"])
        self.assertEqual({"complete": True}, records[-1])

    def test_valid_report_exceeding_whole_header_limit_is_refused(self):
        result, report = candidate(2300)
        with self.assertRaisesRegex(ValueError, "Stream record byte bound exceeded"):
            next(stream_artifacts(result, report))

    def test_header_and_body_exact_byte_boundaries_include_newline(self):
        for limit in (400 * 1024, 4 * 1024**2):
            with self.subTest(limit=limit):
                overhead = len(_line({"payload": ""}))
                value = {"payload": "x" * (limit - overhead)}
                if limit == 400 * 1024:
                    self.assertEqual(limit, len(_line(value)))
                    with self.assertRaisesRegex(ValueError, "byte bound exceeded"):
                        _line({"payload": value["payload"] + "x"})
                else:
                    self.assertEqual(limit, len(_line(value, max_bytes=limit)))
                    with self.assertRaisesRegex(ValueError, "byte bound exceeded"):
                        _line({"payload": value["payload"] + "x"}, max_bytes=limit)
