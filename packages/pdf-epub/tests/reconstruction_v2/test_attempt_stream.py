"""Attempt-private preparation preserves source tasks/artifacts and fails before later exchanges."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pypdf import PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject, TextStringObject

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE, LEGACY_PROFILE
from ava_pdf_epub.reconstruction_v2.attempt_exchange import json_bytes
from ava_pdf_epub.reconstruction_v2.attempt_stream import AttemptFailure, attempt_stream
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.prepare_refinement_source import prepare_refinement_source
from ava_pdf_epub.reconstruction_v2.protocol import ReconstructionInput, prepared_result
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementTask, SourceFeatureTask
from ava_pdf_epub.reconstruction_v2.refinement_identity import refinement_identifier
from ava_pdf_epub.reconstruction_v2.source_preparation import SourcePreparation
from ava_pdf_epub.reconstruction_v2.source_refusal import SourceContentRefusal
from ava_pdf_epub.reconstruction_v2.validate_tasks import validate_tasks

from .attempt_peer import PeerOutput
from .mixed_heading_fixtures import decisions, recognition, source_pdf
from .raster_region_fixture import authored_mixed
from .refinement_helpers import authored_responses, source_case
from .source_feature_answers import decisions as feature_decisions
from .test_raster_text import text_image

FIXTURES = Path(__file__).parent / "fixtures"


def request(source, profile=LEGACY_PROFILE, policy=None):
    initial = ReconstructionInput(
        schema_version="ava-reconstruct-input-1",
        profile_id=profile,
        source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        responses=[],
        refinements=[],
        source_feature_policy=policy,
    )
    return json_bytes(dict(mode="attempt_stream", input=initial.model_dump(mode="json")))


class AttemptStreamTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def equivalent(
        self, source, pages, responses, answer, profile=LEGACY_PROFILE, mutate=False, policy=None
    ):
        initial = ReconstructionInput(
            schema_version="ava-reconstruct-input-1",
            profile_id=profile,
            source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
            responses=responses,
            source_feature_policy=policy,
        )
        batch = prepare_refinement_source(source, self.root / "legacy-refinement", initial)
        refinements = answer(batch.tasks)
        legacy, report = reconstruct_source(
            source,
            self.root / "legacy-final",
            initial.model_copy(update={"refinements": refinements}),
        )
        page_values = {
            page.observation.number: prepared_result(page).model_dump(mode="json") for page in pages
        }
        recognition_values = {
            response.task_id: response.model_dump(mode="json") for response in responses
        }
        refinement_values = {
            response.task_id: response.model_dump(mode="json") for response in refinements
        }

        def callback(packet):
            kind, payload = packet["kind"], packet["payload"]
            if kind == "page":
                self.assertEqual(page_values[payload["page_number"]], payload)
                return []
            if kind == "recognition":
                self.assertEqual({"task_id"}, set(payload))
                return [recognition_values[payload["task_id"]]]
            if kind == "refinement_batch":
                self.assertEqual(batch.model_dump(mode="json"), payload)
                return []
            self.assertEqual("refinement", kind)
            return [refinement_values[payload["task_id"]]]

        peer = PeerOutput(callback)
        constructor = SourcePreparation.__init__
        prepared_instances = []

        def construct(instance, *args, **kwargs):
            constructor(instance, *args, **kwargs)
            prepared_instances.append(instance)

        from ava_pdf_epub.reconstruction_v2 import attempt_stream as worker

        original_refinement = worker.prepare_refinement_from_pages

        def mutate_phase(source, scratch, checkpoints, current):
            result = original_refinement(source, scratch, checkpoints, current)
            checkpoints[0].native_segments.clear()
            checkpoints[0].observation.lines.clear()
            if current.responses:
                current.responses[0].segments.clear()
            return result

        with (
            patch.object(SourcePreparation, "__init__", construct),
            patch.object(
                worker, "prepare_from_source", wraps=worker.prepare_from_source
            ) as prepare,
            patch.object(
                worker,
                "prepare_refinement_from_pages",
                side_effect=mutate_phase if mutate else original_refinement,
            ),
        ):
            attempt_stream(
                source, self.root / "attempt", request(source, profile, policy), peer.incoming, peer
            )
        self.assertEqual(len(pages), prepare.call_count)
        self.assertEqual(1, len(prepared_instances))
        self.assertTrue(prepared_instances[0]._closed)
        self.assertIsNone(prepared_instances[0]._document)
        self.assertEqual(
            list(range(1, len(peer.controls) + 1)), [p["sequence"] for p in peer.controls]
        )
        self.assertEqual("artifacts", peer.controls[-1]["kind"])
        actual = peer.decoded_artifacts()
        expected = {
            "canonical.json": legacy.book.model_dump_json().encode(),
            "book.epub": legacy.epub,
            "reconstruction-report.json": report.model_dump_json().encode(),
        }
        paths = {resource.id: resource.path for resource in legacy.book.resources}
        expected.update({paths[key]: value for key, value in legacy.assets.items()})
        self.assertEqual(expected, actual)

    def test_native_exact_tasks_canonical_epub_resources_report_and_one_preparation(self):
        source = FIXTURES / "native.pdf"
        pages = [prepare_page(source, self.root / "pages", number) for number in range(1, 9)]
        self.equivalent(source, pages, [], lambda _: [])

    def test_ukrainian_exact_artifacts_and_mutable_checkpoint_phase_isolation(self):
        source = FIXTURES / "uk-native.pdf"
        pages = [
            prepare_page(source, self.root / "pages", number, BILINGUAL_PROFILE)
            for number in range(1, 4)
        ]
        self.equivalent(source, pages, [], lambda _: [], BILINGUAL_PROFILE, mutate=True)

    def test_source_bound_scan_replay_matches_legacy_and_isolates_response_mutation(self):
        source, pages, responses, _, _, _ = source_case(self.root)
        self.equivalent(source, pages, responses, authored_responses, mutate=True)

    def test_source_bound_mixed_replay_matches_legacy(self):
        source = source_pdf(self.root)
        pages = [prepare_page(source, self.root / "pages", number) for number in range(1, 4)]
        self.equivalent(source, pages, [recognition(pages[1].tasks[0])], decisions)

    def test_current_finite_feature_policy_replay_matches_legacy(self):
        source, pages, responses, _, _, _ = source_case(self.root)

        def answer(tasks):
            return [
                feature_decisions(task)
                if isinstance(task, SourceFeatureTask)
                else authored_responses([task])[0]
                for task in tasks
            ]

        self.equivalent(source, pages, responses, answer, policy="ava-ocr-source-features-1")

    def test_later_page_active_annotation_refuses_before_any_exchange(self):
        writer = PdfWriter(clone_from=FIXTURES / "native.pdf")
        annotation = DictionaryObject(
            {
                NameObject("/Subtype"): NameObject("/Link"),
                NameObject("/A"): DictionaryObject(
                    {
                        NameObject("/S"): NameObject("/JavaScript"),
                        NameObject("/JS"): TextStringObject("private source instructions"),
                    }
                ),
            }
        )
        writer.pages[3][NameObject("/Annots")] = ArrayObject([writer._add_object(annotation)])
        source = self.root / "unsafe.pdf"
        writer.write(source)
        peer = PeerOutput(lambda _: self.fail("Unsafe later page emitted a callback"))
        with self.assertRaises(AttemptFailure):
            attempt_stream(source, self.root / "attempt", request(source), peer.incoming, peer)
        self.assertEqual(["refusal"], [p["kind"] for p in peer.controls])
        self.assertFalse(peer.artifacts)

    def test_typed_first_ocr_refusal_stops_before_later_pages_and_keeps_diagnostic(self):
        source = FIXTURES / "two-column-scan.pdf"

        def callback(packet):
            if packet["kind"] == "page":
                self.task = packet["payload"]["tasks"][0]
                return []
            task = self.task
            return [
                dict(
                    schema_version="ava-recognition-response-2",
                    task_id=task["task_id"],
                    source_sha256=task["source_sha256"],
                    render_sha256=task["image"]["sha256"],
                    segments=[],
                    unresolved=["private source prose"],
                    language="en",
                )
            ]

        peer = PeerOutput(callback)
        with self.assertRaises(AttemptFailure) as caught:
            attempt_stream(source, self.root / "attempt", request(source), peer.incoming, peer)
        self.assertIsInstance(caught.exception.cause, SourceContentRefusal)
        self.assertEqual(["page", "recognition", "refusal"], [p["kind"] for p in peer.controls])
        self.assertEqual(
            caught.exception.cause.diagnostic.model_dump(mode="json"), peer.controls[-1]["payload"]
        )
        self.assertNotIn("private source prose", json.dumps(peer.controls[-1]))

    def test_invalid_first_response_on_multi_task_page_never_dispatches_second(self):
        source = self.root / "multiple-regions.pdf"
        authored_mixed(
            source,
            text_image(
                [
                    "A separate printed passage.",
                    "Its second line is measured.",
                    "The last line stays exact.",
                ]
            ),
            image_top=200,
            second_image=True,
        )
        advertised = []

        def callback(packet):
            if packet["kind"] == "page":
                advertised.extend(packet["payload"]["tasks"])
                return []
            self.assertEqual(advertised[0]["task_id"], packet["payload"]["task_id"])
            task = advertised[0]
            return [
                dict(
                    schema_version="ava-recognition-response-2",
                    task_id=task["task_id"],
                    source_sha256=task["source_sha256"],
                    render_sha256=task["image"]["sha256"],
                    segments=[],
                    unresolved=["uncertain"],
                    language="en",
                )
            ]

        peer = PeerOutput(callback)
        calls = []

        def validation(data):
            value = json.loads(data)
            calls.append((len(value["tasks"]), len(value.get("responses", []))))
            return validate_tasks(data)

        with (
            patch(
                "ava_pdf_epub.reconstruction_v2.attempt_stream.validate_tasks",
                side_effect=validation,
            ),
            self.assertRaises(AttemptFailure),
        ):
            attempt_stream(
                source,
                self.root / "attempt",
                request(source, BILINGUAL_PROFILE),
                peer.incoming,
                peer,
            )
        self.assertGreaterEqual(len(advertised), 2)
        self.assertIn((len(advertised), 0), calls)
        self.assertEqual([(1, 1)], [pair for pair in calls if pair[1]])
        self.assertEqual(["page", "recognition", "refusal"], [p["kind"] for p in peer.controls])

    def test_invalid_first_refinement_stops_before_second_announced_task(self):
        source, _, responses, _, _, _ = source_case(self.root)
        recognition_values = {r.task_id: r.model_dump(mode="json") for r in responses}
        from ava_pdf_epub.reconstruction_v2 import attempt_stream as worker

        original = worker.prepare_refinement_from_pages
        announced = []

        def two_tasks(*args):
            batch = original(*args)
            first = batch.tasks[0]
            self.assertGreaterEqual(len(first.decision_ids), 2)
            raw = first.model_dump(mode="json")
            raw["decision_ids"] = raw["decision_ids"][:1]
            raw["task_id"] = refinement_identifier(raw)
            second = BookRefinementTask.model_validate(raw)
            return batch.model_copy(update={"tasks": [first, second]})

        def callback(packet):
            if packet["kind"] == "page":
                return []
            if packet["kind"] == "recognition":
                return [recognition_values[packet["payload"]["task_id"]]]
            if packet["kind"] == "refinement_batch":
                announced.extend(packet["payload"]["tasks"])
                return []
            self.assertEqual(announced[0]["task_id"], packet["payload"]["task_id"])
            return [{"invalid": "first semantic response"}]

        peer = PeerOutput(callback)
        with (
            patch.object(worker, "prepare_refinement_from_pages", side_effect=two_tasks),
            self.assertRaises(AttemptFailure),
        ):
            attempt_stream(source, self.root / "attempt", request(source), peer.incoming, peer)
        self.assertEqual(2, len(announced))
        self.assertEqual(1, sum(p["kind"] == "refinement" for p in peer.controls))
        self.assertEqual("refusal", peer.controls[-1]["kind"])
        self.assertFalse(peer.artifacts)

    def test_valid_wrong_profile_refinement_task_refuses_before_batch_callback(self):
        source, _, responses, _, _, _ = source_case(self.root)
        recognition_values = {r.task_id: r.model_dump(mode="json") for r in responses}
        from ava_pdf_epub.reconstruction_v2 import attempt_stream as worker

        original = worker.prepare_refinement_from_pages

        def wrong_profile(*args):
            batch = original(*args)
            raw = batch.tasks[0].model_dump(mode="json")
            raw["profile_id"] = BILINGUAL_PROFILE
            raw["task_id"] = refinement_identifier(raw)
            valid_task = BookRefinementTask.model_validate(raw)
            return batch.model_copy(update={"tasks": [valid_task]})

        def callback(packet):
            if packet["kind"] == "page":
                return []
            self.assertEqual("recognition", packet["kind"])
            return [recognition_values[packet["payload"]["task_id"]]]

        peer = PeerOutput(callback)
        with (
            patch.object(worker, "prepare_refinement_from_pages", side_effect=wrong_profile),
            self.assertRaises(AttemptFailure) as caught,
        ):
            attempt_stream(source, self.root / "attempt", request(source), peer.incoming, peer)
        self.assertRegex(str(caught.exception.cause), "another source/profile")
        self.assertFalse(any(p["kind"] == "refinement_batch" for p in peer.controls))
        self.assertEqual("refusal", peer.controls[-1]["kind"])
        self.assertFalse(peer.artifacts)

    def test_recognition_aggregate_bound_blocks_next_page_after_semantically_valid_reply(self):
        source = source_pdf(self.root)
        page = prepare_page(source, self.root / "prior", 2)
        reply = recognition(page.tasks[0]).model_dump(mode="json")

        def callback(packet):
            return [] if packet["kind"] == "page" else [reply]

        peer = PeerOutput(callback)
        with (
            patch(
                "ava_pdf_epub.reconstruction_v2.attempt_stream.RECOGNITION_BYTES",
                len(json_bytes(reply)),
            ),
            self.assertRaises(AttemptFailure) as caught,
        ):
            attempt_stream(source, self.root / "attempt", request(source), peer.incoming, peer)
        self.assertRegex(str(caught.exception.cause), "aggregate response byte bound")
        self.assertEqual(
            ["page", "page", "recognition", "refusal"], [p["kind"] for p in peer.controls]
        )

    def test_original_source_view_and_checkpoint_mutation_refuse_without_artifacts(self):
        for kind in ["source", "view", "checkpoint"]:
            with self.subTest(kind=kind):
                root = self.root / kind
                root.mkdir()
                writer = PdfWriter(clone_from=FIXTURES / "native.pdf")
                if kind == "view":
                    annotation = DictionaryObject(
                        {
                            NameObject("/Subtype"): NameObject("/Text"),
                            NameObject("/Contents"): TextStringObject("Personal comment"),
                        }
                    )
                    writer.pages[0][NameObject("/Annots")] = ArrayObject(
                        [writer._add_object(annotation)]
                    )
                source = root / "source.pdf"
                writer.write(source)
                scratch = root / "attempt"

                def callback(packet, source=source, kind=kind, scratch=scratch):
                    if packet["kind"] == "page" and packet["payload"]["page_number"] == 1:
                        target = (
                            source
                            if kind == "source"
                            else next(scratch.glob("annotation-view-*.pdf"))
                            if kind == "view"
                            else next(scratch.rglob("page-0001.json"))
                        )
                        with target.open("ab") as output:
                            output.write(b" ")
                    return []

                peer = PeerOutput(callback)
                with self.assertRaises(AttemptFailure):
                    attempt_stream(source, scratch, request(source), peer.incoming, peer)
                self.assertEqual("refusal", peer.controls[-1]["kind"])
                self.assertFalse(peer.artifacts)

    def test_final_eof_rejects_extra_frames_before_artifacts(self):
        source = FIXTURES / "uk-native.pdf"
        peer = None

        def callback(packet):
            if packet["kind"] == "refinement_batch":
                return [], b"unexpected extra frame"
            return []

        peer = PeerOutput(callback)
        # A valid final ACK followed by extra input must fail before artifacts.
        with self.assertRaises(AttemptFailure):
            attempt_stream(
                source,
                self.root / "attempt",
                request(source, BILINGUAL_PROFILE),
                peer.incoming,
                peer,
            )
        self.assertEqual("refusal", peer.controls[-1]["kind"])
        self.assertFalse(peer.artifacts)


if __name__ == "__main__":
    unittest.main()
