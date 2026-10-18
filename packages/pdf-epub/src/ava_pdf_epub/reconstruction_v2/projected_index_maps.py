"""Recheck page and full current owner identity before reusing any derived glyph map."""

from ..contracts.common import document_digest
from .assembly_state import AssemblyState
from .continuation_presentation_contract import POLICY
from .index_projection_types import IndexPageProjection
from .native_layout_policy import NATIVE_LAYOUT_POLICY
from .ocr_glyph_types import GlyphMap
from .prepared_types import AnyPreparedPage, layout_policy
from .recognition_contract import RecognitionTask
from .segments import Segment
from .source_context_identity import source_context_identity


def verified_index_projection(
    checkpoint: AnyPreparedPage, owners: list[Segment], state: AssemblyState
) -> IndexPageProjection | None:
    page = checkpoint.observation
    receipt = state.source_index_projections.get(page.number)
    if receipt is None or state.source_continuation_policy != POLICY:
        return None
    if (
        checkpoint.source_sha256 != receipt.source_sha256
        or layout_policy(checkpoint) != NATIVE_LAYOUT_POLICY
        or checkpoint.native_segments
        or len(checkpoint.tasks) != 1
        or not isinstance(checkpoint.tasks[0], RecognitionTask)
        or checkpoint.tasks[0].profile_id != checkpoint.profile_id
        or document_digest(checkpoint.tasks[0]) != receipt.task_sha256
    ):
        return None
    if receipt.observation_sha256 != document_digest(page) or any(
        s.method != "ocr" or s.native_line_ids or s.page != page.number for s in owners
    ):
        return None
    if len({s.id for s in owners}) != len(owners):
        return None
    furniture = {(s.id, source_context_identity(s)) for s in owners if s.kind == "furniture"}
    if not furniture <= set(receipt.furniture):
        return None
    identities = tuple((s.id, source_context_identity(s)) for s in owners if s.kind != "furniture")
    if len(identities) != len(receipt.owners) or dict(identities) != dict(receipt.owners):
        return None
    return receipt


def projected_index_maps(
    checkpoint: AnyPreparedPage, owners: list[Segment], state: AssemblyState
) -> dict[str, GlyphMap]:
    receipt = verified_index_projection(checkpoint, owners, state)
    return {e.proof.owner_id: e.proof for e in receipt.entries} if receipt else {}
