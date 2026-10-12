"""Publication files follow accepted major sections without changing logical identity."""

import hashlib
import io
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.contracts.common import document_digest, text_digest
from ava_pdf_epub.contracts.offsets import codepoint_to_utf16
from ava_pdf_epub.epub_v2.conservation import conservation_report
from ava_pdf_epub.epub_v2.export import export_entries, export_epub
from ava_pdf_epub.epub_v2.portable import portable_epub
from ava_pdf_epub.epub_v2.profiles import LEGACY_PROFILE, PAGE_LABEL_PROFILE, SOURCE_PAGE_PROFILE
from ava_pdf_epub.epub_v2.xml import EPUB, XHTML
from ava_pdf_epub.reconstruction_v2.prepare_refinement_source import prepare_refinement_source
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.protocol import ReconstructionInput
from ava_pdf_epub.reconstruction_v2.reconstruct_source import reconstruct_source
from ava_pdf_epub.reconstruction_v2.source_feature_contract import FEATURE_POLICY
from ava_pdf_epub.reconstruction_v2.source_feature_task_contract import SourceFeatureTask
from tests.reconstruction_v2.mixed_heading_fixtures import decisions, recognition, source_pdf
from tests.reconstruction_v2.page_start_test_fixture import rename
from tests.reconstruction_v2.source_feature_answers import decisions as feature_decisions

from .helpers import archive_bytes, fixture


def section_book(*, source_pages=True):
    book, assets, _ = fixture()
    raw = book.model_dump()
    chapter = raw["chapters"][0]
    chapter["block_ids"] = [b["id"] for b in raw["blocks"]]
    raw["chapters"] = [chapter]
    raw["spine"] = [chapter["id"]]
    raw["addresses"] = [a for a in raw["addresses"] if a["fragment"] != "chapter-two"]
    for address in raw["addresses"]:
        address["resource_path"] = chapter["resource_paths"][0]
        address["target"]["chapter_id"] = chapter["id"]
    for block in raw["blocks"]:
        for node in [block, *block.get("cells", [])]:
            for span in node.get("content", {}).get("spans", []):
                if (span.get("link") or {}).get("kind") in {"internal", "note"}:
                    span["link"]["chapter_id"] = chapter["id"]
    headings = []
    for name, before, level in [
        ("major-a", "style-demo", 2),
        ("nested-a", "table-one", 3),
        ("major-b", "list-parent", 2),
        ("major-c", "verse-one", 2),
    ]:
        heading = raw["blocks"][0].copy()
        text = name.replace("-", " ").title()
        heading.update(id=name, level=level)
        heading["evidence"] = next(b["evidence"] for b in raw["blocks"] if b["id"] == before)
        heading["content"] = dict(
            text=text, sha256=text_digest(text), spans=[], codepoint_utf16=codepoint_to_utf16(text)
        )
        raw["blocks"].insert(
            next(i for i, b in enumerate(raw["blocks"]) if b["id"] == before), heading
        )
        headings.append(heading)
    next(b for b in raw["blocks"] if b["id"] == "heading-two")["level"] = 2
    # An indivisible, authored question continues numbering in the next major section.
    item = next(b.copy() for b in raw["blocks"] if b["id"] == "list-next")
    text = "A😀 question continues across a print wrap without becoming another item."
    item.update(id="continuing-question", list_id="continuing-list")
    item["content"] = dict(
        text=text, sha256=text_digest(text), spans=[], codepoint_utf16=codepoint_to_utf16(text)
    )
    raw["blocks"].insert(
        next(i for i, b in enumerate(raw["blocks"]) if b["id"] == "verse-one"), item
    )
    raw["lists"].append(
        dict(
            id="continuing-list",
            ordered=True,
            start=5,
            depth=1,
            parent_item_id=None,
            item_ids=[item["id"]],
        )
    )
    chapter["block_ids"] = [b["id"] for b in raw["blocks"]]
    root = raw["toc"][0].copy()
    raw["toc"] = [root]
    for block in [*headings, next(b for b in raw["blocks"] if b["id"] == "heading-two")]:
        raw["toc"].append(
            dict(
                id="toc-" + block["id"],
                label=block["content"]["text"],
                parent_id="toc-major-a" if block["level"] == 3 else root["id"],
                target=dict(
                    kind="internal", chapter_id=chapter["id"], block_id=block["id"], offset=0
                ),
            )
        )
    for block in [*headings, item]:
        raw["addresses"].append(
            dict(
                resource_path=chapter["resource_paths"][0],
                fragment=block["id"],
                target=dict(
                    kind="internal", chapter_id=chapter["id"], block_id=block["id"], offset=0
                ),
            )
        )
    if source_pages:
        for page, block_id in [(1, "heading-one"), (2, "heading-two")]:
            raw["addresses"].append(
                dict(
                    resource_path=chapter["resource_paths"][0],
                    fragment=f"ava-source-page-{page}",
                    source_page=page,
                    target=dict(
                        kind="internal", chapter_id=chapter["id"], block_id=block_id, offset=0
                    ),
                )
            )
    return CanonicalBookV2.model_validate(raw), assets


