"""Census all native physical U+002D endings, including pages with no eligible task."""

from collections.abc import Sequence

from ..contracts.common import text_digest
from ..contracts.layout_hyphen_classification_v3 import NativeStructureHyphenClassificationReceipt
from .observations import PageObservation
from .word_wrap_eligibility import word_wrap_ineligibility
from .word_wrap_entry import qualified_word_wrap_entry
from .word_wrap_fields import WordWrapCensusEntry, WordWrapEntry
from .word_wrap_source_contract import WordWrapOwner
from .word_wrap_source_index import word_wrap_source_index


def word_wrap_census(
    owners: Sequence[WordWrapOwner],
    pages: Sequence[PageObservation],
    source_sha256: str,
    prior_authorities: Sequence[NativeStructureHyphenClassificationReceipt] = (),
) -> tuple[list[WordWrapEntry], list[WordWrapCensusEntry]]:
    positions = word_wrap_source_index(owners, pages)
    entries: list[WordWrapEntry] = []
    census: list[WordWrapCensusEntry] = []
    for page in pages:
        for line in page.lines:
            if not line.text.rstrip(" \t").endswith("-"):
                continue
            values = dict(line_id=line.id, page=page.number, text_sha256=text_digest(line.text))
            location = positions.get(line.id)
            if location is None:
                census.append(
                    WordWrapCensusEntry.model_validate(
                        dict(
                            **values,
                            classification="unsupported",
                            reason="no_final_native_owner",
                        )
                    )
                )
                continue
            owner, index = location
            right = owner.lines[index + 1] if index + 1 < len(owner.lines) else None
            values.update(owner_id=owner.id, next_line_id=right.line_id if right else None)
            reason = word_wrap_ineligibility(owner, index)
            if reason is None:
                entry, reason = qualified_word_wrap_entry(
                    owner,
                    index,
                    f"w{len(entries) + 1:05d}",
                    source_sha256,
                    prior_authorities,
                )
                if entry is not None:
                    entries.append(entry)
                    values.update(
                        entry_id=entry.id,
                        resolution="reuse" if entry.reused_authority else "request",
                    )
            classification = (
                "eligible"
                if reason is None
                else ("preserved" if reason == "preserved_line_breaks" else "unsupported")
            )
            census.append(
                WordWrapCensusEntry.model_validate(
                    dict(
                        **values,
                        classification=classification,
                        reason=reason or "qualified",
                    )
                )
            )
    return entries, census
