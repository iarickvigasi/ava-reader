"""Paid boundary tests use only fake transports; never read credentials or access network."""

from __future__ import annotations

import base64
import copy
import io
import json
import tempfile
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path
from typing import Any
from unittest.mock import patch

from PIL import Image

from ava_pdf_epub.recognition import (
    OpenRouterProvider,
    ProviderResponse,
    RawResponse,
    RecognitionConfig,
    RecognitionOutputError,
    RecognitionPendingError,
    RecognitionUncertainError,
    recognize_page,
)
from ava_pdf_epub.state import BudgetError, BudgetOverrunError, BudgetStore

SOURCE = "a" * 64
PAGE = {
    "is_blank": False,
    "page_label": "7",
    "warnings": [],
    "blocks": [
        {
            "kind": "paragraph",
            "text": "Exact source text.",
            "bbox": [0.1, 0.2, 0.9, 0.8],
            "style": {
                "bold": False,
                "italic": False,
                "small_caps": False,
                "align": "start",
                "size": 1.0,
            },
            "spans": [{"start": 0, "end": 5, "kind": "em"}],
            "level": 1,
            "label": None,
            "continues_from_previous": False,
            "continues_to_next": False,
        }
    ],
}


class FakeProvider:
    request_version = "fake-request-1"

    def __init__(self) -> None:
        self.config = RecognitionConfig("example/exact-model", "example-route", "quote-2026", 20)
        self.calls = 0
        self.page = copy.deepcopy(PAGE)
        self.usage: Any = {"cost": 0.000010}
        self.model: str = self.config.model_id
        self.finish = "stop"
        self.content: str | None = None
        self.error: BaseException | None = None
        self.entered: threading.Event | None = None
        self.release: threading.Event | None = None

    def request(self, image: bytes, mime_type: str, schema: dict[str, Any]) -> RawResponse:
        self.calls += 1
        if self.entered:
            self.entered.set()
        if self.release:
            self.release.wait(5)
        if self.error:
            raise self.error
        return RawResponse(
            200,
            json.dumps(
                {
                    "id": "generation-123",
                    "model": self.model,
                    "usage": self.usage,
                    "choices": [
                        {
                            "finish_reason": self.finish,
                            "message": {
                                "content": self.content
                                if self.content is not None
                                else json.dumps(self.page),
                            },
                        }
                    ],
                }
            ).encode(),
        )

    def decode_response(self, raw: RawResponse) -> ProviderResponse:
        return OpenRouterProvider(self.config, "fake-never-used").decode_response(raw)


class RecognitionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.render = self.root / "page.png"
        Image.new("RGB", (100, 160), "white").save(self.render)
        self.cache = self.root / "cache"
        self.store = BudgetStore(self.root / "ledger.sqlite3")
        self.provider = FakeProvider()
        self.store.configure(self.provider.config.model_id, 100)

    def recognize(self) -> Any:
        return recognize_page(
            SOURCE,
            1,
            self.render,
            600.0,
            960.0,
            self.provider,
            self.store,
            self.cache,
        )

    def test_billed_once_and_raw_cache_revalidates_typed_page(self) -> None:
        first = self.recognize()
        second = self.recognize()
        self.assertEqual(first, second)
        self.assertEqual(first.blocks[0].text, "Exact source text.")
        self.assertEqual(first.blocks[0].evidence[0].bbox, (60.0, 192.0, 540.0, 768.0))
        self.assertEqual(first.blocks[0].evidence[0].page, 1)
        self.assertEqual(first.blocks[0].spans[0].kind, "em")
        self.assertEqual(self.provider.calls, 1)
        self.assertEqual(self.store.snapshot(self.provider.config.model_id).known_microusd, 10)
        cached = json.loads(next(self.cache.glob("*.json")).read_bytes())
        raw = base64.b64decode(cached["raw_base64"])
        self.assertIn(b"generation-123", raw)
        self.assertNotIn(b"fake-never-used", next(self.cache.glob("*.json")).read_bytes())

    def test_timeout_keeps_bound_and_never_retries(self) -> None:
        self.provider.error = TimeoutError("timed out")
        with self.assertRaises(RecognitionUncertainError) as caught:
            self.recognize()
        self.assertIsNotNone(caught.exception.request_key)
        self.assertEqual(self.store.snapshot(self.provider.config.model_id).unknown_microusd, 20)
        with self.assertRaises(RecognitionPendingError):
            self.recognize()
        self.assertEqual(self.provider.calls, 1)

    def test_missing_billing_retains_raw_and_requires_explicit_reconciliation(self) -> None:
        self.provider.usage = None
        with self.assertRaises(RecognitionUncertainError) as caught:
            self.recognize()
        key = caught.exception.request_key
        assert key is not None
        self.assertEqual(len(list(self.cache.glob("*.json"))), 1)
        with self.assertRaises(RecognitionPendingError):
            self.recognize()
        self.store.reconcile(self.provider.config.model_id, key, 12)
        self.assertEqual(self.recognize().blocks[0].text, "Exact source text.")
        self.assertEqual(self.provider.calls, 1)
        self.assertEqual(self.store.snapshot(self.provider.config.model_id).known_microusd, 12)

    def test_malformed_output_still_settles_actual_charge(self) -> None:
        self.provider.content = "not JSON"
        with self.assertRaises(RecognitionOutputError):
            self.recognize()
        snapshot = self.store.snapshot(self.provider.config.model_id)
        self.assertEqual((snapshot.known_microusd, snapshot.unknown_microusd), (10, 0))
        with self.assertRaises(RecognitionOutputError):
            self.recognize()
        self.assertEqual(self.provider.calls, 1)

    def test_invalid_spans_are_billed_failures(self) -> None:
        self.provider.page["blocks"][0]["spans"][0]["end"] = 999
        with self.assertRaises(RecognitionOutputError):
            self.recognize()
        self.assertEqual(self.store.snapshot(self.provider.config.model_id).known_microusd, 10)

    def test_truncated_response_is_billed_but_not_accepted(self) -> None:
        self.provider.finish = "length"
        with self.assertRaises(RecognitionOutputError):
            self.recognize()
        self.assertEqual(self.store.snapshot(self.provider.config.model_id).known_microusd, 10)
        self.assertEqual(self.provider.calls, 1)

    def test_render_size_and_pixel_bounds_precede_spending(self) -> None:
        original = self.provider.config
        self.provider.config = replace(original, max_input_bytes=10)
        with self.assertRaises(ValueError):
            self.recognize()
        self.provider.config = replace(original, max_render_pixels=10)
        with self.assertRaises(ValueError):
            self.recognize()
        self.assertEqual(self.provider.calls, 0)
        self.assertEqual(self.store.snapshot(original.model_id).exposure_microusd, 0)

    def test_duplicate_model_json_keys_are_billed_but_rejected(self) -> None:
        self.provider.content = json.dumps(PAGE).replace(
            '"text": "Exact source text."',
            '"text": "ambiguous", "text": "Exact source text."',
        )
        with self.assertRaises(RecognitionOutputError):
            self.recognize()
        self.assertEqual(self.store.snapshot(self.provider.config.model_id).known_microusd, 10)

    def test_duplicate_billing_keys_never_undersettle(self) -> None:
        bodies = (
            b'{"usage":{"cost":1,"cost":0}}',
            b'{"usage":{"cost":1},"usage":{"cost":0}}',
        )
        for number, body in enumerate(bodies, 1):
            with patch.object(self.provider, "request", return_value=RawResponse(200, body)):
                with self.assertRaises(RecognitionUncertainError):
                    recognize_page(
                        SOURCE,
                        number,
                        self.render,
                        600.0,
                        960.0,
                        self.provider,
                        self.store,
                        self.cache,
                    )
        snapshot = self.store.snapshot(self.provider.config.model_id)
        self.assertEqual((snapshot.known_microusd, snapshot.unknown_microusd), (0, 40))

    def test_truncated_jpeg_never_dispatches(self) -> None:
        Image.new("RGB", (100, 160), "white").save(self.render, format="JPEG")
        self.render.write_bytes(self.render.read_bytes()[:-10])
        with self.assertRaises(OSError):
            self.recognize()
        self.assertEqual(self.provider.calls, 0)
        self.assertEqual(self.store.snapshot(self.provider.config.model_id).exposure_microusd, 0)

    def test_request_version_changes_cache_identity(self) -> None:
        self.recognize()
        self.provider.request_version = "fake-request-2"
        self.recognize()
        self.assertEqual(self.provider.calls, 2)

    def test_absolute_deadline_preserves_unknown_even_after_late_transport(self) -> None:
        config = replace(self.provider.config, timeout_seconds=0.05)
        provider = OpenRouterProvider(config, "placeholder")
        release = threading.Event()
        late_finished = threading.Event()

        class Opener:
            def open(self, request: Any, timeout: float) -> HttpResponse:
                release.wait(2)
                late_finished.set()
                return HttpResponse(b'{"usage":{"cost":0.00001}}')

        with patch("urllib.request.build_opener", return_value=Opener()):
            started = time.monotonic()
            try:
                with self.assertRaises(RecognitionUncertainError):
                    recognize_page(
                        SOURCE, 1, self.render, 600.0, 960.0, provider, self.store, self.cache
                    )
                self.assertLess(time.monotonic() - started, 0.3)
            finally:
                release.set()
            self.assertTrue(late_finished.wait(1))
        self.assertEqual(self.store.snapshot(config.model_id).unknown_microusd, 20)
        self.assertEqual(list(self.cache.glob("*.json")), [])

    def test_changed_cache_cannot_be_used_or_redispatched(self) -> None:
        self.recognize()
        path = next(self.cache.glob("*.json"))
        record = json.loads(path.read_bytes())
        record["raw_base64"] = base64.b64encode(b"tampered").decode()
        path.write_text(json.dumps(record))
        with self.assertRaises(RecognitionPendingError):
            self.recognize()
        self.assertEqual(self.provider.calls, 1)

    def test_cache_without_matching_ledger_does_not_trigger_paid_request(self) -> None:
        self.recognize()
        self.store = BudgetStore(self.root / "new-empty-ledger.sqlite3")
        self.store.configure(self.provider.config.model_id, 100)
        with self.assertRaises(RecognitionPendingError):
            self.recognize()
        self.assertEqual(self.provider.calls, 1)
        self.assertEqual(self.store.snapshot(self.provider.config.model_id).unknown_microusd, 20)

    def test_simultaneous_identical_page_dispatches_once(self) -> None:
        self.provider.entered = threading.Event()
        self.provider.release = threading.Event()
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(self.recognize)
            self.assertTrue(self.provider.entered.wait(5))
            with self.assertRaises(RecognitionPendingError):
                self.recognize()
            self.provider.release.set()
            self.assertEqual(first.result().number, 1)
        self.assertEqual(self.provider.calls, 1)
        self.assertEqual(self.store.snapshot(self.provider.config.model_id).known_microusd, 10)

    def test_durable_raw_precedes_billing_and_restart_requires_reconciliation(self) -> None:
        with patch.object(
            self.store, "settle", side_effect=RuntimeError("crash before settlement")
        ):
            with self.assertRaises(RuntimeError):
                self.recognize()
        self.assertEqual(len(list(self.cache.glob("*.json"))), 1)
        with self.assertRaises(RecognitionPendingError):
            self.recognize()
        record = json.loads(next(self.cache.glob("*.json")).read_bytes())
        self.store.settle(self.provider.config.model_id, record["request_key"], 10)
        self.assertEqual(self.recognize().number, 1)
        self.assertEqual(self.provider.calls, 1)

    def test_persistence_failure_retains_unknown_charge(self) -> None:
        with patch("ava_pdf_epub.recognition._save_response", side_effect=OSError("disk full")):
            with self.assertRaises(RecognitionUncertainError):
                self.recognize()
        self.assertEqual(self.store.snapshot(self.provider.config.model_id).unknown_microusd, 20)
        with self.assertRaises(RecognitionPendingError):
            self.recognize()
        self.assertEqual(self.provider.calls, 1)

    def test_overrun_records_charge_and_halts_model(self) -> None:
        self.provider.usage = {"cost": 0.000021}
        with self.assertRaises(BudgetOverrunError):
            self.recognize()
        snapshot = self.store.snapshot(self.provider.config.model_id)
        self.assertEqual(snapshot.known_microusd, 21)
        self.assertIsNotNone(snapshot.blocked_reason)
        with self.assertRaises(BudgetError):
            recognize_page(
                SOURCE, 2, self.render, 600.0, 960.0, self.provider, self.store, self.cache
            )
        self.assertEqual(self.provider.calls, 1)

    def test_wrong_model_settles_cost_but_rejects_output(self) -> None:
        self.provider.model = "unexpected/model"
        with self.assertRaises(RecognitionOutputError):
            self.recognize()
        self.assertEqual(self.store.snapshot(self.provider.config.model_id).known_microusd, 10)

    def test_no_budget_and_invalid_image_never_dispatch(self) -> None:
        self.store = BudgetStore(self.root / "unconfigured.sqlite3")
        with self.assertRaises(BudgetError):
            self.recognize()
        self.render.write_bytes(b"not an image")
        with self.assertRaises(OSError):
            self.recognize()
        self.assertEqual(self.provider.calls, 0)

    def test_figure_description_does_not_become_source_prose(self) -> None:
        figure = self.provider.page["blocks"][0]
        figure.update(kind="figure", text="A model-generated image description", spans=[])
        page = self.recognize()
        self.assertEqual(page.blocks[0].kind, "separator")
        self.assertEqual(page.blocks[0].text, "")
        self.assertIn("recognition_figure_requires_reconstruction", [i.code for i in page.issues])

    def test_source_page_render_and_config_change_cache_identity(self) -> None:
        self.recognize()
        recognize_page(SOURCE, 2, self.render, 600.0, 960.0, self.provider, self.store, self.cache)
        Image.new("RGB", (100, 160), "black").save(self.render)
        self.recognize()
        self.assertEqual(self.provider.calls, 3)
        self.assertEqual(len(list(self.cache.glob("*.json"))), 3)


