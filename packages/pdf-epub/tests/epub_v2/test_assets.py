import hashlib
import io
import unittest

from PIL import Image

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.epub_v2.assets import validate_assets

from .helpers import FIXTURES, fixture


class AssetDecodeTests(unittest.TestCase):
    def test_verified_header_is_not_proof_of_decodable_image(self):
        book, _, _ = fixture()
        data = (FIXTURES / "truncated-image.jpg").read_bytes()
        with Image.open(io.BytesIO(data)) as image:
            width, height = image.size
            image.verify()  # This passed in the independently discovered failure.
        raw = book.model_dump()
        raw["resources"][0].update(
            path="images/fixture.jpg",
            media_type="image/jpeg",
            byte_length=len(data),
            sha256=hashlib.sha256(data).hexdigest(),
            width=width,
            height=height,
        )
        with self.assertRaises(OSError):
            validate_assets(CanonicalBookV2.model_validate(raw), {"image-one": data})
