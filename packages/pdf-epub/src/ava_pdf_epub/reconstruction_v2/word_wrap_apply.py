"""Complete source-bound sparse decisions precede canonical text and address compilation."""

from collections import defaultdict

from ..contracts.layout_hyphen_authority_v3 import LayoutHyphenAuthorityV3
from ..contracts.layout_hyphen_classification_v3 import LayoutClassificationReceipt
from .layout_hyphen_normalization_v3 import normalize_layout_hyphens_v3
from .layout_hyphen_offsets import layout_hyphen_range
from .refinement_digest import observation_digest
from .segments import Segment
from .word_wrap_assembly import WordWrapAssembly
from .word_wrap_classifications import word_wrap_classifications
from .word_wrap_contract import WordWrapBatch, WordWrapResponse
from .word_wrap_source_contract import WordWrapOwner


def apply_word_wrap(
    assembly: WordWrapAssembly,
    owners: list[WordWrapOwner],
    batch: WordWrapBatch,
    responses: list[WordWrapResponse],
) -> dict[str, tuple[list[tuple[int, int]], str]]:
    batch = WordWrapBatch.model_validate(batch.model_dump())
    if batch.observation_sha256 != observation_digest(assembly.segments):
        raise ValueError("Sparse lexical catalogue belongs to another final-owner snapshot")
    lookup = {response.task_id: response for response in responses}
    if len(lookup) != len(responses) or set(lookup) != {task.task_id for task in batch.tasks}:
        raise ValueError("Sparse lexical response coverage differs")
    classifications: dict[str, LayoutClassificationReceipt] = {}
    for task in batch.tasks:
        for classification in word_wrap_classifications(task, lookup[task.task_id]):
            classifications[classification.candidate_id] = classification
    grouped: dict[str, list[LayoutHyphenAuthorityV3]] = defaultdict(list)
    for entry in batch.entries:
        receipt = entry.reused_authority or classifications.get(entry.candidate.id)
        if receipt is None:
            raise ValueError("Sparse lexical entry has no declared authority")
        grouped[entry.owner_id].append(
            LayoutHyphenAuthorityV3(
                candidate=entry.candidate,
                pair_source=entry.source_pair,
                pair_cuts=entry.pair_cuts,
                classification=receipt,
                source_offset=entry.owner_source_offset,
                original_source_offset=entry.original_owner_source_offset,
                retained_left_line_start=sum(
                    c.source_end - c.source_start
                    for c in entry.pair_cuts
                    if c.receipt.line_id == entry.left.line_id
                ),
                retained_right_line_start=sum(
                    c.source_end - c.source_start
                    for c in entry.pair_cuts
                    if c.receipt.line_id == entry.right.line_id
                ),
            )
        )
    owner_lookup = {owner.id: owner for owner in owners}
    changes = {}
    segments = []
    for segment in assembly.segments:
        authorities = grouped.get(segment.id)
        if not authorities:
            segments.append(segment)
            continue
        owner = owner_lookup[segment.id]
        if segment.kind != owner.role or segment.source_text != owner.source_text:
            raise ValueError("Sparse lexical owner role or raw body changed")
        result = normalize_layout_hyphens_v3(
            owner.source_text,
            batch.source_sha256,
            authorities[0].candidate.role,
            authorities,
            text=segment.text,
            original_source_text=owner.original_text if owner.cuts else None,
            source_cuts=owner.cuts,
        )
        spans = []
        for span in segment.spans:
            start, end = layout_hyphen_range(
                span.start,
                span.end,
                result.removals,
                len(segment.text),
                referenced=bool(span.url or span.note_label or span.target_text),
            )
            if start != end:
                spans.append(span.model_copy(update={"start": start, "end": end}))
        updated = Segment.model_validate(
            {**segment.model_dump(), "text": result.text, "spans": spans}
        )
        assembly.state.normalization_maps[segment.id] = result.normalization
        changes[segment.id] = (result.removals, segment.text)
        assembly.state.segments[segment.id] = updated
        segments.append(updated)
    assembly.segments = segments
    return changes
