"""Later model/style stages cannot undo source-measured index layout."""

from .assembly_state import AssemblyState
from .index_context import independent_index_entry
from .segments import Segment


def assert_index_indents(segments: list[Segment], state: AssemblyState) -> None:
    owners = {segment.id: segment for segment in segments}
    for ident, receipt in state.source_index_entries.items():
        if receipt.indent_em is None or receipt.block_indent_em is None:
            continue
        owner = owners.get(ident)
        if (
            owner is None
            or not independent_index_entry(owner, state)
            or owner.style is None
            or owner.style.indent_em != receipt.indent_em
            or owner.style.block_indent_em != receipt.block_indent_em
        ):
            raise ValueError("Final index owner or indentation differs from source measurement")
