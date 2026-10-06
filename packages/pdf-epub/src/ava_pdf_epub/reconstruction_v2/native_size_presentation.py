"""Rebase only final block typography after source roles, metadata and addresses are settled."""

from collections.abc import Sequence

from ..contracts.book import CanonicalBookV2
from ..contracts.styles import Style
from .assembly_state import AssemblyState
from .findings import Finding
from .native_document_sizes import normalize_native_sizes
from .prepared import PreparedPage
from .segments import Segment


def apply_native_sizes(
    segments: list[Segment], prepared: Sequence[PreparedPage], state: AssemblyState
) -> None:
    staged = AssemblyState(bibliographic_roles=state.bibliographic_roles)
    normalized = normalize_native_sizes(segments, prepared, staged)
    rebased = {
        new.id: new.style.relative_size
        for old, new in zip(segments, normalized, strict=True)
        if old.style and new.style and old.style.relative_size != new.style.relative_size
    }
    updates = []
    for block in state.blocks:
        ratio = rebased.get(block["id"])
        original = state.styles.get(block.get("style_id") or "")
        if ratio is None or original is None:
            continue
        if original["relative_size"] != ratio:
            style = Style.model_validate(original).model_copy(update={"relative_size": ratio})
            updates.append((block, staged.style_id(style)))
    limit = next(
        int(bound.max_length)
        for bound in CanonicalBookV2.model_fields["styles"].metadata
        if hasattr(bound, "max_length")
    )
    if len(state.styles.keys() | staged.styles.keys()) > limit:
        state.structure_findings.append(
            Finding(
                code="NATIVE_DOCUMENT_SIZE_STYLE_LIMIT",
                severity="information",
                message="Optional document-size rebasing would exceed the canonical style limit; "
                "all existing styles and block ratios retained without pruning.",
            )
        )
        return
    state.structure_findings.extend(staged.structure_findings)
    state.styles.update(staged.styles)
    for block, ident in updates:
        block["style_id"] = ident
