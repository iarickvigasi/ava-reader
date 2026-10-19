"""Compound callers require unchanged original actions and complete source authority."""

import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from pypdf.generic import DictionaryObject, NameObject, TextStringObject

from .compound_heading_caller_fixture import fixture


class CompoundHeadingCallerSafetyTests(unittest.TestCase):
    def test_forged_destination_uri_additional_action_and_historical_policy_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            self.addCleanup(f.heading.reader.close)
            for target in (replace(f.target, page=1), replace(f.target, url="https://example.org")):
                with (
                    self.subTest(target=target),
                    self.assertRaisesRegex(ValueError, "TEXT_MAPPING"),
                ):
                    f.prove(target=target)
            for policy in (None, "old"):
                with (
                    self.subTest(policy=policy),
                    self.assertRaisesRegex(ValueError, "TEXT_MAPPING"),
                ):
                    f.prove(policy=policy)
            annotation = DictionaryObject(dict(f.annotation))
            annotation[NameObject("/AA")] = DictionaryObject()
            with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                f.prove(annotation=annotation)

    def test_a_selected_ligature_cannot_borrow_incomplete_changed_or_competing_owner_proof(self):
        with tempfile.TemporaryDirectory() as directory:
            f = fixture(Path(directory))
            self.addCleanup(f.heading.reader.close)
            owner = f.heading.owners[0]
            caller = f.heading.page.lines[1].glyphs[0].box
            for update in (
                {"text": owner.text.replace("bandit", "bandits")},
                {"text": owner.text.split("with a")[0]},
                {"heading_level": 2},
                {"chapter_role": "backmatter"},
                {"chapter_start": False},
            ):
                with (
                    self.subTest(update=update),
                    self.assertRaisesRegex(ValueError, "TEXT_MAPPING"),
                ):
                    f.prove(
                        owners=[owner.model_copy(update=update), *f.heading.owners[1:]],
                        caller=caller,
                    )
            with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                f.prove(
                    owners=[*f.heading.owners, owner.model_copy(update={"id": "competing"})],
                    caller=caller,
                )
            for update in (
                {"width_pt": 121},
                {"rotation": 90},
                {"risks": ["unreliable_glyph_mapping"]},
            ):
                with (
                    self.subTest(update=update),
                    self.assertRaisesRegex(ValueError, "TEXT_MAPPING"),
                ):
                    f.prove(page=f.heading.page.model_copy(update=update), caller=caller)
            page = f.heading.page.model_copy(deep=True)
            page.lines[3].glyphs[-1] = (
                page.lines[3].glyphs[-1].model_copy(update={"visible": False})
            )
            with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                f.prove(page=page, caller=caller)

    def test_missing_changed_or_duplicate_original_outline_cannot_authorize_backlink(self):
        for mode in ("missing", "changed", "duplicate"):
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as directory:
                f = fixture(Path(directory))
                self.addCleanup(f.heading.reader.close)
                root = f.heading.reader.trailer["/Root"]
                if mode == "missing":
                    del root[NameObject("/Outlines")]
                elif mode == "changed":
                    root["/Outlines"]["/First"][NameObject("/Title")] = TextStringObject(
                        "Unrelated"
                    )
                else:
                    first = root["/Outlines"]["/First"]
                    first[NameObject("/Next")] = DictionaryObject(dict(first))
                with self.assertRaisesRegex(ValueError, "TEXT_MAPPING"):
                    f.prove()
