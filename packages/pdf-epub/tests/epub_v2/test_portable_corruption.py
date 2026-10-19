import hashlib
import io
import unittest
import zipfile

from PIL import Image

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.epub_v2.export import SIDECAR
from ava_pdf_epub.epub_v2.paths import asset_path
from ava_pdf_epub.epub_v2.portable import portable_epub

from .helpers import FIXTURES, archive_bytes, exported


class PortableCorruptionTests(unittest.TestCase):
    def test_corrupt_zip_crc_is_content_refusal_not_infrastructure_retry(self):
        _, _, entries, _ = exported()
        data = bytearray(archive_bytes(entries))
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            info = archive.getinfo("mimetype")
            offset = info.header_offset + 30 + len(info.filename.encode()) + len(info.extra)
        data[offset] ^= 1
        with self.assertRaisesRegex(ValueError, "Malformed generated EPUB bytes"):
            portable_epub(bytes(data))

    def test_matching_hash_but_undecodable_image_is_content_refusal(self):
        book, _, entries, _ = exported()
        data = (FIXTURES / "truncated-image.jpg").read_bytes()
        with Image.open(io.BytesIO(data)) as image:
            width, height = image.size
        old = book.resources[0]
        raw = book.model_dump()
        raw["resources"][0].update(
            path="images/fixture.jpg",
            media_type="image/jpeg",
            byte_length=len(data),
            sha256=hashlib.sha256(data).hexdigest(),
            width=width,
            height=height,
        )
        changed = CanonicalBookV2.model_validate(raw)
        del entries["EPUB/" + asset_path(old)]
        entries["EPUB/" + asset_path(changed.resources[0])] = data
        entries[SIDECAR] = changed.model_dump_json().encode()
        with self.assertRaisesRegex(ValueError, "Malformed generated EPUB bytes"):
            portable_epub(archive_bytes(entries))
