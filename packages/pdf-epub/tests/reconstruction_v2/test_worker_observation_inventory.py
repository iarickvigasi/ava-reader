"""Actual language/geometry/classification observations stay separate from frozen job policy."""

import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.worker_observation_inventory import Inventory

from .test_ocr_font_faces import checkpoint
from .test_pdf_links import observation
from .test_worker_observation import emitted
from .worker_observation_fixture import observation_context

SOURCE = Path(__file__).parent / "fixtures" / "native.pdf"


class WorkerInventoryTests(unittest.TestCase):
    def test_real_preparation_reports_one_observed_page_without_claiming_full_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = SOURCE.read_bytes()
            collector = observation_context(root, source)
            try:
                collector.record("source_bytes", source)
                prepared = prepare_page(SOURCE, root, 1)
                packet = collector.inventory.packet()
                self.assertEqual(hashlib.sha256(source).hexdigest(), prepared.source_sha256)
                self.assertTrue(packet["source_bytes_verified"])
                self.assertEqual(prepared.profile_id, packet["observed_profile_id"])
                self.assertEqual("partial", packet["coverage"])
                self.assertEqual((1, 1), (packet["observed_pages"], packet["prepared_pages"]))
                self.assertEqual(1, sum(packet["language_pages"].values()))
                self.assertEqual(1, sum(packet["layout_pages"].values()))
                self.assertEqual(1, sum(packet["route_pages"].values()))
                self.assertEqual(1, packet["language_pages"]["en"])
                self.assertEqual("bounded_native_page_script_and_hint_heuristic",
                                 packet["language_method"])
                self.assertEqual(65536, packet["language_character_limit"])
                self.assertEqual("qualified_native_reading_order_or_review", packet["layout_method"])
                self.assertEqual("original_top_level_objects_classified", packet["annotation_scope"])
            finally:
                emitted(collector)

    def test_repeated_page_work_does_not_multiply_inventory_and_unknown_text_stays_unknown(self):
        inventory = Inventory()
        inventory.source(2, 1, "ava-pdf-prose-en-v2")
        page = checkpoint(observation())
        for _ in range(2):
            inventory.annotation(1, ["link", "personal", "visible"])
            inventory.page(page)
            inventory.layout(1, "two_column")
        inventory.source(2, 2, "ava-pdf-prose-en-v2")
        packet = inventory.packet()
        self.assertEqual((2, 1, "partial"),
                         (packet["observed_pages"], packet["prepared_pages"], packet["coverage"]))
        self.assertEqual(dict(en=0, uk=0, unknown=1), packet["language_pages"])
        self.assertEqual(1, packet["layout_pages"]["two_column"])
        self.assertEqual(dict(native=0, recognition=0, hybrid=0, blank=1, unknown=0), packet["route_pages"])
        self.assertEqual(dict(link=1, personal=1, empty=0, visible=1), packet["annotation_counts"])

    def test_unknown_risk_and_private_text_font_paths_are_not_projected(self):
        inventory = Inventory()
        source = observation()
        line = source.lines[0].model_copy(update={"text": "private source text"})
        for number in range(1, 12):
            inventory.source(11, number, "ava-pdf-prose-en-v2")
            page = source.model_copy(update=dict(number=number, lines=[line],
                                                risks=["language_uncertain", "private risk"],
                                                render_path="/private/source.png"))
            inventory.page(checkpoint(page))
        packet = inventory.packet()
        self.assertEqual([dict(code="language_uncertain", pages=11)], packet["flags"])
        self.assertEqual(8, len(packet["locations"]))
        self.assertFalse(packet["locations_complete"])
        self.assertNotIn("private", str(packet))

    def test_large_native_text_stays_unknown_without_allocating_language_analysis(self):
        inventory = Inventory()
        source = observation()
        line = source.lines[0].model_copy(update={"text": "a" * 65537})
        page = source.model_copy(update={"lines": [line]})
        with patch("ava_pdf_epub.reconstruction_v2.book_language.observed_language",
                   side_effect=AssertionError("analysis must stay bounded")):
            inventory.page(checkpoint(page))
        self.assertEqual(dict(en=0, uk=0, unknown=1), inventory.packet()["language_pages"])
