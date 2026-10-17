"""Known source navigation aliases remain separate from exact printed opening claims."""

import unittest

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.source_outline_aliases import (
    add_outline_navigation,
    separate_outline_aliases,
)
from ava_pdf_epub.reconstruction_v2.structure_claims import StructureClaim

from .metadata_helpers import body, metadata_state, paragraph


class FrontmatterOutlineTests(unittest.TestCase):
    def test_known_front_bookmarks_do_not_create_chapters_or_invent_printed_titles(self):
        state = metadata_state(
            [
                paragraph("Cover source", page=1),
                paragraph("The Quiet River", page=4),
                paragraph("ISBN: 9780000000002", page=5),
                body("Walking") | dict(page=7),
            ]
        )
        printed = [StructureClaim("Walking", "contents", printed_page="1")]
        outline = [
            StructureClaim("Cover", None, pdf_page=1, depth=0),
            StructureClaim("Title: The Quiet River", None, pdf_page=4, depth=0),
            StructureClaim("ISBN 9780000000002", None, pdf_page=5, depth=0),
            StructureClaim("Walking", None, pdf_page=7, depth=0),
        ]
        remaining = separate_outline_aliases(outline, printed, 7, state)
        self.assertEqual([outline[-1]], remaining)
        chapters = [
            dict(id="front", block_ids=[b["id"] for b in state.blocks[:3]]),
            dict(id="body", block_ids=[state.blocks[-1]["id"]]),
        ]
        toc = [
            dict(
                id="opening",
                label="Walking",
                target=dict(
                    kind="internal", chapter_id="body", block_id=state.blocks[-1]["id"], offset=0
                ),
            )
        ]
        add_outline_navigation(
            state,
            chapters,
            toc,
            [
                dict(
                    source_page=n,
                    target=dict(
                        kind="internal", chapter_id="front", block_id=f"observed-{i}", offset=0
                    ),
                )
                for i, n in enumerate([1, 4, 5])
            ],
        )
        self.assertEqual(2, len(chapters))
        self.assertEqual(
            ["Cover", "Title: The Quiet River", "ISBN 9780000000002", "Walking"],
            [t["label"] for t in toc],
        )
        self.assertEqual("observed-1", toc[1]["target"]["block_id"])
        self.assertEqual([1, 4, 5], [f.page for f in state.structure_findings])

    def test_unknown_or_body_bookmark_is_not_silently_treated_as_front_alias(self):
        state = AssemblyState()
        for label, page in [("Ambiguous body heading", 4), ("Cover", 7)]:
            claim = StructureClaim(label, None, pdf_page=page)
            self.assertEqual([claim], separate_outline_aliases([claim], [], 7, state))
            self.assertEqual([], state.source_outline_aliases)

    def test_known_alias_with_missing_conserved_destination_refuses(self):
        state = AssemblyState(source_outline_aliases=[("Cover", 1, 0)])
        with self.assertRaisesRegex(ValueError, "checked source-page address"):
            add_outline_navigation(state, [], [], [])

    def test_joined_page_start_reuses_checked_offset_without_search_or_zero_guess(self):
        state = metadata_state([paragraph("Previous page. The exact later source start.", page=3)])
        state.source_outline_aliases = [("Title: The Quiet River", 4, 0)]
        chapters = [dict(id="front", block_ids=["observed-0"])]
        checked = dict(kind="internal", chapter_id="front", block_id="observed-0", offset=15)
        toc = []
        add_outline_navigation(state, chapters, toc, [dict(source_page=4, target=checked)])
        self.assertEqual(checked, toc[0]["target"])
        self.assertEqual(15, toc[0]["target"]["offset"])

    def test_nested_aliases_keep_parentage_and_conflicting_printed_label_stays_strict(self):
        state = metadata_state([paragraph("Cover", page=1), paragraph("Title", page=4)])
        state.source_outline_aliases = [("Cover", 1, 0), ("Title: The Quiet River", 4, 1)]
        state.source_outline_alias_parents = {0: None, 1: ("cover", 1, 0)}
        chapters = [dict(id="front", block_ids=["observed-0", "observed-1"])]
        addresses = [
            dict(
                source_page=n,
                target=dict(
                    kind="internal", chapter_id="front", block_id=f"observed-{i}", offset=0
                ),
            )
            for i, n in enumerate([1, 4])
        ]
        toc = []
        add_outline_navigation(state, chapters, toc, addresses)
        self.assertEqual(toc[0]["id"], toc[1]["parent_id"])
        claim = StructureClaim("Contents", None, pdf_page=4)
        state = AssemblyState()
        self.assertEqual(
            [claim],
            separate_outline_aliases(
                [claim], [StructureClaim("Contents", "row", printed_page="9")], 7, state
            ),
        )
        self.assertEqual([], state.source_outline_aliases)

    def test_no_alias_does_not_sort_or_validate_historical_toc(self):
        state = AssemblyState()
        toc = [{"id": "later", "label": "Later"}, {"id": "earlier", "label": "Earlier"}]
        original = list(toc)
        add_outline_navigation(state, [], toc, [])
        self.assertEqual(original, toc)

    def test_witnessed_body_dash_alias_does_not_promote_or_rewrite_printed_opening(self):
        state = AssemblyState()
        printed = [StructureClaim("Harbour – Orchard", "row", printed_page="2")]
        outline = [StructureClaim("Harbour - Orchard", None, pdf_page=7, depth=0)]
        self.assertEqual([], separate_outline_aliases(outline, printed, 7, state, folios={"2": 7}))
        self.assertEqual([("Harbour - Orchard", 7, 0)], state.source_outline_aliases)
        self.assertEqual("Harbour – Orchard", printed[0].title)
        self.assertEqual("SOURCE_OUTLINE_DASH_ALIAS", state.structure_findings[0].code)
        state = AssemblyState()
        wrong = StructureClaim("Harbour - Orchard", None, pdf_page=8, depth=0)
        self.assertEqual(
            [wrong], separate_outline_aliases([wrong], printed, 7, state, folios={"2": 7})
        )
        self.assertEqual([], state.source_outline_aliases)

    def test_nested_dash_alias_reuses_ordinary_source_parent_not_previous_front_alias(self):
        state = metadata_state(
            [
                paragraph("Cover", page=1),
                body("Harbour") | dict(page=7),
                paragraph("Orchard – Grove", page=8),
            ]
        )
        printed = [
            StructureClaim("Harbour", "row1", pdf_page=7, depth=0),
            StructureClaim("Orchard – Grove", "row2", pdf_page=8, depth=1),
        ]
        outline = [
            StructureClaim("Cover", None, pdf_page=1, depth=0),
            StructureClaim("Harbour", None, pdf_page=7, depth=0),
            StructureClaim("Orchard - Grove", None, pdf_page=8, depth=1),
        ]
        separate_outline_aliases(outline, printed, 7, state)
        state.source_outline_targets[("harbour", 7, 0)] = "observed-1"
        chapters = [
            dict(id="front", block_ids=["observed-0"]),
            dict(id="body", block_ids=["observed-1", "observed-2"]),
        ]
        toc = [
            dict(
                id="harbour",
                label="Harbour",
                target=dict(kind="internal", chapter_id="body", block_id="observed-1", offset=0),
            )
        ]
        addresses = [
            dict(
                source_page=page,
                target=dict(
                    kind="internal",
                    chapter_id="front" if i == 0 else "body",
                    block_id=f"observed-{i}",
                    offset=0,
                ),
            )
            for i, page in enumerate([1, 7, 8])
        ]
        add_outline_navigation(state, chapters, toc, addresses)
        child = next(entry for entry in toc if entry["label"] == "Orchard - Grove")
        self.assertEqual("harbour", child["parent_id"])
