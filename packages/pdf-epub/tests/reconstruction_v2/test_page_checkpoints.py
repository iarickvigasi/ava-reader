import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.reconstruction_v2.page_checkpoints import PageCheckpoints, PreparedPageMap
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct

from .test_ocr_font_faces import checkpoint
from .test_pdf_links import observation

SOURCE = Path(__file__).parent / "fixtures" / "uk-native.pdf"


class PageCheckpointTests(unittest.TestCase):
    def test_reconstruction_matches_in_memory_and_rejects_changed_cached_page(self):
        with tempfile.TemporaryDirectory() as directory:
            scratch = Path(directory)
            digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
            stored = prepare_source(SOURCE, scratch, digest, BILINGUAL_PROFILE)
            memory = list(stored)
            self.assertEqual(3, len(stored))
            self.assertEqual(memory[-1], stored[-1])
            self.assertEqual(memory[1], PreparedPageMap(stored)[2])
            self.assertEqual(
                reconstruct(SOURCE, scratch, memory, []),
                reconstruct(SOURCE, scratch, stored, []),
            )
            stored[0]  # Populate the bounded cache before tampering.
            checkpoint = stored.root / "page-0001.json"
            checkpoint.write_bytes(
                checkpoint.read_bytes().replace("Розділ".encode(), "Змінено".encode())
            )
            with self.assertRaisesRegex(ValueError, "identity changed"):
                stored[0]
            with self.assertRaises(IndexError):
                stored[3]
            with self.assertRaises(KeyError):
                PreparedPageMap(stored)[0]


class PageCacheTests(unittest.TestCase):
    def stored(self, scratch):
        stored = PageCheckpoints(scratch)
        for number in (1, 2, 3):
            page = observation().model_copy(update={"number": number})
            stored.append(checkpoint(page).model_copy(update={"source_page_count": 3}))
        return stored

    def test_first_and_current_page_reuse_still_detects_tampering(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stored = self.stored(root)
            first, second = stored[0], stored[1]
            self.assertIs(first, stored[0])
            self.assertIs(second, stored[1])
            file = root / "page-0001.json"
            file.write_bytes(
                file.read_bytes().replace(b'"source_byte_length":100', b'"source_byte_length":101')
            )
            with self.assertRaisesRegex(ValueError, "identity changed"):
                stored[0]

    def test_byte_budget_evicts_even_when_two_entries_would_fit_count(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stored = self.stored(root)
            size = (root / "page-0001.json").stat().st_size
            with patch("ava_pdf_epub.reconstruction_v2.page_checkpoints.PAGE_BYTES", size + 10):
                first = stored[0]
                stored[1]
                self.assertIsNot(first, stored[0])

    def test_third_page_evicts_least_recently_read_observation(self):
        with tempfile.TemporaryDirectory() as directory:
            stored = self.stored(Path(directory))
            first, second = stored[0], stored[1]
            self.assertIs(first, stored[0])
            stored[2]
            self.assertIs(first, stored[0])
            self.assertIsNot(second, stored[1])


class PageGeometryTests(unittest.TestCase):
    def test_geometry_matches_full_observation_without_decoding_text_receipts(self):
        with tempfile.TemporaryDirectory() as directory:
            stored = PageCacheTests().stored(Path(directory))
            with patch.object(
                type(checkpoint(observation())),
                "model_validate_json",
                side_effect=AssertionError("full decode"),
            ):
                geometry = stored.geometry(1)
            self.assertEqual(
                (2, 100, 100, 0),
                (geometry.number, geometry.width_pt, geometry.height_pt, geometry.rotation),
            )
            self.assertEqual(geometry.width_pt, stored[1].observation.width_pt)

    def test_geometry_rejects_tampered_checkpoint_and_bounds(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stored = PageCacheTests().stored(root)
            stored.geometry(0)
            file = root / "page-0001.json"
            file.write_bytes(file.read_bytes().replace(b'"width_pt":100.0', b'"width_pt":101.0'))
            with self.assertRaisesRegex(ValueError, "identity changed"):
                stored.geometry(0)
            with self.assertRaises(IndexError):
                stored.geometry(3)
