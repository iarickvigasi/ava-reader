import unittest

from ava_pdf_epub.reconstruction_v2.assemble_pages import assemble_pages
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.ocr_running_furniture import corroborate_running_furniture
from ava_pdf_epub.reconstruction_v2.prepared import PreparedPage
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan

from .test_pdf_links import box, observation
from .test_refinement_grouping import segment


def fixture():
    prepared, qualified = [], {}
    for n in range(1, 5):
        prepared.append(
            PreparedPage(
                schema_version="ava-prepared-page-1",
                source_sha256="a" * 64,
                source_byte_length=1,
                source_page_count=4,
                observation=observation().model_copy(update={"number": n}),
                tables=[],
                native_segments=[],
                tasks=[],
            )
        )
        header = segment("header" + str(n), "Repeated running header", level=1, page=n)
        header = header.model_copy(
            update={
                "kind": "furniture" if n == 4 else "heading",
                "heading_level": None if n == 4 else 1,
                "chapter_start": False,
                "chapter_role": None,
                "box": box(10, 3, 90, 7),
            }
        )
        qualified[n] = [header, segment("body" + str(n), "Ordinary body prose.", page=n)]
    return prepared, qualified


class OcrRunningFurniture(unittest.TestCase):
    def test_exact_repeated_margin_is_accounted_without_false_toc_entries(self):
        prepared, qualified = fixture()
        state = AssemblyState()
        output = corroborate_running_furniture(prepared, qualified, state)
        pages, stream = assemble_pages(prepared, output, state)
        self.assertEqual([s.id for s in stream], ["body" + str(n) for n in range(1, 5)])
        self.assertTrue(all(any(r["role"] == "furniture" for r in p["regions"]) for p in pages))
        self.assertEqual(3, len(state.structure_findings))
        self.assertEqual(qualified[1][0].kind, "heading")
        self.assertEqual(output[1][0].text, qualified[1][0].text)
        self.assertEqual(output[1][0].style, qualified[1][0].style)
        self.assertEqual(corroborate_running_furniture(prepared, output, state), output)
        self.assertEqual(3, len(state.structure_findings))

    def test_content_ambiguity_and_links_are_not_silently_removed(self):
        for variation in [
            "no_peer",
            "displaced",
            "body",
            "chapter",
            "linked",
            "two_pages",
            "duplicate",
        ]:
            with self.subTest(variation=variation):
                prepared, qualified = fixture()
                if variation == "no_peer":
                    qualified[4][0] = qualified[4][0].model_copy(update={"kind": "heading"})
                elif variation == "two_pages":
                    prepared, qualified = prepared[:2], {n: qualified[n] for n in [1, 2]}
                elif variation == "duplicate":
                    qualified[1].append(qualified[1][0].model_copy(update={"id": "duplicate"}))
                else:
                    changes = {
                        "displaced": {"box": box(10, 1, 90, 4)},
                        "body": {"box": box(10, 30, 90, 35)},
                        "chapter": {"chapter_start": True, "chapter_role": "bodymatter"},
                        "linked": {
                            "spans": [ObservedSpan(start=0, end=8, url="https://example.org")]
                        },
                    }
                    # Both candidate headings are protected; fewer than three eligible peers remain.
                    for n in [1, 2]:
                        qualified[n][0] = qualified[n][0].model_copy(update=changes[variation])
                output = corroborate_running_furniture(prepared, qualified, AssemblyState())
                self.assertEqual(output, qualified)
