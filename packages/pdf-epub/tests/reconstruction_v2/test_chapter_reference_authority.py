"""Stale navigation and native maps cannot grant a chapter link."""

import unittest

from ava_pdf_epub.reconstruction_v2.bind_printed_targets import bind_printed_targets

from .chapter_reference_fixture import fixture


class ChapterReferenceAuthorityTests(unittest.TestCase):
    def test_current_policy_and_complete_navigation_required(self):
        for change in [
            "title-policy",
            "continuation-policy",
            "missing",
            "page",
            "depth",
            "title",
            "prefix",
        ]:
            with self.subTest(change=change):
                items, state = fixture()
                if change == "title-policy":
                    state.source_title_policy = None
                elif change == "continuation-policy":
                    state.source_continuation_policy = None
                else:
                    label, page, depth = state.source_outline_aliases.pop()
                    if change != "missing":
                        labels = {"title": "Other title", "prefix": label[:8]}
                        state.source_outline_aliases.append(
                            (
                                labels.get(change, label),
                                2 if change == "page" else page,
                                1 if change == "depth" else depth,
                            )
                        )
                with self.assertRaisesRegex(ValueError, "missing or ambiguous"):
                    bind_printed_targets(items, state)

    def test_native_and_compound_identity_required(self):
        for change in [
            "text",
            "role",
            "level",
            "chapter",
            "method",
            "parts",
            "map",
            "hash",
            "offset",
            "owner",
        ]:
            with self.subTest(change=change):
                items, state = fixture()
                updates = {
                    "text": {"text": "1\nChanged"},
                    "role": {"chapter_role": "frontmatter"},
                    "level": {"heading_level": 2},
                    "chapter": {"chapter_start": False},
                    "method": {"method": "ocr"},
                }
                if change in updates:
                    items[0] = items[0].model_copy(update=updates[change])
                elif change == "parts":
                    state.compound_heading_sources.clear()
                elif change == "map":
                    state.native_line_maps.clear()
                else:
                    entry = state.native_line_maps["number-line"]
                    values = {
                        "hash": {"text_sha256": "0" * 64},
                        "offset": {"start": 1, "end": 2},
                        "owner": {"segment_id": "other"},
                    }[change]
                    state.native_line_maps["number-line"] = entry.model_copy(update=values)
                with self.assertRaisesRegex(ValueError, "missing or ambiguous"):
                    bind_printed_targets(items, state)

    def test_duplicate_explicit_numbers_refuse(self):
        items, state = fixture()
        extra, other = fixture(prefix="other-")
        state.compound_heading_sources.update(other.compound_heading_sources)
        state.native_line_maps.update(other.native_line_maps)
        state.source_outline_aliases.extend(other.source_outline_aliases)
        with self.assertRaisesRegex(ValueError, "missing or ambiguous"):
            bind_printed_targets([*items, extra[0]], state)