class HttpResponse(io.BytesIO):
    code = 200

    def read1(self, size: int = -1) -> bytes:
        return self.read(size)


class OpenRouterTransportTests(unittest.TestCase):
    def test_payload_pins_model_route_schema_and_no_fallback(self) -> None:
        config = RecognitionConfig("example/exact", "exact-route", "explicit-quote", 100)
        provider = OpenRouterProvider(config, "test-placeholder")
        captured: dict[str, Any] = {}

        class Opener:
            def open(self, request: Any, timeout: float) -> HttpResponse:
                captured["request"] = request
                captured["timeout"] = timeout
                return HttpResponse(b'{"usage":{"cost":0.0000001}}')

        with patch("urllib.request.build_opener", return_value=Opener()):
            raw = provider.request(b"image-bytes", "image/png", {"type": "object"})
        request = captured["request"]
        self.assertEqual(request.full_url, "https://openrouter.ai/api/v1/chat/completions")
        payload = json.loads(request.data)
        self.assertEqual(payload["model"], config.model_id)
        self.assertEqual(payload["provider"]["only"], ["exact-route"])
        self.assertFalse(payload["provider"]["allow_fallbacks"])
        self.assertTrue(payload["provider"]["require_parameters"])
        self.assertEqual(payload["max_tokens"], config.max_output_tokens)
        self.assertEqual(payload["temperature"], 0)
        self.assertEqual(payload["plugins"], [])
        self.assertNotIn("test-placeholder", request.data.decode())
        self.assertEqual(provider.decode_response(raw).actual_cost_microusd, 1)
        self.assertNotIn("test-placeholder", repr(provider))

    def test_billing_comes_only_from_valid_numeric_provider_usage(self) -> None:
        provider = OpenRouterProvider(
            RecognitionConfig("example/exact", "route", "explicit-quote", 100),
            "placeholder",
        )
        for value in (None, True, -1, "0.00001", float("nan"), float("inf")):
            receipt = provider.decode_response(
                RawResponse(
                    200,
                    json.dumps(
                        {
                            "usage": {"cost": value},
                            "choices": [
                                {"message": {"content": '{"cost":0}'}, "finish_reason": "stop"}
                            ],
                        }
                    ).encode(),
                )
            )
            self.assertIsNone(receipt.actual_cost_microusd)

    def test_http_response_limit_is_enforced_without_network(self) -> None:
        provider = OpenRouterProvider(
            RecognitionConfig("example/exact", "route", "quote", 100),
            "placeholder",
        )

        class Opener:
            def open(self, request: Any, timeout: float) -> HttpResponse:
                return HttpResponse(b"x" * 41)

        with (
            patch("urllib.request.build_opener", return_value=Opener()),
            patch("ava_pdf_epub.recognition._MAX_RESPONSE_BYTES", 40),
        ):
            with self.assertRaises(RecognitionUncertainError):
                provider.request(b"image", "image/png", {})

    def test_config_requires_explicit_positive_quote_bound(self) -> None:
        for model in ("auto", "openrouter/auto", "example/model:floor", "example/model:online"):
            with self.assertRaises(ValueError):
                RecognitionConfig(model, "route", "quote", 10)
        with self.assertRaises(ValueError):
            RecognitionConfig("example/model", "route", "", 10)
        with self.assertRaises(ValueError):
            RecognitionConfig("example/model", "route", "quote", 0)


if __name__ == "__main__":
    unittest.main()
