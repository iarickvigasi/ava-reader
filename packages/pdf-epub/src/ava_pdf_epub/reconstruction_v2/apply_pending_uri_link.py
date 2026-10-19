"""Consume one exact caller handoff; it is never reusable owner-wide link authority."""

from collections.abc import Sequence

from pypdf import PdfReader

from ..contracts.common import document_digest
from ..pdf_navigation import NavigationTarget
from .assembly_state import AssemblyState
from .continuation_presentation_contract import POLICY
from .prepared_types import AnyPreparedPage
from .segments import Segment
from .source_context_identity import source_context_identity
from .uri_group_spans import uri_group_spans
from .uri_original_group import uri_original_group
from .uri_peer_identities import uri_peer_identities


def apply_pending_uri_link(
    ranges: list[tuple[str, int, int]],
    target: NavigationTarget,
    result: list[Segment],
    indexes: dict[str, int],
    reader: PdfReader,
    prepared: Sequence[AnyPreparedPage],
    state: AssemblyState,
) -> None:
    proof, state.pending_uri_link = state.pending_uri_link, None
    if proof is None or state.source_continuation_policy != POLICY:
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    if (
        id(reader) != proof.reader_identity
        or tuple(ranges) != proof.ranges
        or target != proof.target
    ):
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    owner = result[indexes[proof.owner_id]]
    checkpoint = prepared[owner.page - 1]
    if (
        document_digest(checkpoint) != proof.checkpoint_sha256
        or owner.method != "ocr"
        or owner.native_line_ids
        or source_context_identity(owner) != proof.owner_identity
        or uri_peer_identities([s for s in result if s.page == owner.page]) != proof.peers
    ):
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    annotations = reader.pages[owner.page - 1].get("/Annots", [])
    annotations = annotations.get_object() if hasattr(annotations, "get_object") else annotations
    if not isinstance(annotations, list) or not 0 <= proof.group.current_index < len(annotations):
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    annotation = annotations[proof.group.current_index].get_object()
    if uri_original_group(reader, target, annotation, checkpoint.observation, proof.caller) != (
        proof.group
    ):
        raise ValueError("PDF_LINK_TEXT_MAPPING_REQUIRES_REVIEW")
    spans = uri_group_spans(owner, proof)
    result[indexes[owner.id]] = owner.model_copy(update={"spans": spans})
