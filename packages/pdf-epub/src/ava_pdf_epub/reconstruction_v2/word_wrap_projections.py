"""Raw navigation and metadata receipts remain checked through lexical deletions."""

from dataclasses import dataclass

from ..contracts.common import document_digest, text_digest
from ..contracts.layout_normalization_v3 import LayoutNormalizationMapV3
from ..contracts.layout_projection_v3 import LayoutTextProjectionReceipt
from .internal_links import _resolve
from .layout_hyphen_offsets import layout_hyphen_offset, layout_hyphen_range
from .layout_projection_v3 import project_fragment
from .source_page_starts import SourcePageStart
from .word_wrap_assembly import WordWrapAssembly
from .word_wrap_feature_ranges import verify_word_wrap_feature_ranges


@dataclass(frozen=True)
class ProjectedPageStart(SourcePageStart):
    original_text: str
    input_owner_id: str
    projection: LayoutTextProjectionReceipt


def project_word_wrap_positions(
    assembly: WordWrapAssembly,
    changes: dict[str, tuple[list[tuple[int, int]], str]],
) -> None:
    state = assembly.state
    verify_word_wrap_feature_ranges(state, changes)

    def shift(ident: str, offset: int) -> int:
        if ident not in changes:
            return offset
        removals, text = changes[ident]
        return layout_hyphen_offset(offset, removals, len(text))

    # Freeze every projection against original alias offsets before mutating any
    # alias. Updating only the right-page offset would leave the left text stale.
    for number, start in list(assembly.page_starts.items()):
        owner, offset = _resolve(start.segment_id, state)
        if owner not in changes or start.text is None:
            continue
        removals, text = changes[owner]
        mapping = state.normalization_maps[owner]
        assert isinstance(mapping, LayoutNormalizationMapV3)
        projected = project_fragment(
            text,
            offset,
            offset + len(start.text),
            removals,
            normalization=mapping,
            expected_fragment=start.text,
            expected_sha256=text_digest(start.text),
        )
        assembly.page_starts[number] = ProjectedPageStart(
            start.segment_id,
            projected.text,
            start.region_id,
            start.text,
            owner,
            projected.receipt,
        )
    for ident, (role, original) in state.bibliographic_roles.items():
        if role is None:
            continue
        owner, offset = _resolve(ident, state)
        state.bibliographic_claim_owners[ident] = owner
        if ident not in state.bibliographic_source_ranges:
            raise ValueError("Bibliographic projection has no original source range receipt")
        first, last, length, original_sha, _, _ = state.bibliographic_source_ranges[ident]
        removals, text = changes.get(owner, ([], state.segments[owner].text))
        if text_digest(text[offset : offset + length]) != original_sha:
            raise ValueError("Bibliographic whole original owner differs before projection")
        if text[offset + first : offset + last] != original:
            raise ValueError("Bibliographic selected source fragment differs before projection")
        if owner not in changes:
            continue
        mapping = state.normalization_maps[owner]
        assert isinstance(mapping, LayoutNormalizationMapV3)
        projected = project_fragment(
            text,
            offset + first,
            offset + last,
            removals,
            normalization=mapping,
            expected_fragment=original,
            expected_sha256=text_digest(original),
            referenced=True,
        )
        state.bibliographic_projections[ident] = projected.text
    # Origins and destinations can both be aliases of final joined owners. Flatten
    # them before applying one deletion map; never mix old and new coordinates.
    targets = []
    for origin, first, last, target, at in state.internal_targets:
        owner, offset = _resolve(origin, state)
        destination, target_offset = _resolve(target, state)
        first, last = first + offset, last + offset
        if owner in changes:
            removals, text = changes[owner]
            first, last = layout_hyphen_range(first, last, removals, len(text), referenced=True)
        targets.append((owner, first, last, destination, shift(destination, at + target_offset)))
    aliases = {}
    for alias in state.aliases:
        owner, offset = _resolve(alias, state)
        aliases[alias] = (owner, shift(owner, offset))
    state.internal_targets = targets
    state.aliases = aliases


def verify_projected_page_start(
    start: ProjectedPageStart, owner: str, offset: int, mapping: LayoutNormalizationMapV3
) -> None:
    receipt = start.projection
    if (
        owner != start.input_owner_id
        or offset != receipt.canonical_start
        or receipt.map_sha256 != document_digest(mapping)
        or receipt.source_fragment_sha256 != text_digest(start.original_text)
        or receipt.canonical_fragment_sha256 != text_digest(start.text or "")
    ):
        raise ValueError("Source-page lexical projection identity changed")
