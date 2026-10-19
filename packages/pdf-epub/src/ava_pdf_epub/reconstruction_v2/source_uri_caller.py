"""A complete original URI group can prove a terminal caller subspan independently of prose."""

from typing import Any

from pypdf import PdfReader

from ..contracts.common import document_digest
from ..contracts.source import Box
from ..pdf_navigation import NavigationTarget
from .assembly_state import AssemblyState
from .findings import Finding
from .ocr_glyph_frame import glyph_frame_safe
from .pdf_link_page import LinkPage
from .source_context_identity import source_context_identity
from .source_gutters import crosses_source_gutter
from .uri_group_types import PendingUriLink
from .uri_original_group import uri_original_group
from .uri_owner_span import uri_owner_span
from .uri_peer_identities import uri_peer_identities
from .uri_source_parts import uri_source_parts
from .uri_wrap_order import uri_wrap_order


def source_uri_caller(
    reader: PdfReader,
    target: NavigationTarget,
    annotation: Any,
    caller: Box,
    context: LinkPage,
    state: AssemblyState,
) -> list[tuple[str, int, int]] | None:
    if target.url is None or not isinstance(annotation, dict):
        return None
    page = context.checkpoint.observation
    if not 1 <= page.number <= len(reader.pages):
        return None
    if state.pending_uri_link is not None or not glyph_frame_safe(
        reader.pages[page.number - 1], page
    ):
        return None
    group = uri_original_group(reader, target, annotation, page, caller)
    parts = uri_source_parts(page, group) if group else None
    ordered = uri_wrap_order(page, parts, group.raw_uri) if parts and group else None
    if ordered is None or group is None:
        return None
    if crosses_source_gutter(page, [(part.line, list(part.values)) for part in ordered]):
        return None
    span = uri_owner_span(
        page, context.owners, ordered, group.current_index, state.source_continuation_policy
    )
    if span is None:
        return None
    state.pending_uri_link = PendingUriLink(
        id(reader),
        document_digest(context.checkpoint),
        target,
        group,
        caller,
        span.owner.id,
        source_context_identity(span.owner),
        uri_peer_identities(context.owners),
        (span.start, span.end),
        span.ranges,
    )
    state.structure_findings.append(
        Finding(
            code="PDF_LINK_LITERAL_URI_SOURCE_CORROBORATED",
            severity="information",
            page=page.number,
            message="The complete original URI annotation group and visible source rows prove this "
            "literal URI subspan; unrelated paragraph text is not certified or rewritten.",
        )
    )
    return list(span.ranges)
