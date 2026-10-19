"""Rebase qualified native body geometry inside its semantic list, not surrounding prose."""

from collections.abc import Sequence

from ..contracts.styles import Style
from .assembly_state import AssemblyState
from .list_body_geometry import list_body_geometry
from .literal_label_geometry import literal_label_geometry
from .native_indent_rows import indent_rows
from .prepared_types import AnyPreparedPage
from .segments import Segment


def capture_list_bodies(
    segments: list[Segment], prepared: Sequence[AnyPreparedPage], state: AssemblyState
) -> None:
    local_segments: dict[int, list[Segment]] = {}
    selected: dict[int, list[Segment]] = {}
    for segment in segments:
        local_segments.setdefault(segment.page, []).append(segment)
        if segment.kind == "list_item" and segment.method == "native":
            selected.setdefault(segment.page, []).append(segment)
    for number, local in selected.items():
        page = prepared[number - 1]
        if page.observation.number != number:
            raise ValueError("List body page observation identity differs")
        proof = indent_rows(page.observation, local_segments[number])
        for segment in local:
            label = literal_label_geometry(segment, page.observation, proof)
            if label is not None:
                state.literal_label_geometry[segment.id] = label
            geometry = list_body_geometry(segment, proof)
            if geometry is not None:
                state.list_body_geometry[segment.id] = geometry


def normalize_list_bodies(state: AssemblyState) -> None:
    blocks = {b["id"]: b for b in state.blocks}
    for group in state.lists:
        cohorts: dict[tuple[int, int], list[str]] = {}
        for ident in group["item_ids"]:
            if ident in state.list_body_geometry and ident in state.placements:
                page, _, column = state.placements[ident]
                cohorts.setdefault((page, column), []).append(ident)
        for items in cohorts.values():
            baseline = min(min(state.list_body_geometry[i][:2]) for i in items)
            for ident in items:
                first, body, size = state.list_body_geometry[ident]
                indent, inset = (first - body) / size, (body - baseline) / size
                if not (-3 <= indent <= 6 and 0 <= inset <= 6):
                    continue
                block = blocks[ident]
                original = state.styles.get(block.get("style_id") or "")
                # Unknown geometry is not overwritten; other typography remains exact.
                style = Style.model_validate(original) if original else Style(id="list-body")
                style = style.model_copy(update={"indent_em": indent, "block_indent_em": inset})
                block["style_id"] = state.style_id(style)
