import unittest

from ava_pdf_epub.contracts.normalization import NormalizationMap
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.compound_wraps import (
    compact_compound_wraps,
    compact_native_compounds,
)
from ava_pdf_epub.reconstruction_v2.normalization_map import line_wrap_map
from ava_pdf_epub.reconstruction_v2.segments import ObservedSpan
from ava_pdf_epub.reconstruction_v2.stream_joins import stream_joins

from .test_refinement_grouping import segment


class CompoundWrapTests(unittest.TestCase):
    def native(self, text, source):
        return segment("paragraph", text).model_copy(
            update={"method": "native", "source_text": source}
        )

    def test_hyphen_is_retained_and_both_word_boundaries_remain_addressable(self):
        source, text = "будь-\nякому", "будь-якому"
        mapping = NormalizationMap.model_validate(line_wrap_map(source, text))
        mapping.validate_canonical(text)
        self.assertEqual(5, mapping.source_boundary(5))
        self.assertEqual(5, mapping.source_boundary(6))
        self.assertEqual(10, mapping.source_boundary(11))
        changed = next(s for s in mapping.segments if s.kind == "line_wrap")
        self.assertEqual((5, 5), (changed.canonical_start, changed.canonical_end))
        self.assertEqual("\n", source[changed.source_start : changed.source_end])

    def test_layout_whitespace_and_unicode_offsets_compact_without_rewording(self):
        source = "😀 Ґанок по- \r\n  справжньому\nдалі."
        old = source.replace("\r\n", " ").replace("\n", " ")
        native = self.native(old, source)
        start = old.index("справжньому")
        native = native.model_copy(
            update={
                "spans": [
                    ObservedSpan(
                        start=start,
                        end=start + len("справжньому"),
                        url="https://example.org/reference",
                    )
                ]
            }
        )
        result = compact_compound_wraps(native)
        self.assertEqual("😀 Ґанок по-справжньому далі.", result.text)
        span = result.spans[0]
        self.assertEqual("справжньому", result.text[span.start : span.end])
        self.assertEqual(native.spans[0].url, span.url)
        self.assertEqual(source, result.source_text)
        mapping = NormalizationMap.model_validate(line_wrap_map(source, result.text))
        mapping.validate_canonical(result.text)
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            mapping.source_boundary(source.index("\r") + 1)

    def test_repeated_compaction_preserves_text_spans_and_internal_positions(self):
        item = self.native("будь- якому далі", "будь-\nякому\nдалі")
        item = item.model_copy(
            update={"spans": [ObservedSpan(start=6, end=11, url="https://example.org")]}
        )
        state = AssemblyState(
            internal_targets=[(item.id, 6, 11, item.id, 6)],
            aliases={"alias": (item.id, 6)},
        )
        once = compact_native_compounds([item], state)
        positions = (list(state.internal_targets), dict(state.aliases))
        self.assertEqual(once, compact_native_compounds(once, state))
        self.assertEqual(positions, (state.internal_targets, state.aliases))
        self.assertEqual(once[0], compact_compound_wraps(once[0]))

    def test_inline_spacing_literal_blocks_and_ocr_are_not_rewritten(self):
        for text, source in (
            ("будь- якому", "будь- якому"),
            ("a - b", "a -\nb"),
            ("x- 42", "x-\n42"),
            ("a— b", "a—\nb"),
        ):
            item = self.native(text, source)
            self.assertEqual(item, compact_compound_wraps(item))
        item = self.native("будь- якому", "будь-\nякому")
        for kind in ("verse", "code", "quote"):
            literal = item.model_copy(update={"kind": kind})
            self.assertEqual(literal, compact_compound_wraps(literal))
        ocr = item.model_copy(update={"method": "ocr"})
        self.assertEqual(ocr, compact_compound_wraps(ocr))

    def test_removed_hyphens_letters_and_generic_newline_deletions_are_refused(self):
        for source, wrong in (
            ("будь-\nякому", "будь якому"),
            ("будь-\nякому", "будь-якому!"),
            ("two\nwords", "twowords"),
            ("x-\n42", "x-42"),
        ):
            with self.subTest(source=source), self.assertRaises(ValueError):
                line_wrap_map(source, wrong)
        valid = line_wrap_map("a\nb", "a b")
        valid["segments"][1]["canonical_end"] = valid["segments"][1]["canonical_start"]
        valid["segments"][2]["canonical_start"] -= 1
        valid["segments"][2]["canonical_end"] -= 1
        with self.assertRaises(ValueError):
            NormalizationMap.model_validate(valid).validate_canonical("ab")

    def test_native_page_join_updates_link_span_and_target_alias_offset(self):
        left = segment("left", "будь-").model_copy(update={"method": "native"})
        right = segment("right", "якому", page=2).model_copy(
            update={
                "method": "native",
                "spans": [ObservedSpan(start=0, end=5, url="https://example.org/reference")],
            }
        )
        state = AssemblyState(
            evidence={"left": [], "right": []}, refined_joins={("left", "right"): True}
        )
        joined = stream_joins([left, right], state)[0]
        self.assertEqual("будь-якому", joined.text)
        self.assertEqual(("left", 5), state.aliases["right"])
        self.assertEqual("якому", joined.text[joined.spans[0].start : joined.spans[0].end])
        NormalizationMap.model_validate(
            line_wrap_map(joined.source_text, joined.text)
        ).validate_canonical(joined.text)

    def test_internal_link_ranges_targets_and_existing_aliases_shift_together(self):
        item = self.native("будь- якому", "будь-\nякому")
        state = AssemblyState(
            internal_targets=[("paragraph", 6, 11, "paragraph", 6)],
            aliases={"original": ("paragraph", 6)},
        )
        updated = compact_native_compounds([item], state)[0]
        self.assertEqual("будь-якому", updated.text)
        self.assertEqual([("paragraph", 5, 10, "paragraph", 5)], state.internal_targets)
        self.assertEqual(("paragraph", 5), state.aliases["original"])

    def test_real_pdf_with_compound_wrap_keeps_canonical_round_trip(self):
        import hashlib
        import tempfile
        from pathlib import Path
        from unittest.mock import patch

        from ava_pdf_epub.epub_v2.portable import portable_epub
        from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
        from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
        from ava_pdf_epub.reconstruction_v2.reconstruct import reconstruct
        from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

        from .test_native_literal import responses, source_pdf

        printed = [
            "The author keeps a well-",
            "known example in ordinary prose.",
            "The printed book retains every ordinary word.",
            "The final sentence stays unchanged.",
        ]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.pdf"
            with patch("tests.reconstruction_v2.test_native_literal.BODY", printed):
                source_pdf(source, "quote")
            pages = prepare_source(source, root, hashlib.sha256(source.read_bytes()).hexdigest())
            _, segments, state = source_segments(source, root, pages, [])
            tasks = prepare_refinement(source, root, pages, segments, state)
            result = reconstruct(source, root, pages, [], responses(tasks, "quote"))
            expected = "The author keeps a well-known example in ordinary prose. " + " ".join(
                printed[2:]
            )
            block = next(
                b
                for b in result.book.blocks
                if hasattr(b, "content") and b.content.text == expected
            )
            self.assertEqual("\n".join(printed), block.content.normalization.source_text)
            imported, _ = portable_epub(result.epub)
            self.assertEqual(result.book, imported)