def resolve(entries, href):
    path, fragment = href.split("#")
    path = "EPUB/" + path.removeprefix("../")
    root = ET.fromstring(entries[path])
    targets = [n for n in root.iter() if n.get("id") == fragment]
    if len(targets) != 1:
        raise AssertionError((href, len(targets)))
    return path, targets[0]


class SectionFileTests(unittest.TestCase):
    def test_opening_and_four_major_sections_are_separate_without_invented_chapters(self):
        book, assets = section_book()
        before = book.model_dump()
        entries = export_entries(book, assets)
        opf = ET.fromstring(entries["EPUB/package.opf"])
        ids = {n.get("id"): n.get("href") for n in opf.findall("{*}manifest/{*}item")}
        paths = ["EPUB/" + ids[n.get("idref")] for n in opf.findall("{*}spine/{*}itemref")]
        self.assertEqual(5, len(paths))
        self.assertEqual(1, len(book.chapters))
        actual = [
            n.get("data-ava-block")
            for path in paths
            for n in ET.fromstring(entries[path]).iter()
            if n.get("data-ava-block")
        ]
        self.assertEqual([b.id for b in book.blocks], actual)
        self.assertEqual([1, 2, 3, 2, 2, 2], [b.level for b in book.blocks if b.kind == "heading"])
        self.assertEqual(before, book.model_dump())
        self.assertEqual((book, assets), portable_epub(export_epub(book, assets)))

    def test_toc_notes_backlinks_offsets_and_source_pages_use_the_actual_target_file(self):
        book, assets = section_book()
        entries = export_entries(book, assets)
        nav = ET.fromstring(entries["EPUB/nav/nav.xhtml"])
        links = list(nav.iter(f"{{{XHTML}}}a"))
        for link in links:
            resolve(entries, link.get("href"))
        toc = next(n for n in nav.iter() if n.get(f"{{{EPUB}}}type") == "toc")
        destinations = [resolve(entries, n.get("href"))[0] for n in toc.iter(f"{{{XHTML}}}a")]
        self.assertEqual(5, len(set(destinations)))
        self.assertEqual(destinations[1], destinations[2])  # Nested H3 remains with its H2.
        note_calls = []
        for path, data in entries.items():
            if not path.startswith("EPUB/text/"):
                continue
            for link in ET.fromstring(data).iter(f"{{{XHTML}}}a"):
                if not link.get("href").startswith("https:"):
                    target_path, _ = resolve(entries, link.get("href"))
                    if link.get(f"{{{EPUB}}}type") == "noteref":
                        note_calls.append((path, target_path))
        self.assertTrue(any(caller != target for caller, target in note_calls))
        for address in conservation_report(book)["source_addresses"]:
            resolve(
                entries,
                "../"
                + address["epub_resource"].removeprefix("EPUB/")
                + "#"
                + address["epub_fragment"],
            )

    def test_numbered_and_nested_items_are_whole_in_their_section_files(self):
        book, assets = section_book()
        entries = export_entries(book, assets)
        roots = [
            ET.fromstring(data) for path, data in entries.items() if path.startswith("EPUB/text/")
        ]
        lists = [n for root in roots for n in root.iter() if n.get("data-ava-list")]
        self.assertEqual(["3", None, "5"], [n.get("start") for n in lists])
        question = [
            n
            for root in roots
            for n in root.iter()
            if n.get("data-ava-text") == "continuing-question"
        ]
        self.assertEqual(1, len(question))
        self.assertEqual(
            next(b.content.text for b in book.blocks if b.id == "continuing-question"),
            "".join(question[0].itertext()),
        )

    def test_explicit_historical_projection_is_not_repartitioned_and_reimports(self):
        for pages, profile in [
            (False, LEGACY_PROFILE),
            (False, PAGE_LABEL_PROFILE),
            (True, SOURCE_PAGE_PROFILE),
        ]:
            with self.subTest(profile=profile):
                book, assets = section_book(source_pages=pages)
                before = document_digest(book)
                entries = export_entries(book, assets, profile=profile)
                self.assertEqual(1, len([p for p in entries if p.startswith("EPUB/text/")]))
                self.assertEqual(profile.encode(), entries["META-INF/ava-profile"])
                self.assertEqual((book, assets), portable_epub(archive_bytes(entries)))
                self.assertEqual(before, document_digest(book))
                report = conservation_report(book, profile=profile)
                self.assertEqual(profile, report["epub_profile"])
                for address in report["source_addresses"]:
                    resolve(
                        entries,
                        "../"
                        + address["epub_resource"].removeprefix("EPUB/")
                        + "#"
                        + address["epub_fragment"],
                    )

    def test_historical_authored_fixture_bytes_are_still_the_same(self):
        book, assets, _ = fixture()
        entries = export_entries(book, assets, profile=LEGACY_PROFILE)
        default = export_entries(book, assets)
        self.assertEqual(
            {p: hashlib.sha256(v).hexdigest() for p, v in entries.items()},
            {p: hashlib.sha256(v).hexdigest() for p, v in default.items()},
        )

    def test_unlisted_or_passage_toc_headings_do_not_invent_file_boundaries(self):
        for mode in ["unlisted", "passage"]:
            book, assets = section_book()
            raw = book.model_dump()
            if mode == "unlisted":
                raw["toc"] = raw["toc"][:1]
            else:
                for entry in raw["toc"][1:]:
                    entry["target"]["offset"] = 1
            book = CanonicalBookV2.model_validate(raw)
            entries = export_entries(book, assets)
            with self.subTest(mode=mode):
                self.assertEqual(SOURCE_PAGE_PROFILE.encode(), entries["META-INF/ava-profile"])
                self.assertEqual(1, len([p for p in entries if p.startswith("EPUB/text/")]))

    def test_caption_figure_unit_remains_in_one_file_without_reordering_source(self):
        book, assets = section_book()
        raw = book.model_dump()
        caption = next(b for b in raw["blocks"] if b["id"] == "caption-one")
        raw["blocks"].remove(caption)
        raw["blocks"].insert(
            next(i for i, b in enumerate(raw["blocks"]) if b["id"] == "list-parent"), caption
        )
        raw["chapters"][0]["block_ids"] = [b["id"] for b in raw["blocks"]]
        book = CanonicalBookV2.model_validate(raw)
        entries = export_entries(book, assets)
        roots = [
            ET.fromstring(data) for path, data in entries.items() if path.startswith("EPUB/text/")
        ]
        self.assertEqual(4, len(roots))
        figure = next(
            root
            for root in roots
            if any(n.get("data-ava-block") == "figure-one" for n in root.iter())
        )
        self.assertTrue(any(n.get("data-ava-block") == "caption-one" for n in figure.iter()))
        self.assertEqual(
            [b.id for b in book.blocks],
            [
                n.get("data-ava-block")
                for root in roots
                for n in root.iter()
                if n.get("data-ava-block")
            ],
        )
        self.assertEqual((book, assets), portable_epub(export_epub(book, assets)))

    def test_profile_substitution_cannot_hide_missing_or_repartitioned_content(self):
        book, assets = section_book()
        entries = export_entries(book, assets)
        entries["META-INF/ava-profile"] = SOURCE_PAGE_PROFILE.encode()
        with self.assertRaisesRegex(ValueError, "conservation"):
            portable_epub(archive_bytes(entries))

    def test_maximum_length_chapter_and_heading_ids_have_bounded_unique_filenames(self):
        book, assets = section_book()
        raw = rename(book.model_dump(), "chapter-one", "c" + "x" * 119)
        raw = rename(raw, "major-a", "s" + "y" * 119)
        book = CanonicalBookV2.model_validate(raw)
        entries = export_entries(book, assets)
        paths = [p for p in entries if p.startswith("EPUB/text/")]
        self.assertEqual(5, len(paths))
        self.assertTrue(
            all(len(part.encode()) <= 255 for path in paths for part in path.split("/"))
        )
        self.assertEqual((book, assets), portable_epub(export_epub(book, assets)))

    def test_duplicate_heading_identity_is_refused_before_publication_can_overwrite_a_file(self):
        book, _ = section_book()
        raw = book.model_dump()
        next(b for b in raw["blocks"] if b["id"] == "major-a")["id"] = "major-b"
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            CanonicalBookV2.model_validate(raw)

    def test_current_source_policy_uses_section_files_through_actual_reconstruction(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = source_pdf(root)
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            pages = prepare_source(
                source, root / "pages", digest, source_feature_policy=FEATURE_POLICY
            )
            request = ReconstructionInput(
                schema_version="ava-reconstruct-input-1",
                source_sha256=digest,
                source_feature_policy=FEATURE_POLICY,
                responses=[recognition(pages[1].tasks[0])],
            )
            batch = prepare_refinement_source(source, root / "refinement", request)
            receipts = [
                feature_decisions(task)
                if isinstance(task, SourceFeatureTask)
                else decisions([task])[0]
                for task in batch.tasks
            ]
            request = request.model_copy(update={"refinements": receipts})
            result, _ = reconstruct_source(source, root / "assembled", request)
            self.assertEqual(1, len(result.book.chapters))
            with zipfile.ZipFile(io.BytesIO(result.epub)) as archive:
                self.assertEqual(
                    3, len([p for p in archive.namelist() if p.startswith("EPUB/text/")])
                )
            self.assertEqual((result.book, result.assets), portable_epub(result.epub))

    def test_table_cell_callout_and_note_body_link_use_their_exact_files_and_offsets(self):
        book, assets = section_book()
        raw = book.model_dump()
        cell = next(c for b in raw["blocks"] for c in b.get("cells", []) if c["id"] == "cell-11")
        note = next(b for b in raw["blocks"] if b["id"] == "note-one")
        chapter = raw["chapters"][0]
        cell["content"]["spans"].append(
            dict(
                id="cell-note-call",
                start=0,
                end=1,
                link=dict(kind="note", chapter_id=chapter["id"], block_id=note["id"], offset=0),
            )
        )
        note["callout_ids"].append("cell-note-call")
        note["content"]["spans"].append(
            dict(
                id="note-cell-link",
                start=0,
                end=1,
                link=dict(kind="internal", chapter_id=chapter["id"], block_id=cell["id"], offset=1),
            )
        )
        for id_, block in [("cell-note-call", cell), ("note-cell-link", note)]:
            raw["addresses"].append(
                dict(
                    resource_path=chapter["resource_paths"][0],
                    fragment=id_,
                    target=dict(
                        kind="internal", chapter_id=chapter["id"], block_id=block["id"], offset=0
                    ),
                )
            )
        book = CanonicalBookV2.model_validate(raw)
        entries = export_entries(book, assets)
        mappings = {a["source_fragment"]: a for a in conservation_report(book)["source_addresses"]}
        cell_path = mappings["cell-note-call"]["epub_resource"]
        note_path = mappings["note-cell-link"]["epub_resource"]
        self.assertNotEqual(cell_path, note_path)
        cell_dom = ET.fromstring(entries[cell_path])
        note_dom = ET.fromstring(entries[note_path])
        call = next(
            n for n in cell_dom.iter(f"{{{XHTML}}}a") if n.get(f"{{{EPUB}}}type") == "noteref"
        )
        self.assertEqual(note_path, resolve(entries, call.get("href"))[0])
        return_link = next(
            n
            for n in note_dom.iter(f"{{{XHTML}}}a")
            if n.get("href").endswith("#s-" + b"cell-note-call".hex())
        )
        self.assertEqual(cell_path, resolve(entries, return_link.get("href"))[0])
        passage = next(
            n
            for n in note_dom.iter(f"{{{XHTML}}}a")
            if any(c.get("id") == "s-" + b"note-cell-link".hex() for c in n.iter())
        )
        self.assertEqual(cell_path, resolve(entries, passage.get("href"))[0])
        self.assertTrue(passage.get("href").endswith("-1"))
        self.assertEqual((book, assets), portable_epub(export_epub(book, assets)))


if __name__ == "__main__":
    unittest.main()
