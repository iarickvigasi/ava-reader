"""Verify contiguous artifact bytes and distinguish logical from raw hashes."""

import base64
import hashlib
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.contracts.common import document_digest
from ava_pdf_epub.reconstruction_v2.protocol import ReconstructionInput
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source
from ava_pdf_epub.reconstruction_v2.stream_output import stream_artifacts


class StreamTests(unittest.TestCase):
    def test_native_candidate_survives_chunked_transfer_without_truncation(self):
        source = Path(__file__).parent / "fixtures/native.pdf"
        request = ReconstructionInput(
            schema_version="ava-reconstruct-input-1",
            source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
            responses=[],
        )
        with tempfile.TemporaryDirectory() as directory:
            result, report = reconstruct_source(source, Path(directory), request)
        with patch("ava_pdf_epub.reconstruction_v2.stream_output.CHUNK_BYTES", 113):
            records = [json.loads(line) for line in stream_artifacts(result, report)]
        self.assertEqual({"complete": True}, records[-1])
        header = records[0]
        self.assertEqual("ava-reconstruct-stream-1", header["schema_version"])
        output = {item["path"]: bytearray() for item in header["artifacts"]}
        for record in records[1:-1]:
            data = base64.b64decode(record["base64"], validate=True)
            self.assertLessEqual(len(data), 113)
            self.assertEqual(len(output[record["path"]]), record["offset"])
            output[record["path"]].extend(data)
        for descriptor in header["artifacts"]:
            data = bytes(output[descriptor["path"]])
            self.assertEqual(len(data), descriptor["byte_length"])
            self.assertEqual(hashlib.sha256(data).hexdigest(), descriptor["sha256"])
        self.assertEqual(result.epub, output["book.epub"])
        with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
            css = b"".join(
                archive.read(name) for name in archive.namelist() if name.endswith(".css")
            )
            for declaration in [
                b"max-height:75vh",
                b"width:auto",
                b"height:auto",
                b"object-fit:contain",
            ]:
                self.assertIn(declaration, css)
            image_bytes = [
                archive.read(name)
                for name in archive.namelist()
                if name.endswith((".png", ".jpg", ".jpeg"))
            ]
            for resource in result.book.resources:
                self.assertIn(result.assets[resource.id], image_bytes)

        self.assertEqual(result.book.model_dump_json().encode(), output["canonical.json"])
        self.assertEqual(document_digest(result.book), header["report"]["canonical_sha256"])
        self.assertNotEqual(
            document_digest(result.book), hashlib.sha256(output["canonical.json"]).hexdigest()
        )
        with patch("ava_pdf_epub.reconstruction_v2.stream_output.MAX_TOTAL", 1):
            with self.assertRaisesRegex(ValueError, "byte bounds"):
                next(stream_artifacts(result, report))


if __name__ == "__main__":
    unittest.main()
