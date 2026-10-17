"""Source-measured index subentries and hanging wraps do not need another model call."""

from collections.abc import Sequence
from dataclasses import replace

from ..contracts.styles import Style
from .apply_native_indent import indent_unknown
from .assembly_state import AssemblyState
from .index_context import independent_index_entry
from .index_indent_geometry import (
    index_column_origin,
    index_indent_geometry,
    measured_index_indents,
)
from .prepared_types import AnyPreparedPage
from .segments import Segment


def recover_index_indents(
    prepared: Sequence[AnyPreparedPage], segments: list[Segment], state: AssemblyState
) -> list[Segment]:
    updates = {}
    for checkpoint in prepared:
        owners = [s for s in segments if s.page == checkpoint.observation.number]
        selected = [s for s in owners if independent_index_entry(s, state)]
        measured = [
            geometry
            for owner in selected
            if (
                geometry := index_indent_geometry(
                    checkpoint.observation, owner, owners, state.source_continuation_policy
                )
            )
            is not None
        ]
        for entry in measured:
            origin = index_column_origin(entry, measured, checkpoint.observation)
            values = measured_index_indents(entry, origin) if origin is not None else None
            if values is None:
                continue
            style = entry.owner.style or Style(id="source-index")
            updates[entry.owner.id] = entry.owner.model_copy(
                update={"style": Style.model_validate({**style.model_dump(), **values})}
            )
            state.source_index_entries[entry.owner.id] = replace(
                state.source_index_entries[entry.owner.id],
                indent_em=values["indent_em"],
                block_indent_em=values["block_indent_em"],
            )
            indent_unknown(
                state,
                entry.owner,
                "INDEX_INDENT_SOURCE_CORROBORATED",
                "Complete source-owned index rows and repeated same-column margins establish "
                "first-line and whole-block indentation; text, spans and links stay unchanged.",
            )
        for owner in selected:
            if owner.id not in updates:
                indent_unknown(
                    state,
                    owner,
                    "INDEX_INDENT_SOURCE_UNPROVEN",
                    "Source ownership, repeated column margin or bounded indentation is "
                    "unproved; the original observation is retained.",
                )
    return [updates.get(s.id, s) for s in segments]
